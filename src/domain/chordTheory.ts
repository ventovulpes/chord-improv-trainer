import { pitchClass, pitchClassName } from "./noteEvents";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "dominant7"
  | "major7"
  | "minor7"
  | "halfDiminished7"
  | "diminished7"
  | "sus2"
  | "sus4";

export type ChordTemplate = {
  quality: ChordQuality;
  intervals: number[];
};

export const CHORD_TEMPLATES: ChordTemplate[] = [
  { quality: "major7", intervals: [0, 4, 7, 11] },
  { quality: "dominant7", intervals: [0, 4, 7, 10] },
  { quality: "minor7", intervals: [0, 3, 7, 10] },
  { quality: "halfDiminished7", intervals: [0, 3, 6, 10] },
  { quality: "diminished7", intervals: [0, 3, 6, 9] },
  { quality: "major", intervals: [0, 4, 7] },
  { quality: "minor", intervals: [0, 3, 7] },
  { quality: "diminished", intervals: [0, 3, 6] },
  { quality: "augmented", intervals: [0, 4, 8] },
  { quality: "sus2", intervals: [0, 2, 7] },
  { quality: "sus4", intervals: [0, 5, 7] },
];

export function chordTonePitchClasses(
  root: number,
  quality: ChordQuality,
): number[] {
  const template = CHORD_TEMPLATES.find(
    (candidate) => candidate.quality === quality,
  );

  if (!template) {
    return [];
  }

  return template.intervals.map((interval) => pitchClass(root + interval));
}

export function chordToneNames(root: number, quality: ChordQuality): string[] {
  return chordTonePitchClasses(root, quality).map((tone) =>
    pitchClassName(tone),
  );
}

export function chordSymbol(root: number, quality: ChordQuality): string {
  const rootName = pitchClassName(root);

  switch (quality) {
    case "major":
      return rootName;
    case "minor":
      return `${rootName}m`;
    case "diminished":
      return `${rootName}dim`;
    case "augmented":
      return `${rootName}aug`;
    case "dominant7":
      return `${rootName}7`;
    case "major7":
      return `${rootName}maj7`;
    case "minor7":
      return `${rootName}m7`;
    case "halfDiminished7":
      return `${rootName}m7b5`;
    case "diminished7":
      return `${rootName}dim7`;
    case "sus2":
      return `${rootName}sus2`;
    case "sus4":
      return `${rootName}sus4`;
  }
}

export function equivalentTriadQuality(
  quality: ChordQuality,
): ChordQuality {
  switch (quality) {
    case "dominant7":
    case "major7":
      return "major";
    case "minor7":
      return "minor";
    case "halfDiminished7":
    case "diminished7":
      return "diminished";
    default:
      return quality;
  }
}

export function areChordQualitiesEquivalent(
  firstQuality: ChordQuality,
  secondQuality: ChordQuality,
): boolean {
  return (
    equivalentTriadQuality(firstQuality) ===
    equivalentTriadQuality(secondQuality)
  );
}

export function areChordsEquivalent(
  firstChord: { root: number; quality: ChordQuality },
  secondChord: { root: number; quality: ChordQuality },
): boolean {
  return (
    pitchClass(firstChord.root) === pitchClass(secondChord.root) &&
    areChordQualitiesEquivalent(firstChord.quality, secondChord.quality)
  );
}
