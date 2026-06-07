import type { ChordCandidate, ChordQuality } from "./chordDetection";
import {
  areChordsEquivalent,
  chordSymbol,
  chordToneNames,
  type ChordQuality as TheoryChordQuality,
} from "./chordTheory";
import { pitchClass, pitchClassName } from "./noteEvents";

export type ChordConceptType =
  | "secondaryDominant"
  | "diatonic"
  | "borrowedIv"
  | "modalMixture"
  | "tritoneSubstitution"
  | "diminishedPassing";

export type ChordSuggestion = {
  id: string;
  root: number;
  quality: TheoryChordQuality;
  symbol: string;
  romanNumeral: string;
  context: string;
  concept: ChordConceptType;
  resolutionTarget?: string;
  chordTones: string[];
};

export type HarmonySuggestionOptions = {
  keyRoot?: number;
  chordHistory?: ChordCandidate[];
  random?: () => number;
};

type MajorKeyDegree = {
  offset: number;
  quality: Extract<ChordQuality, "major" | "minor" | "diminished">;
  romanNumeral: string;
  priority: number;
};

type ConceptGenerator = {
  concept: ChordConceptType;
  priorityGroup: SuggestionPriorityGroup;
  create: (context: GeneratorContext) => ChordSuggestion[];
};

type SuggestionPriorityGroup = "nondiatonic" | "modalMixture" | "diatonic";

type GeneratorContext = {
  detectedChord: ChordCandidate;
  keyRoot: number;
};

type SuggestionDefinition = {
  concept: ChordConceptType;
  root: number;
  quality: TheoryChordQuality;
  romanNumeral: string;
  context: string;
  resolutionRoot?: number;
  resolutionQuality?: TheoryChordQuality;
};

const DEFAULT_KEY_ROOT = 0;
const MAJOR_KEY_TRIADS: MajorKeyDegree[] = [
  { offset: 0, quality: "major", romanNumeral: "I", priority: 5 },
  { offset: 2, quality: "minor", romanNumeral: "ii", priority: 2 },
  { offset: 4, quality: "minor", romanNumeral: "iii", priority: 3 },
  { offset: 5, quality: "major", romanNumeral: "IV", priority: 4 },
  { offset: 7, quality: "major", romanNumeral: "V", priority: 1 },
  { offset: 9, quality: "minor", romanNumeral: "vi", priority: 0 },
  { offset: 11, quality: "diminished", romanNumeral: "vii°", priority: 6 },
];

const CONCEPT_GENERATORS: ConceptGenerator[] = [
  {
    concept: "secondaryDominant",
    priorityGroup: "nondiatonic",
    create: createSecondaryDominantSuggestions,
  },
  {
    concept: "borrowedIv",
    priorityGroup: "nondiatonic",
    create: createBorrowedIvSuggestions,
  },
  {
    concept: "modalMixture",
    priorityGroup: "modalMixture",
    create: createModalMixtureSuggestions,
  },
  {
    concept: "tritoneSubstitution",
    priorityGroup: "nondiatonic",
    create: createTritoneSubstitutionSuggestions,
  },
  {
    concept: "diminishedPassing",
    priorityGroup: "nondiatonic",
    create: createDiminishedPassingSuggestions,
  },
  {
    concept: "diatonic",
    priorityGroup: "diatonic",
    create: createDiatonicSuggestions,
  },
];

export function suggestNextChords(
  detectedChord: ChordCandidate | null,
  options: HarmonySuggestionOptions = {},
): ChordSuggestion[] {
  if (!detectedChord) {
    return [];
  }

  const keyRoot = options.keyRoot ?? DEFAULT_KEY_ROOT;
  const random = options.random ?? Math.random;
  const historyResolution = createHistoryResolutionSuggestion(
    detectedChord,
    keyRoot,
    options.chordHistory ?? [],
  );

  if (historyResolution) {
    return [historyResolution];
  }

  const directResolution = createDirectResolutionSuggestion(detectedChord, keyRoot);

  if (directResolution) {
    return [directResolution];
  }

  const generatedSuggestions = createGeneratedSuggestions(detectedChord, keyRoot);
  const uniqueSuggestions = dedupeSuggestions(generatedSuggestions);
  const nondiatonicSuggestions = uniqueSuggestions
    .filter((entry) => entry.priorityGroup === "nondiatonic")
    .map((entry) => entry.suggestion);
  const modalMixtureSuggestions = uniqueSuggestions
    .filter((entry) => entry.priorityGroup === "modalMixture")
    .map((entry) => entry.suggestion);
  const diatonicSuggestions = uniqueSuggestions
    .filter((entry) => entry.priorityGroup === "diatonic")
    .map((entry) => entry.suggestion);

  return [
    ...shuffleSuggestions(nondiatonicSuggestions, random),
    ...shuffleSuggestions(modalMixtureSuggestions, random),
    ...shuffleSuggestions(diatonicSuggestions, random),
  ];
}

