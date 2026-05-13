export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

/**
 * Heuristically parses a markdown string into a list of multiple-choice questions.
 * Expects formats like:
 * 1. Question text
 * A) Option 1
 * B) Option 2
 * C) Option 3
 * D) Option 4
 * Answer: A (or true/false statement with explanation)
 * Explanation: ...
 */
export function parseQuestionBank(markdownText: string): QuizQuestion[] {
  if (!markdownText) return [];

  const questions: QuizQuestion[] = [];

  // ── Step 1: Extract answer key from the bottom of the file ──
  // Looks for "Answer Key" section with lines like "1. b) On the crest..."
  const answerKeyMap: Record<number, number> = {};
  const answerKeyMatch = markdownText.match(/answer\s+key[\s\S]*?(?=\n#{1,4}|\n\*\*2\.|\n---|\n####\s+2\.|$)/i);
  if (answerKeyMatch) {
    const akLines = answerKeyMatch[0].split('\n');
    for (const line of akLines) {
      // Match "1. b) ..." or "1. B) ..." or "1.  b) ..."
      const m = line.match(/^\s*(\d+)\.\s+([a-dA-D])[\)\.]/);
      if (m) {
        const qNum = parseInt(m[1], 10);
        const letter = m[2].toUpperCase();
        const idx = letter === 'A' ? 0 : letter === 'B' ? 1 : letter === 'C' ? 2 : 3;
        answerKeyMap[qNum] = idx;
      }
    }
  }

  // ── Step 2: Parse MCQ blocks ──
  const blocks = markdownText.split(/(?=\n\s*\d+\.\s+)/);

  let questionNumber = 0;
  for (const block of blocks) {
    if (!block.trim() || !/^\s*\d+\.\s+/.test(block)) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const qLine = lines[0].replace(/^\d+\.\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1');

    // Only process MCQ blocks (must have a/b/c/d options)
    const options: string[] = [];
    const optRegex = /^([A-D][\)\.]|[a-d][\)\.]-?)\s+(.+)/i;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (/answer/i.test(line) || /جواب/i.test(line)) break;
      const match = line.match(optRegex);
      if (match) {
        options.push(match[2].trim());
      }
    }

    if (options.length === 0) {
      const ansIndex = lines.findIndex(l => /answer/i.test(l) || /جواب/i.test(l));
      if (ansIndex > 1) {
        for (let i = 1; i < ansIndex; i++) {
          const clean = lines[i].replace(/^[a-dA-D][\)\.]\s+/, '').replace(/^[-\*]\s*/, '').trim();
          if (clean) options.push(clean);
        }
      }
    }

    if (options.length < 2) continue;

    questionNumber++;

    // ── Step 3: Determine answer index ──
    let answerIndex = 0;
    let explanation = "";

    // First try the answer key map
    if (answerKeyMap[questionNumber] !== undefined) {
      answerIndex = answerKeyMap[questionNumber];
    } else {
      // Fall back to inline Answer: line
      const ansLineIdx = lines.findIndex(l => /answer/i.test(l) || /جواب/i.test(l) || /correct/i.test(l) || /صحیح/i.test(l));
      if (ansLineIdx !== -1) {
        const ansText = lines[ansLineIdx];
        const letterMatch = ansText.match(/(?:Answer|جواب).*?([A-D])/i);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          answerIndex = letter === 'A' ? 0 : letter === 'B' ? 1 : letter === 'C' ? 2 : 3;
        } else {
          const bestMatch = options.findIndex(opt => ansText.includes(opt));
          if (bestMatch !== -1) answerIndex = bestMatch;
        }
        const expLineIdx = lines.findIndex(l => /explanation/i.test(l) || /وضاحت/i.test(l));
        if (expLineIdx !== -1) {
          explanation = lines.slice(expLineIdx).join(' ').replace(/^(Explanation|وضاحت)[\s:]*/i, '').trim();
        } else {
          explanation = lines.slice(ansLineIdx + 1).join(' ').trim();
        }
      }
    }

    questions.push({
      q: qLine,
      options: options.slice(0, 4),
      answer: answerIndex >= 0 && answerIndex < options.length ? answerIndex : 0,
      explanation: explanation || "No explanation provided."
    });
  }

  return questions;
}
