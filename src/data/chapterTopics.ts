/**
 * Topics to be covered for each chapter, extracted from mindmap top-level branches.
 * Used in the Study Plan / Study Table view.
 */

export interface ChapterTopics {
  subject: string;
  chapterNumber: number;
  topics: string[];
}

export const CHAPTER_TOPICS: ChapterTopics[] = [
  // ── Science ──────────────────────────────────────────────────────────────
  {
    subject: 'science',
    chapterNumber: 1,
    topics: [
      'What are Chemical Reactions?',
      'Chemical Equations',
      'Types of Chemical Reactions',
      'Effects of Redox Reactions in Everyday Life',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 2,
    topics: ['Acids', 'Bases', 'Indicators', 'pH Scale', 'Salts'],
  },
  {
    subject: 'science',
    chapterNumber: 3,
    topics: [
      'Physical Properties of Metals & Non-metals',
      'Chemical Properties',
      'How Metals and Non-metals React (Ionic Bonding)',
      'Occurrence of Metals',
      'Extraction of Metals (Metallurgy)',
      'Corrosion',
      'Alloys',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 4,
    topics: [
      'Covalent Bonding in Carbon',
      'Versatile Nature of Carbon',
      'Hydrocarbons',
      'Functional Groups',
      'Nomenclature (IUPAC Naming)',
      'Chemical Properties of Carbon Compounds',
      'Important Carbon Compounds (Ethanol & Ethanoic Acid)',
      'Soaps and Detergents',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 5,
    topics: ['Nutrition', 'Respiration', 'Transportation', 'Excretion'],
  },
  {
    subject: 'science',
    chapterNumber: 6,
    topics: [
      'Introduction to Control & Coordination',
      'Nervous System in Animals',
      'Hormonal System (Endocrine System) in Animals',
      'Control & Coordination in Plants',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 7,
    topics: [
      'Importance of Reproduction',
      'DNA Copying and Variations',
      'Asexual Reproduction',
      'Sexual Reproduction in Flowering Plants',
      'Sexual Reproduction in Humans',
      'Reproductive Health',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 8,
    topics: [
      'Heredity & Variation',
      "Mendel's Laws of Inheritance",
      'Mechanism of Inheritance',
      'Sex Determination in Humans',
      'Inherited vs. Acquired Traits',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 9,
    topics: [
      'Nature and Properties of Light',
      'Reflection of Light & Spherical Mirrors',
      'Refraction of Light & Spherical Lenses',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 10,
    topics: [
      'Structure and Functioning of the Human Eye',
      'Defects of Vision and their Correction',
      'Refraction of Light through a Prism',
      'Dispersion of White Light',
      'Atmospheric Refraction',
      'Scattering of Light',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 11,
    topics: [
      'Electric Charge & Electric Current',
      'Electric Potential & Potential Difference',
      'Electric Circuit',
      "Ohm's Law & Resistance",
      'Combination of Resistors (Series & Parallel)',
      'Heating Effect of Electric Current',
      'Electric Power & Energy',
    ],
  },
  {
    subject: 'science',
    chapterNumber: 12,
    topics: [
      'Magnetic Field & Field Lines',
      'Magnetic Field Due to Current-Carrying Conductors',
      'Force on a Current-Carrying Conductor in Magnetic Field',
      'Electric Motor',
      'Electromagnetic Induction',
      'Electric Generator',
      'Domestic Electric Circuits & Safety',
    ],
  },

  // ── English ───────────────────────────────────────────────────────────────
  {
    subject: 'english',
    chapterNumber: 1,
    topics: ['Characters', 'Setting', 'Plot Summary', 'Themes', 'Literary Devices'],
  },
  {
    subject: 'english',
    chapterNumber: 2,
    topics: [
      'Background & Context (Apartheid)',
      'The Historic Inauguration (10 May 1994)',
      "Mandela's Inaugural Address",
      'Themes & Symbolism',
    ],
  },
  {
    subject: 'english',
    chapterNumber: 3,
    topics: ['His First Flight', 'The Black Aeroplane'],
  },
  {
    subject: 'english',
    chapterNumber: 4,
    topics: [
      'Anne Frank: The Author',
      'Historical Context: World War II',
      'Life in Hiding (The Annex)',
      'The Diary Itself',
      "Anne's Motivation for Writing",
      'The Search for a True Friend',
    ],
  },
  {
    subject: 'english',
    chapterNumber: 5,
    topics: ['A Baker from Goa', 'Coorg', 'Tea from Assam'],
  },
  {
    subject: 'english',
    chapterNumber: 6,
    topics: [
      'The Author & His Need for a Pet',
      'Getting Mijbil',
      'Travelling with Mijbil',
      'Life with Mijbil in London',
      'Themes & Literary Devices',
    ],
  },
  {
    subject: 'english',
    chapterNumber: 7,
    topics: [
      'Valliammai (Valli) — Character',
      'Preparing for the Bus Journey',
      'The Bus Journey (Going)',
      'The Return Journey & Realisation',
      'Themes',
    ],
  },
  {
    subject: 'english',
    chapterNumber: 8,
    topics: [
      "Buddha's Early Life & Enlightenment",
      "The Sermon: Kisa Gotami's Story",
      'The Message of the Sermon',
      'Themes',
    ],
  },
  {
    subject: 'english',
    chapterNumber: 9,
    topics: [
      'Genre & Author (Chekhov)',
      'Characters',
      'The Three Quarrels (Plot)',
      'Themes & Humour',
    ],
  },
];

export function getTopicsForChapter(subject: string, chapterNumber: number): string[] {
  const entry = CHAPTER_TOPICS.find(
    (ct) => ct.subject === subject && ct.chapterNumber === chapterNumber,
  );
  return entry?.topics ?? [];
}