function createGeneratedSuggestions(
  detectedChord: ChordCandidate,
  keyRoot: number,
): { suggestion: ChordSuggestion; priorityGroup: SuggestionPriorityGroup }[] {
  const context: GeneratorContext = { detectedChord, keyRoot };

  return CONCEPT_GENERATORS.flatMap((generator) =>
    generator.create(context).map((suggestion) => ({
      suggestion,
      priorityGroup: generator.priorityGroup,
    })),
  );
}

function createSecondaryDominantSuggestions({
  detectedChord,
  keyRoot,
}: GeneratorContext): ChordSuggestion[] {
  return MAJOR_KEY_TRIADS.filter(
    (target) =>
      target.offset !== 0 &&
      target.romanNumeral !== "iii" &&
      target.quality !== "diminished",
  )
    .map((target) => {
      const targetRoot = pitchClass(keyRoot + target.offset);
      const root = pitchClass(targetRoot + 7);

      return createSuggestion({
        concept: "secondaryDominant",
        root,
        quality: "dominant7",
        romanNumeral: `V/${target.romanNumeral} → ${target.romanNumeral}`,
        context: `Secondary dominant → ${chordSymbol(targetRoot, target.quality)}`,
        resolutionRoot: targetRoot,
        resolutionQuality: target.quality,
      });
    })
    .filter(
      (suggestion) =>
        !isDiatonicMajorRoot(symbolRoot(suggestion.symbol), keyRoot) &&
        !isCurrentChordSuggestion(suggestion, detectedChord),
    )
    .sort(byMajorKeyTargetPriority(keyRoot));
}

function createBorrowedIvSuggestions({
  detectedChord,
  keyRoot,
}: GeneratorContext): ChordSuggestion[] {
  const suggestion = createSuggestion({
    concept: "borrowedIv",
    root: pitchClass(keyRoot + 5),
    quality: "minor",
    romanNumeral: "iv → I",
    context: `Borrowed iv → ${chordSymbol(keyRoot, "major")}`,
    resolutionRoot: keyRoot,
    resolutionQuality: "major",
  });

  return isCurrentChordSuggestion(suggestion, detectedChord) ? [] : [suggestion];
}

function createModalMixtureSuggestions({
  detectedChord,
  keyRoot,
}: GeneratorContext): ChordSuggestion[] {
  return [
    createSuggestion({
      concept: "modalMixture",
      root: pitchClass(keyRoot + 10),
      quality: "major",
      romanNumeral: "bVII",
      context: "Modal mixture from parallel minor",
    }),
    createSuggestion({
      concept: "modalMixture",
      root: pitchClass(keyRoot + 8),
      quality: "major",
      romanNumeral: "bVI",
      context: "Modal mixture from parallel minor",
    }),
    createSuggestion({
      concept: "modalMixture",
      root: pitchClass(keyRoot + 3),
      quality: "major",
      romanNumeral: "bIII",
      context: "Modal mixture from parallel minor",
    }),
  ].filter((suggestion) => !isCurrentChordSuggestion(suggestion, detectedChord));
}

function createTritoneSubstitutionSuggestions({
  detectedChord,
  keyRoot,
}: GeneratorContext): ChordSuggestion[] {
  return MAJOR_KEY_TRIADS.filter(
    (target) => target.romanNumeral === "I" || target.romanNumeral === "V",
  )
    .map((target) => {
      const targetRoot = pitchClass(keyRoot + target.offset);
      const root = pitchClass(targetRoot + 1);

      return createSuggestion({
        concept: "tritoneSubstitution",
        root,
        quality: "dominant7",
        romanNumeral: `subV/${target.romanNumeral} → ${target.romanNumeral}`,
        context: `Tritone substitution → ${chordSymbol(targetRoot, target.quality)}`,
        resolutionRoot: targetRoot,
        resolutionQuality: target.quality,
      });
    })
    .filter((suggestion) => !isCurrentChordSuggestion(suggestion, detectedChord));
}

