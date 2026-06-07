import type { ChordCandidate } from "./chordDetection";
import { pitchClass, pitchClassName } from "./noteEvents";

export type ChordSuggestion = {
  id: string;
  symbol: string;
  romanNumeral: string;
  context: string;
  chordTones: string[];
};

export type HarmonySuggestionOptions = {
  keyRoot?: number;
};

type MajorKeyDegree = {
  offset: number;
  quality: "major" | "minor";
  romanNumeral: string;
  priority: number;
};

type SecondaryDominantSuggestion = ChordSuggestion & {
  dominantRoot: number;
  resolutionRoot: number;
  resolutionQuality: MajorKeyDegree["quality"];
  resolutionRomanNumeral: string;
};

const DEFAULT_KEY_ROOT = 0;
const MAJOR_KEY_TRIADS: MajorKeyDegree[] = [
  { offset: 0, quality: "major", romanNumeral: "I", priority: 5 },
  { offset: 2, quality: "minor", romanNumeral: "ii", priority: 2 },
  { offset: 4, quality: "minor", romanNumeral: "iii", priority: 3 },
  { offset: 5, quality: "major", romanNumeral: "IV", priority: 4 },
  { offset: 7, quality: "major", romanNumeral: "V", priority: 1 },
  { offset: 9, quality: "minor", romanNumeral: "vi", priority: 0 },
];

export function suggestNextChords(
  detectedChord: ChordCandidate | null,
  options: HarmonySuggestionOptions = {},
): ChordSuggestion[] {
  if (!detectedChord) {
    return [];
  }

  const keyRoot = options.keyRoot ?? DEFAULT_KEY_ROOT;
  const secondaryDominants = createSecondaryDominantSuggestions(keyRoot);
  const directSecondaryDominant = secondaryDominants.find(
    (suggestion) => suggestion.dominantRoot === detectedChord.root,
  );

  if (directSecondaryDominant && !isDiatonicChord(detectedChord, keyRoot)) {
    return [createResolutionSuggestion(directSecondaryDominant, keyRoot)];
  }

  return [
    ...secondaryDominants.map(stripDominantRoot),
    ...createDiatonicSuggestions(detectedChord, keyRoot),
  ];
}

function createSecondaryDominantSuggestions(
  keyRoot: number,
): SecondaryDominantSuggestion[] {
  return MAJOR_KEY_TRIADS.filter(
    (target) => target.offset !== 0 && target.romanNumeral !== "iii",
  )
    .map((target) => {
      const targetRoot = pitchClass(keyRoot + target.offset);
      const dominantRoot = pitchClass(targetRoot + 7);
      const symbol = `${pitchClassName(dominantRoot)}7`;
      const resolutionTarget = chordSymbol(targetRoot, target.quality);

      return {
        id: `secondary-dominant-${pitchClassName(keyRoot)}-${symbol}-${resolutionTarget}`,
        symbol,
        romanNumeral: `V/${target.romanNumeral} -> ${target.romanNumeral}`,
        context: `Secondary dominant -> ${resolutionTarget}`,
        chordTones: chordToneNames(dominantRoot, "dominant7"),
        dominantRoot,
        resolutionRoot: targetRoot,
        resolutionQuality: target.quality,
        resolutionRomanNumeral: target.romanNumeral,
      };
    })
    .filter(
      (suggestion) => !isDiatonicMajorRoot(suggestion.dominantRoot, keyRoot),
    )
    .sort(
      (a, b) =>
        secondaryDominantPriority(a.symbol, keyRoot) -
        secondaryDominantPriority(b.symbol, keyRoot),
    );
}

function createResolutionSuggestion(
  suggestion: SecondaryDominantSuggestion,
  keyRoot: number,
): ChordSuggestion {
  const resolutionSymbol = chordSymbol(
    suggestion.resolutionRoot,
    suggestion.resolutionQuality,
  );

  return {
    id: `resolution-${pitchClassName(keyRoot)}-${suggestion.symbol}-${resolutionSymbol}`,
    symbol: resolutionSymbol,
    romanNumeral: suggestion.resolutionRomanNumeral,
    context: `Resolution from ${suggestion.symbol}`,
    chordTones: chordToneNames(
      suggestion.resolutionRoot,
      suggestion.resolutionQuality,
    ),
  };
}

function createDiatonicSuggestions(
  detectedChord: ChordCandidate,
  keyRoot: number,
): ChordSuggestion[] {
  return MAJOR_KEY_TRIADS.filter((degree) => {
    const root = pitchClass(keyRoot + degree.offset);

    return (
      root !== detectedChord.root || degree.quality !== detectedChord.quality
    );
  })
    .map((degree) => {
      const root = pitchClass(keyRoot + degree.offset);
      const symbol = chordSymbol(root, degree.quality);

      return {
        id: `diatonic-${pitchClassName(keyRoot)}-${symbol}`,
        symbol,
        romanNumeral: degree.romanNumeral,
        context: "Diatonic",
        chordTones: chordToneNames(root, degree.quality),
      };
    })
    .sort(
      (a, b) =>
        diatonicPriority(a.symbol, keyRoot) -
        diatonicPriority(b.symbol, keyRoot),
    );
}

function isDiatonicChord(chord: ChordCandidate, keyRoot: number): boolean {
  return MAJOR_KEY_TRIADS.some(
    (degree) =>
      pitchClass(keyRoot + degree.offset) === chord.root &&
      degree.quality === chord.quality,
  );
}

function isDiatonicMajorRoot(root: number, keyRoot: number): boolean {
  return MAJOR_KEY_TRIADS.some(
    (degree) =>
      degree.quality === "major" &&
      pitchClass(keyRoot + degree.offset) === root,
  );
}

function secondaryDominantPriority(symbol: string, keyRoot: number): number {
  return (
    MAJOR_KEY_TRIADS.find((degree) => {
      const targetRoot = pitchClass(keyRoot + degree.offset);
      const dominantRoot = pitchClass(targetRoot + 7);

      return symbol === `${pitchClassName(dominantRoot)}7`;
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

function chordSymbol(root: number, quality: "major" | "minor"): string {
  const rootName = pitchClassName(root);

  return quality === "minor" ? `${rootName}m` : rootName;
}

function chordToneNames(
  root: number,
  quality: "major" | "minor" | "dominant7",
): string[] {
  const intervals =
    quality === "minor"
      ? [0, 3, 7]
      : quality === "dominant7"
        ? [0, 4, 7, 10]
        : [0, 4, 7];

  return intervals.map((interval) => pitchClassName(root + interval));
}

function stripDominantRoot({
  dominantRoot: _dominantRoot,
  resolutionRoot: _resolutionRoot,
  resolutionQuality: _resolutionQuality,
  resolutionRomanNumeral: _resolutionRomanNumeral,
  ...suggestion
}: SecondaryDominantSuggestion): ChordSuggestion {
  return suggestion;
}
