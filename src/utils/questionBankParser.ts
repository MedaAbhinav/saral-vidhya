export interface ParsedQa {
  question: string;
  answer: string;
}

export interface QuestionBankEntry {
  id: string;
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  chapterName: string;
  question: string;
  shortAnswer: string;
  longAnswer: string;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function parseUniversal(markdown: string): ParsedQa[] {
  const lines = markdown.split(/\r?\n/);
  const questions: string[] = [];
  const answers: string[] = [];

  let mode: 'q' | 'a' = 'q';
  let currentText = '';
  let currentType: 'q' | 'a' | null = null;

  const pushCurrent = () => {
    if (currentType === 'q' && currentText.trim()) questions.push(currentText);
    if (currentType === 'a' && currentText.trim()) answers.push(currentText);
    currentText = '';
    currentType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    const isAnswerHeading =
      lowerLine.match(/^(?:#+|\*\*).*(?:answer key|جوابات|نمونہ جوابات|خاکہ جوابات)/i) ||
      lowerLine.replace(/^[#*\s-]+|[*\s-:]+$/g, '') === 'answers';

    const isQuestionHeading =
      lowerLine.match(/^(?:#+|\*\*).*(?:part|section|حصہ)/i) ||
      lowerLine.match(/^(?:#+|\*\*).*(?:questions?|سوالات)/i);

    if (isAnswerHeading && !isQuestionHeading) {
      pushCurrent();
      mode = 'a';
      continue;
    }

    if (isQuestionHeading) {
      pushCurrent();
      mode = 'q';
      continue;
    }

    const numMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numMatch) {
      pushCurrent();
      currentType = mode;
      currentText = numMatch[1];
      continue;
    }

    const inlineMatch =
      line.match(/^(?:[-*]\s*)?\*\*(?:Model Answer|Answer):\*\*\s*(.+)$/i) ||
      line.match(/^(?:[-*]\s*)?(?:Model Answer|Answer):\s*(.+)$/i);
    if (inlineMatch) {
      pushCurrent();
      currentType = 'a';
      currentText = inlineMatch[1];
      continue;
    }

    if (currentType && line.length > 0 && !line.startsWith('---') && !line.match(/^(?:#+|\*\*)/)) {
      currentText += '\n' + line;
    }
  }
  pushCurrent();

  const result: ParsedQa[] = [];
  const maxLen = Math.max(questions.length, answers.length);
  for (let i = 0; i < maxLen; i++) {
    const q = questions[i] ? normalizeText(questions[i]) : '';
    const a = answers[i] ? normalizeText(answers[i]) : '';
    if (q) result.push({ question: q, answer: a });
  }

  return result;
}

export function parseQuestionBankMarkdown(
  markdown: string,
  subjectId: string,
  subjectName: string,
  chapterNumber: number,
  chapterName: string,
): QuestionBankEntry[] {
  const parsed = parseUniversal(markdown);

  // Extract MCQ answer key — handles "1. b) On the crest...", "1. C", "1. (b) text"
  const answerKeyMap: Record<number, string> = {};
  const akSection = markdown.match(/answer\s+key[\s\S]*?(?=\n#{1,4}|\n\*\*2\.|\n---\n#{1,4}|$)/i);
  if (akSection) {
    for (const line of akSection[0].split('\n')) {
      const m = line.match(/^\s*(\d+)\.\s+(?:\(?[a-dA-D]\)?[\)\.]\s*)?(.+)/);
      if (m && m[2]) {
        const text = m[2].replace(/^[a-dA-D][\)\.]\s*/i, '').trim();
        if (text) answerKeyMap[parseInt(m[1], 10)] = text;
      }
    }
  }

  return parsed.map((p, index) => {
    const keyAnswer = answerKeyMap[index + 1] || '';
    const fullAnswer = keyAnswer || p.answer;
    const cleanAnswer = fullAnswer.replace(/^[a-dA-D][\)\.]\s*/i, '').trim();
    const answerLines = cleanAnswer.split(/\n/).map(l => l.trim()).filter(Boolean);
    const short = answerLines[0] || cleanAnswer;
    const long = answerLines.length > 1 ? cleanAnswer : '';

    return {
      id: `${subjectId}-${chapterNumber}-${index}`,
      subjectId,
      subjectName,
      chapterNumber,
      chapterName,
      question: p.question,
      shortAnswer: short,
      longAnswer: long,
    };
  });
}