function createDiminishedPassingSuggestions({
  detectedChord,
  keyRoot,
}: GeneratorContext): ChordSuggestion[] {
  return [
    {
      root: pitchClass(keyRoot + 1),
      romanNumeral: "#i°7 → ii",
      resolutionDegree: MAJOR_KEY_TRIADS[1],
    },
    {
      root: pitchClass(keyRoot + 6),
      romanNumeral: "#iv°7 → V",
      resolutionDegree: MAJOR_KEY_TRIADS[4],
    },
    {
      root: pitchClass(keyRoot + 8),
      romanNumeral: "#v°7 → vi",
      resolutionDegree: MAJOR_KEY_TRIADS[5],
    },
  ]
    .filter((definition) => definition.resolutionDegree !== undefined)
    .filter(
      (definition) =>
        definition.root === pitchClass(detectedChord.root + 1),
    )
    .map((definition) => {
      const resolutionRoot = pitchClass(
        keyRoot + definition.resolutionDegree.offset,
      );

      return createSuggestion({
        concept: "diminishedPassing",
        root: definition.root,
        quality: "diminished7",
        romanNumeral: definition.romanNumeral,
        context: `Diminished passing chord → ${chordSymbol(
          resolutionRoot,
          definition.resolutionDegree.quality,
        )}`,
        resolutionRoot,
        resolutionQuality: definition.resolutionDegree.quality,
      });
    })
    .filter((suggestion) => !isCurrentChordSuggestion(suggestion, detectedChord));
}

function createDiatonicSuggestions({
  detectedChord,
  keyRoot,
}: GeneratorContext): ChordSuggestion[] {
  return MAJOR_KEY_TRIADS.filter((degree) => degree.romanNumeral !== "vii°")
    .map((degree) =>
      createSuggestion({
        concept: "diatonic",
        root: pitchClass(keyRoot + degree.offset),
        quality: degree.quality,
        romanNumeral: degree.romanNumeral,
        context: "Diatonic",
      }),
    )
    .filter((suggestion) => !isCurrentChordSuggestion(suggestion, detectedChord))
    .sort(
      (a, b) =>
        diatonicPriority(a.symbol, keyRoot) -
        diatonicPriority(b.symbol, keyRoot),
    );
}

function createDirectResolutionSuggestion(
  detectedChord: ChordCandidate,
  keyRoot: number,
): ChordSuggestion | null {
  if (isDiatonicChord(detectedChord, keyRoot)) {
    return null;
  }

  if (
    detectedChord.quality !== "major" &&
    detectedChord.quality !== "dominant7"
  ) {
    return null;
  }

  const target = MAJOR_KEY_TRIADS.filter(
    (degree) =>
      degree.offset !== 0 &&
      degree.romanNumeral !== "iii" &&
      degree.quality !== "diminished",
  ).find(
    (degree) =>
      pitchClass(keyRoot + degree.offset + 7) === detectedChord.root &&
      !isDiatonicMajorRoot(detectedChord.root, keyRoot),
  );

  if (!target) {
    return null;
  }

  const targetRoot = pitchClass(keyRoot + target.offset);

  return createSuggestion({
    concept: "secondaryDominant",
    root: targetRoot,
    quality: target.quality,
    romanNumeral: target.romanNumeral,
    context: `Resolution from ${chordSymbol(detectedChord.root, "dominant7")}`,
  });
}

function createHistoryResolutionSuggestion(
  detectedChord: ChordCandidate,
  keyRoot: number,
  chordHistory: ChordCandidate[],
): ChordSuggestion | null {
  const previousChord = chordHistory[chordHistory.length - 1];

  if (!previousChord) {
    return null;
  }

  const matchedPriorSuggestion = createGeneratedSuggestions(previousChord, keyRoot)
    .map((entry) => entry.suggestion)
    .find(
      (suggestion) =>
        areChordsEquivalent(suggestion, detectedChord) &&
        suggestion.resolutionTarget !== undefined,
    );

  if (!matchedPriorSuggestion?.resolutionTarget) {
    return null;
  }

  const resolutionDegree = MAJOR_KEY_TRIADS.find((degree) => {
    const root = pitchClass(keyRoot + degree.offset);

    return (
      chordSymbol(root, degree.quality) === matchedPriorSuggestion.resolutionTarget
    );
  });

  if (!resolutionDegree) {
    return null;
  }

  const resolutionRoot = pitchClass(keyRoot + resolutionDegree.offset);

  return createSuggestion({
    concept: matchedPriorSuggestion.concept,
    root: resolutionRoot,
    quality: resolutionDegree.quality,
    romanNumeral: resolutionDegree.romanNumeral,
    context: `Resolution from ${matchedPriorSuggestion.symbol}`,
  });
}

