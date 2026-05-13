import { useEffect, useCallback, useState } from 'react';
import { googleTtsSpeak, googleTtsStop } from '@/services/googleTtsService';

interface Card {
  front: string;
  back: string;
}

interface Props {
  cards: Card[];
  subjectId?: string;
  /** Called whenever speaking state changes — true = currently speaking */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Incremented by parent to toggle play/pause */
  speakTrigger?: number;
  /** Incremented by parent to stop */
  stopTrigger?: number;
}

const SUBJECT_LANG: Record<string, string> = {
  pubadm_ur: 'ur-PK',
  hindi: 'hi-IN',
  telugu: 'te-IN',
};

export default function FlashcardsView({ cards, subjectId = 'english', onSpeakingChange, speakTrigger, stopTrigger }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [animationDirection, setAnimationDirection] = useState<'next' | 'prev' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const lang = SUBJECT_LANG[subjectId] ?? 'en-IN';

  const totalCards = cards?.length || 0;
  const currentCard = cards[currentIndex];
  const safeFront = currentCard?.front || (currentCard as any)?.question || '';
  const cleanTitle = typeof safeFront === 'string' ? safeFront.replace(/^Flash Cards\s*-\s*/i, '') : safeFront;
  const safeBack = currentCard?.back || (currentCard as any)?.answer || '';
  const speakText = `${cleanTitle}. ${safeBack}`;

  const clampIndex = (nextIndex: number) => {
    if (nextIndex < 0) return 0;
    if (nextIndex >= totalCards) return totalCards - 1;
    return nextIndex;
  };

  const prevCard = useCallback(() => {
    if (currentIndex === 0 || isAnimating) return;
    setAnimationDirection('prev');
    setIsAnimating(true);
    setCurrentIndex((current) => clampIndex(current - 1));
    window.setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 600);
  }, [currentIndex, isAnimating]);

  const nextCard = useCallback(() => {
    if (currentIndex === totalCards - 1 || isAnimating) return;
    setAnimationDirection('next');
    setIsAnimating(true);
    setCurrentIndex((current) => clampIndex(current + 1));
    window.setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 600);
  }, [currentIndex, isAnimating, totalCards]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevCard();
      else if (e.key === 'ArrowRight') nextCard();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevCard, nextCard]);

  // Stop TTS on unmount
  useEffect(() => () => googleTtsStop(), []);

  // Stop speaking when card changes
  useEffect(() => {
    googleTtsStop();
    setSpeakingIdx(null);
    onSpeakingChange?.(false);
  }, [currentIndex]);

  const handleSpeak = useCallback(() => {
    if (speakingIdx === currentIndex) {
      // currently playing → pause (toggle off)
      googleTtsStop();
      setSpeakingIdx(null);
      onSpeakingChange?.(false);
      return;
    }
    googleTtsStop();
    googleTtsSpeak(
      speakText,
      lang,
      () => { setSpeakingIdx(currentIndex); onSpeakingChange?.(true); },
      () => { setSpeakingIdx(null); onSpeakingChange?.(false); },
    );
  }, [speakingIdx, currentIndex, speakText, lang, onSpeakingChange]);

  const handleStop = useCallback(() => {
    googleTtsStop();
    setSpeakingIdx(null);
    onSpeakingChange?.(false);
  }, [onSpeakingChange]);

  // React to external speak trigger
  useEffect(() => {
    if (!speakTrigger) return;
    handleSpeak();
  }, [speakTrigger]);

  // React to external stop trigger
  useEffect(() => {
    if (!stopTrigger) return;
    handleStop();
  }, [stopTrigger]);

  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return <p>No flashcards available for this chapter.</p>;
  }

  return (
    <div className="flashcards-rich flashcards-fast">
      <div className="flashcards-stage">
        <button
          type="button"
          className="flashcard-nav-button"
          onClick={prevCard}
          disabled={currentIndex === 0}
          aria-label="Previous card"
        >
          ←
        </button>

        <div className="flashcard-frame single-face">
          <div
            key={currentIndex}
            className={`flashcard-content-static ${animationDirection ? `flashcard-animate-flip-${animationDirection}` : ''}`}
          >
            <div className="flashcard-scroll-area">
              <div className="flashcard-section question-section">
                <div className="flashcard-title">{cleanTitle}</div>
              </div>
              <div className="flashcard-separator"></div>
              <div className="flashcard-section answer-section">
                <div className="flashcard-back-content">{safeBack}</div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="flashcard-nav-button"
          onClick={nextCard}
          disabled={currentIndex === totalCards - 1}
          aria-label="Next card"
        >
          →
        </button>
      </div>

      <div className="flashcard-progress-row">
        <div className="flashcard-progress-bar">
          <div className="flashcard-progress-fill" style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }} />
        </div>
        <span className="flashcard-progress-label">{currentIndex + 1} / {totalCards}</span>
      </div>
    </div>
  );
}
