import type { ChordCandidate, ChordQuality } from "./chordDetection";
import {
  areChordsEquivalent,
  chordSymbol,
  chordToneNames,
  type ChordQuality as TheoryChordQuality,
} from "./chordTheory";
import type { KeyMode } from "./key";
import { pitchClass, pitchClassName } from "./noteEvents";

export type ChordConceptType =
  | "secondaryDominant"
  | "diatonic"
  | "borrowedIv"
  | "modalMixture"
  | "tritoneSubstitution"
  | "diminishedPassing"
  | "harmonicMinorDominant"
  | "neapolitan"
  | "picardyThird";

export type SelectedChordConcept = ChordConceptType | "automatic";

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
  keyMode?: KeyMode;
  chordHistory?: ChordCandidate[];
  recentSuggestionIds?: string[];
  selectedConcept?: SelectedChordConcept;
  random?: () => number;
};

type KeyDegree = {
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
  keyMode: KeyMode;
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
const DEFAULT_KEY_MODE: KeyMode = "major";
const DEFAULT_SELECTED_CONCEPT: SelectedChordConcept = "automatic";
const MAJOR_KEY_TRIADS: KeyDegree[] = [
  { offset: 0, quality: "major", romanNumeral: "I", priority: 5 },
  { offset: 2, quality: "minor", romanNumeral: "ii", priority: 2 },
  { offset: 4, quality: "minor", romanNumeral: "iii", priority: 3 },
  { offset: 5, quality: "major", romanNumeral: "IV", priority: 4 },
  { offset: 7, quality: "major", romanNumeral: "V", priority: 1 },
  { offset: 9, quality: "minor", romanNumeral: "vi", priority: 0 },
  { offset: 11, quality: "diminished", romanNumeral: "vii°", priority: 6 },
];
const MINOR_KEY_TRIADS: KeyDegree[] = [
  { offset: 0, quality: "minor", romanNumeral: "i", priority: 5 },
  { offset: 2, quality: "diminished", romanNumeral: "ii°", priority: 6 },
  { offset: 3, quality: "major", romanNumeral: "bIII", priority: 3 },
  { offset: 5, quality: "minor", romanNumeral: "iv", priority: 2 },
  { offset: 7, quality: "minor", romanNumeral: "v", priority: 4 },
  { offset: 8, quality: "major", romanNumeral: "bVI", priority: 1 },
  { offset: 10, quality: "major", romanNumeral: "bVII", priority: 0 },
];
const MINOR_SECONDARY_DOMINANT_TARGETS: KeyDegree[] = [
  { offset: 3, quality: "major", romanNumeral: "bIII", priority: 3 },
  { offset: 5, quality: "minor", romanNumeral: "iv", priority: 0 },
  { offset: 7, quality: "major", romanNumeral: "V", priority: 1 },
  { offset: 8, quality: "major", romanNumeral: "bVI", priority: 4 },
  { offset: 10, quality: "major", romanNumeral: "bVII", priority: 2 },
];

const CONCEPT_GENERATORS: ConceptGenerator[] = [
  {
    concept: "secondaryDominant",
    priorityGroup: "nondiatonic",
    create: createSecondaryDominantSuggestions,
  },
  {
    concept: "harmonicMinorDominant",
    priorityGroup: "nondiatonic",
    create: createHarmonicMinorDominantSuggestions,
  },
  {
    concept: "neapolitan",
    priorityGroup: "nondiatonic",
    create: createNeapolitanSuggestions,
  },
  {
    concept: "picardyThird",
    priorityGroup: "nondiatonic",
    create: createPicardyThirdSuggestions,
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
  const keyMode = options.keyMode ?? DEFAULT_KEY_MODE;
  const selectedConcept = options.selectedConcept ?? DEFAULT_SELECTED_CONCEPT;
  const recentSuggestionIds = options.recentSuggestionIds ?? [];
  const random = options.random ?? Math.random;
  const historyResolution = createHistoryResolutionSuggestion(
    detectedChord,
    keyRoot,
    keyMode,
    options.chordHistory ?? [],
  );

  if (historyResolution) {
    return [historyResolution];
  }

  const directResolution = createDirectResolutionSuggestion(
    detectedChord,
    keyRoot,
    keyMode,
  );

  if (directResolution) {
    return [directResolution];
  }

  const generatedSuggestions = createGeneratedSuggestions(
    detectedChord,
    keyRoot,
    keyMode,
  );
  const uniqueSuggestions = dedupeSuggestions(generatedSuggestions);

  return chooseWeightedSuggestions(uniqueSuggestions, {
    chordHistory: options.chordHistory ?? [],
    random,
    recentSuggestionIds,
    selectedConcept,
  });
}

function createGeneratedSuggestions(
  detectedChord: ChordCandidate,
  keyRoot: number,
  keyMode: KeyMode,
): { suggestion: ChordSuggestion; priorityGroup: SuggestionPriorityGroup }[] {
  const context: GeneratorContext = { detectedChord, keyRoot, keyMode };

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
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  const targets =
    keyMode === "minor"
      ? MINOR_SECONDARY_DOMINANT_TARGETS
      : MAJOR_KEY_TRIADS.filter(
          (target) =>
            target.offset !== 0 &&
            target.romanNumeral !== "iii" &&
            target.quality !== "diminished",
        );

  return targets
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
        !isDiatonicMajorRoot(symbolRoot(suggestion.symbol), keyRoot, keyMode) &&
        !isCurrentChordSuggestion(suggestion, detectedChord),
    )
    .sort(byKeyTargetPriority(keyRoot, targets));
}

function createBorrowedIvSuggestions({
  detectedChord,
  keyRoot,
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  if (keyMode !== "major") {
    return [];
  }

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
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  const suggestions =
    keyMode === "minor"
      ? [
          createSuggestion({
            concept: "modalMixture",
            root: pitchClass(keyRoot + 5),
            quality: "major",
            romanNumeral: "IV",
            context: "Modal mixture from parallel major",
          }),
          createSuggestion({
            concept: "modalMixture",
            root: pitchClass(keyRoot + 2),
            quality: "minor",
            romanNumeral: "ii",
            context: "Modal mixture from parallel major",
          }),
        ]
      : [
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
        ];

  return suggestions.filter(
    (suggestion) => !isCurrentChordSuggestion(suggestion, detectedChord),
  );
}

function createTritoneSubstitutionSuggestions({
  detectedChord,
  keyRoot,
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  const targets =
    keyMode === "minor"
      ? [
          { offset: 0, quality: "minor" as const, romanNumeral: "i", priority: 0 },
          { offset: 7, quality: "major" as const, romanNumeral: "V", priority: 1 },
        ]
      : MAJOR_KEY_TRIADS.filter(
          (target) => target.romanNumeral === "I" || target.romanNumeral === "V",
        );

  return targets
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
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  if (keyMode !== "major") {
    return [];
  }

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
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  const degrees = keyMode === "minor" ? MINOR_KEY_TRIADS : MAJOR_KEY_TRIADS;

  return degrees.filter((degree) => degree.romanNumeral !== "vii°")
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

function createHarmonicMinorDominantSuggestions({
  detectedChord,
  keyRoot,
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  if (keyMode !== "minor") {
    return [];
  }

  return [
    createSuggestion({
      concept: "harmonicMinorDominant",
      root: pitchClass(keyRoot + 7),
      quality: "dominant7",
      romanNumeral: "V7 → i",
      context: `Harmonic minor dominant → ${chordSymbol(keyRoot, "minor")}`,
      resolutionRoot: keyRoot,
      resolutionQuality: "minor",
    }),
    createSuggestion({
      concept: "harmonicMinorDominant",
      root: pitchClass(keyRoot + 11),
      quality: "diminished7",
      romanNumeral: "vii°7 → i",
      context: `Leading-tone diminished seventh → ${chordSymbol(keyRoot, "minor")}`,
      resolutionRoot: keyRoot,
      resolutionQuality: "minor",
    }),
  ].filter((suggestion) => !isCurrentChordSuggestion(suggestion, detectedChord));
}

function createNeapolitanSuggestions({
  detectedChord,
  keyRoot,
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  if (keyMode !== "minor") {
    return [];
  }

  const suggestion = createSuggestion({
    concept: "neapolitan",
    root: pitchClass(keyRoot + 1),
    quality: "major",
    romanNumeral: "bII → V",
    context: `Neapolitan predominant → ${chordSymbol(
      pitchClass(keyRoot + 7),
      "dominant7",
    )}`,
    resolutionRoot: pitchClass(keyRoot + 7),
    resolutionQuality: "dominant7",
  });

  return isCurrentChordSuggestion(suggestion, detectedChord) ? [] : [suggestion];
}

function createPicardyThirdSuggestions({
  detectedChord,
  keyRoot,
  keyMode,
}: GeneratorContext): ChordSuggestion[] {
  if (keyMode !== "minor") {
    return [];
  }

  const suggestion = createSuggestion({
    concept: "picardyThird",
    root: keyRoot,
    quality: "major",
    romanNumeral: "I",
    context: `Picardy third color on ${chordSymbol(keyRoot, "minor")}`,
    resolutionRoot: keyRoot,
    resolutionQuality: "minor",
  });

  return isCurrentChordSuggestion(suggestion, detectedChord) ? [] : [suggestion];
}

function createDirectResolutionSuggestion(
  detectedChord: ChordCandidate,
  keyRoot: number,
  keyMode: KeyMode,
): ChordSuggestion | null {
  if (keyMode === "minor") {
    if (
      detectedChord.root === pitchClass(keyRoot + 7) &&
      detectedChord.quality === "dominant7"
    ) {
      return createSuggestion({
        concept: "harmonicMinorDominant",
        root: keyRoot,
        quality: "minor",
        romanNumeral: "i",
        context: `Resolution from ${chordSymbol(
          pitchClass(keyRoot + 7),
          "dominant7",
        )}`,
      });
    }

    if (
      detectedChord.root === pitchClass(keyRoot + 11) &&
      detectedChord.quality === "diminished7"
    ) {
      return createSuggestion({
        concept: "harmonicMinorDominant",
        root: keyRoot,
        quality: "minor",
        romanNumeral: "i",
        context: `Resolution from ${chordSymbol(
          pitchClass(keyRoot + 11),
          "diminished7",
        )}`,
      });
    }

    if (
      detectedChord.root === pitchClass(keyRoot + 1) &&
      detectedChord.quality === "major"
    ) {
      return createSuggestion({
        concept: "neapolitan",
        root: pitchClass(keyRoot + 7),
        quality: "dominant7",
        romanNumeral: "V7",
        context: `Resolution from ${chordSymbol(
          pitchClass(keyRoot + 1),
          "major",
        )}`,
      });
    }

    if (detectedChord.root === keyRoot && detectedChord.quality === "major") {
      return createSuggestion({
        concept: "picardyThird",
        root: keyRoot,
        quality: "minor",
        romanNumeral: "i",
        context: `Resolution from ${chordSymbol(keyRoot, "major")}`,
      });
    }
  }

  if (isDiatonicChord(detectedChord, keyRoot, keyMode)) {
    return null;
  }

  if (
    detectedChord.quality !== "major" &&
    detectedChord.quality !== "dominant7"
  ) {
    return null;
  }

  const targets =
    keyMode === "minor"
      ? MINOR_SECONDARY_DOMINANT_TARGETS
      : MAJOR_KEY_TRIADS.filter(
          (degree) =>
            degree.offset !== 0 &&
            degree.romanNumeral !== "iii" &&
            degree.quality !== "diminished",
        );

  const target = targets.find(
    (degree) =>
      pitchClass(keyRoot + degree.offset + 7) === detectedChord.root &&
      !isDiatonicMajorRoot(detectedChord.root, keyRoot, keyMode),
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
  keyMode: KeyMode,
  chordHistory: ChordCandidate[],
): ChordSuggestion | null {
  const previousChord = chordHistory[chordHistory.length - 1];

  if (!previousChord) {
    return null;
  }

  const matchedPriorSuggestion = createGeneratedSuggestions(
    previousChord,
    keyRoot,
    keyMode,
  )
    .map((entry) => entry.suggestion)
    .find(
      (suggestion) =>
        areChordsEquivalent(suggestion, detectedChord) &&
        suggestion.resolutionTarget !== undefined,
    );

  if (!matchedPriorSuggestion?.resolutionTarget) {
    return null;
  }

  const resolutionDegree = [
    ...MAJOR_KEY_TRIADS,
    ...MINOR_KEY_TRIADS,
    ...MINOR_SECONDARY_DOMINANT_TARGETS,
  ].find((degree) => {
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

function chooseWeightedSuggestions(
  suggestions: {
    suggestion: ChordSuggestion;
    priorityGroup: SuggestionPriorityGroup;
  }[],
  options: {
    chordHistory: ChordCandidate[];
    random: () => number;
    recentSuggestionIds: string[];
    selectedConcept: SelectedChordConcept;
  },
): ChordSuggestion[] {
  const weightedSuggestions = suggestions.map((entry, index) => ({
    ...entry,
    index,
    weight: suggestionWeight(entry, options),
  }));
  const orderedSuggestions: ChordSuggestion[] = [];

  while (weightedSuggestions.length > 0) {
    const selectedIndex = weightedRandomIndex(
      weightedSuggestions.map((entry) => entry.weight),
      options.random,
    );
    const [selectedEntry] = weightedSuggestions.splice(selectedIndex, 1);

    if (selectedEntry) {
      orderedSuggestions.push(selectedEntry.suggestion);
    }
  }

  return orderedSuggestions;
}

function suggestionWeight(
  entry: {
    suggestion: ChordSuggestion;
    priorityGroup: SuggestionPriorityGroup;
  },
  options: {
    chordHistory: ChordCandidate[];
    recentSuggestionIds: string[];
    selectedConcept: SelectedChordConcept;
  },
): number {
  let weight = priorityGroupWeight(entry.priorityGroup);

  if (
    options.selectedConcept !== "automatic" &&
    entry.suggestion.concept === options.selectedConcept
  ) {
    weight *= 8;
  }

  if (options.recentSuggestionIds.includes(entry.suggestion.id)) {
    weight *= 0.2;
  }

  if (wasRecentlyPlayed(entry.suggestion, options.chordHistory)) {
    weight *= 0.35;
  }

  return Math.max(weight, 0.01);
}

function priorityGroupWeight(priorityGroup: SuggestionPriorityGroup): number {
  switch (priorityGroup) {
    case "nondiatonic":
      return 12;
    case "modalMixture":
      return 6;
    case "diatonic":
      return 3;
  }
}

function weightedRandomIndex(weights: number[], random: () => number): number {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let threshold = clampRandom(random()) * totalWeight;

  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index] ?? 0;

    if (threshold <= 0) {
      return index;
    }
  }

  return Math.max(0, weights.length - 1);
}

function clampRandom(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 0.999999);
}

function wasRecentlyPlayed(
  suggestion: ChordSuggestion,
  chordHistory: ChordCandidate[],
): boolean {
  return chordHistory.slice(-8).some((chord) => areChordsEquivalent(suggestion, chord));
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

function isDiatonicChord(
  chord: ChordCandidate,
  keyRoot: number,
  keyMode: KeyMode,
): boolean {
  const degrees = keyMode === "minor" ? MINOR_KEY_TRIADS : MAJOR_KEY_TRIADS;

  return degrees.some(
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

function isDiatonicMajorRoot(
  root: number,
  keyRoot: number,
  keyMode: KeyMode,
): boolean {
  const degrees = keyMode === "minor" ? MINOR_KEY_TRIADS : MAJOR_KEY_TRIADS;

  return degrees.some(
    (degree) =>
      degree.quality === "major" &&
      pitchClass(keyRoot + degree.offset) === root,
  );
}

function byKeyTargetPriority(
  keyRoot: number,
  targets: KeyDegree[],
): (a: ChordSuggestion, b: ChordSuggestion) => number {
  return (a, b) =>
    secondaryDominantPriority(a.symbol, keyRoot, targets) -
    secondaryDominantPriority(b.symbol, keyRoot, targets);
}

function secondaryDominantPriority(
  symbol: string,
  keyRoot: number,
  targets: KeyDegree[],
): number {
  return (
    targets.find((degree) => {
      const targetRoot = pitchClass(keyRoot + degree.offset);
      const dominantRoot = pitchClass(targetRoot + 7);

      return symbol === chordSymbol(dominantRoot, "dominant7");
    })?.priority ?? 99
  );
}

function diatonicPriority(symbol: string, keyRoot: number): number {
  return (
    [...MAJOR_KEY_TRIADS, ...MINOR_KEY_TRIADS].find((degree) => {
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