function createSuggestion(definition: SuggestionDefinition): ChordSuggestion {
  const symbol = chordSymbol(definition.root, definition.quality);
  const resolutionTarget =
    definition.resolutionRoot === undefined ||
    definition.resolutionQuality === undefined
      ? undefined
      : chordSymbol(definition.resolutionRoot, definition.resolutionQuality);

  return {
    id: [
      definition.concept,
      pitchClassName(definition.root),
      symbol,
      resolutionTarget,
    ]
      .filter(Boolean)
      .join("-"),
    symbol,
    root: definition.root,
    quality: definition.quality,
    romanNumeral: definition.romanNumeral,
    context: definition.context,
    concept: definition.concept,
    resolutionTarget,
    chordTones: chordToneNames(definition.root, definition.quality),
  };
}

function dedupeSuggestions(
  suggestions: {
    suggestion: ChordSuggestion;
    priorityGroup: SuggestionPriorityGroup;
  }[],
): { suggestion: ChordSuggestion; priorityGroup: SuggestionPriorityGroup }[] {
  const seen = new Set<string>();
  const uniqueSuggestions: {
    suggestion: ChordSuggestion;
    priorityGroup: SuggestionPriorityGroup;
  }[] = [];

  for (const entry of suggestions) {
    const key = `${entry.suggestion.symbol}-${entry.suggestion.concept}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueSuggestions.push(entry);
    }
  }

  return uniqueSuggestions;
}

function isDiatonicChord(chord: ChordCandidate, keyRoot: number): boolean {
  return MAJOR_KEY_TRIADS.some(
    (degree) =>
      pitchClass(keyRoot + degree.offset) === chord.root &&
      degree.quality === chord.quality,
  );
}

function isCurrentChordSuggestion(
  suggestion: ChordSuggestion,
  chord: ChordCandidate,
): boolean {
  return areChordsEquivalent(suggestion, chord);
}

function isDiatonicMajorRoot(root: number, keyRoot: number): boolean {
  return MAJOR_KEY_TRIADS.some(
    (degree) =>
      degree.quality === "major" &&
      pitchClass(keyRoot + degree.offset) === root,
  );
}

function byMajorKeyTargetPriority(
  keyRoot: number,
): (a: ChordSuggestion, b: ChordSuggestion) => number {
  return (a, b) =>
    secondaryDominantPriority(a.symbol, keyRoot) -
    secondaryDominantPriority(b.symbol, keyRoot);
}

function secondaryDominantPriority(symbol: string, keyRoot: number): number {
  return (
    MAJOR_KEY_TRIADS.find((degree) => {
      const targetRoot = pitchClass(keyRoot + degree.offset);
      const dominantRoot = pitchClass(targetRoot + 7);

      return symbol === chordSymbol(dominantRoot, "dominant7");
    })?.priority ?? 99
  );
}

function diatonicPriority(symbol: string, keyRoot: number): number {
  return (
    MAJOR_KEY_TRIADS.find((degree) => {
      const root = pitchClass(keyRoot + degree.offset);

      return symbol === chordSymbol(root, degree.quality);
    })?.priority ?? 99
  );
}

function symbolRoot(symbol: string): number {
  return noteNameToPitchClass(symbol);
}

function noteNameToPitchClass(symbol: string): number {
  const noteName = symbol.match(/^[A-G]#?/)?.[0];

  if (!noteName) {
    return 0;
  }

  const pitchClasses = new Map<string, number>(
    Array.from({ length: 12 }, (_, pitchClassValue) => [
      pitchClassName(pitchClassValue),
      pitchClassValue,
    ]),
  );

  return pitchClasses.get(noteName) ?? 0;
}

function shuffleSuggestions<T>(suggestions: T[], random: () => number): T[] {
  const shuffled = [...suggestions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
