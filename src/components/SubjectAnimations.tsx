import { useEffect, useState } from 'react';
import './SubjectAnimations.css';

export interface FloatingElement {
  id: string;
  text: string;
  startX: number;
  startY: number;
  angle: number;
  offsetX: number;
  offsetY: number;
}

const ENGLISH_SYMBOLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
const MATH_SYMBOLS = ['∑', '√', '∫', '∞', '×', '÷', '=', 'π', 'θ', '∂', '±', '≈'];
const SCIENCE_SYMBOLS = ['⚛', 'e', 'F', 'E', 'ℏ', 'H', 'N'];
const SOCIAL_SYMBOLS = ['🗺', '📖', '⏰', '🌍', '📅', '🏛'];
const CS_SYMBOLS = ['0', '1', '{', '}', ';', '(', ')', '[', ']', '→'];
const ARTS_SYMBOLS = ['✎', '◉', '△', '◇', '◈', '✓', '✕'];

const getSymbolsForSubject = (subjectId: string): string[] => {
  switch (subjectId) {
    case 'english':
      return ENGLISH_SYMBOLS;
    case 'math':
      return MATH_SYMBOLS;
    case 'science':
      return SCIENCE_SYMBOLS;
    case 'social':
      return SOCIAL_SYMBOLS;
    case 'computer_science':
      return CS_SYMBOLS;
    case 'fine_arts':
      return ARTS_SYMBOLS;
    default:
      return [];
  }
};

interface SubjectAnimationsProps {
  subjectId: string;
  trigger: boolean;
  iconX?: number;
  iconY?: number;
}

export default function SubjectAnimations({ subjectId, trigger, iconX = 0, iconY = 0 }: SubjectAnimationsProps) {
  const [elements, setElements] = useState<FloatingElement[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const symbols = getSymbolsForSubject(subjectId);
    if (symbols.length === 0) return;

    // Create 16 particles spreading across entire screen
    const newElements: FloatingElement[] = Array.from({ length: 16 }).map((_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const distance = 500 + Math.random() * 200; // Spread across entire screen
      return {
        id: `${Date.now()}-${i}`,
        text: symbols[Math.floor(Math.random() * symbols.length)],
        startX: iconX,
        startY: iconY,
        angle: angle,
        offsetX: Math.cos(angle) * distance,
        offsetY: Math.sin(angle) * distance,
      };
    });

    setElements(newElements);

    // Clear elements after animation completes
    const timer = setTimeout(() => setElements([]), 4000);
    return () => clearTimeout(timer);
  }, [trigger, subjectId, iconX, iconY]);

  return (
    <div className="subject-animations-container">
      {elements.map((el) => (
        <div
          key={el.id}
          className={`particle ${subjectId}`}
          style={{
            '--start-x': `${el.startX}px`,
            '--start-y': `${el.startY}px`,
            '--offset-x': `${el.offsetX}px`,
            '--offset-y': `${el.offsetY}px`,
          } as React.CSSProperties}
        >
          {el.text}
        </div>
      ))}
    </div>
  );
}
