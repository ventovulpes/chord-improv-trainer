import {
  pitchClass,
  type NoteInputEvent,
} from "./noteEvents";
import type { NoteState } from "./noteState";
import {
  CHORD_TEMPLATES,
  areChordsEquivalent,
  chordSymbol,
  chordTonePitchClasses,
  type ChordQuality,
} from "./chordTheory";
import type { KeyMode } from "./key";

export type { ChordQuality } from "./chordTheory";

export type ChordCandidate = {
  root: number;
  quality: ChordQuality;
  symbol: string;
  confidence: number;
  matchedPitchClasses: number[];
  missingPitchClasses: number[];
};

export type ChordDetectionResult = {
  best: ChordCandidate | null;
  alternatives: ChordCandidate[];
};

export type ChordDetectionOptions = {
  keyRoot?: number;
  keyMode?: KeyMode;
  previousChord?: ChordCandidate | null;
};

const DEFAULT_KEY_ROOT = 0;
const DEFAULT_KEY_MODE: KeyMode = "major";
const MAJOR_SCALE_DIATONIC_QUALITIES = new Map<number, ChordQuality>([
  [0, "major"],
  [2, "minor"],
  [4, "minor"],
  [5, "major"],
  [7, "major"],
  [9, "minor"],
]);
const NATURAL_MINOR_SCALE_DIATONIC_QUALITIES = new Map<number, ChordQuality>([
  [0, "minor"],
  [2, "diminished"],
  [3, "major"],
  [5, "minor"],
  [7, "minor"],
  [8, "major"],
  [10, "major"],
]);

const MIN_CONFIDENT_MATCHES = 3;
const MIN_CONFIDENCE = 0.8;
const PERFECT_FIFTH_CONFIDENCE = 0.66;
const ALTERNATIVE_CONFIDENCE_FLOOR = 0.65;
const ALTERNATIVE_CONFIDENCE_GAP = 0.25;
const PREVIOUS_CHORD_STABILITY_GAP = 0.2;

export function detectChordFromNoteState(
  noteState: NoteState,
  options: ChordDetectionOptions = {},
): ChordDetectionResult {
  return detectChordFromEvents(
    noteState.recentEvents,
    noteState.likelyBassNote === null
      ? undefined
      : pitchClass(noteState.likelyBassNote),
    options,
  );
}

export function detectChordFromEvents(
  events: NoteInputEvent[],
  preferredRoot?: number,
  options: ChordDetectionOptions = {},
): ChordDetectionResult {
  const evidencePitchClasses = collectEvidencePitchClasses(events);

  if (evidencePitchClasses.length < MIN_CONFIDENT_MATCHES) {
    const perfectFifthCandidate = inferPerfectFifthCandidate(
      evidencePitchClasses,
      preferredRoot,
      options.keyRoot ?? DEFAULT_KEY_ROOT,
      options.keyMode ?? DEFAULT_KEY_MODE,
    );

    if (perfectFifthCandidate) {
      return { best: perfectFifthCandidate, alternatives: [] };
    }

    return { best: null, alternatives: [] };
  }

  const candidates = scoreChordCandidates(evidencePitchClasses, preferredRoot);
  const best = chooseBestCandidate(candidates, options.previousChord);

  if (!best || best.confidence < MIN_CONFIDENCE) {
    return {
      best: null,
      alternatives: candidates.filter(
        (candidate) => candidate.confidence >= ALTERNATIVE_CONFIDENCE_FLOOR,
      ),
    };
  }

  return {
    best,
    alternatives: candidates
      .filter(
        (candidate) =>
          candidate.symbol !== best.symbol &&
          candidate.confidence >= ALTERNATIVE_CONFIDENCE_FLOOR &&
          best.confidence - candidate.confidence <= ALTERNATIVE_CONFIDENCE_GAP,
      )
      .slice(0, 3),
  };
}

function collectEvidencePitchClasses(events: NoteInputEvent[]): number[] {
  const pitchClasses = new Set<number>();

  for (const event of events) {
    if (event.type === "noteOn" && event.velocity > 0) {
      pitchClasses.add(pitchClass(event.note));
    }
  }

  return [...pitchClasses].sort((a, b) => a - b);
}

function scoreChordCandidates(
  evidencePitchClasses: number[],
  preferredRoot?: number,
): ChordCandidate[] {
  const evidenceSet = new Set(evidencePitchClasses);
  const candidates: ChordCandidate[] = [];

  for (let root = 0; root < 12; root += 1) {
    for (const template of CHORD_TEMPLATES) {
      const chordTones = template.intervals.map((interval) =>
        pitchClass(root + interval),
      );
      const matchedPitchClasses = chordTones.filter((tone) =>
        evidenceSet.has(tone),
      );
      const missingPitchClasses = chordTones.filter(
        (tone) => !evidenceSet.has(tone),
      );
      const extraPitchClassCount = evidencePitchClasses.filter(
        (tone) => !chordTones.includes(tone),
      ).length;
      const completeness = matchedPitchClasses.length / chordTones.length;
      const extraPenalty = extraPitchClassCount * 0.16;
      const confidence = clamp(completeness - extraPenalty, 0, 1);

      candidates.push({
        root,
        quality: template.quality,
        symbol: chordSymbol(root, template.quality),
        confidence,
        matchedPitchClasses,
        missingPitchClasses,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }

    if (b.matchedPitchClasses.length !== a.matchedPitchClasses.length) {
      return b.matchedPitchClasses.length - a.matchedPitchClasses.length;
    }

    const normalizedPreferredRoot =
      preferredRoot === undefined ? undefined : pitchClass(preferredRoot);

    if (normalizedPreferredRoot !== undefined) {
      if (a.root === normalizedPreferredRoot && b.root !== normalizedPreferredRoot) {
        return -1;
      }

      if (b.root === normalizedPreferredRoot && a.root !== normalizedPreferredRoot) {
        return 1;
      }
    }

    return a.symbol.localeCompare(b.symbol);
  });
}

function chooseBestCandidate(
  candidates: ChordCandidate[],
  previousChord: ChordCandidate | null | undefined,
): ChordCandidate | null {
  const leadingCandidate = candidates[0] ?? null;

  if (!leadingCandidate || !previousChord) {
    return leadingCandidate;
  }

  const previousCandidate = candidates.find(
    (candidate) => areChordsEquivalent(candidate, previousChord),
  );

  if (
    previousCandidate &&
    leadingCandidate.confidence - previousCandidate.confidence <=
      PREVIOUS_CHORD_STABILITY_GAP
  ) {
    return previousCandidate;
  }

  return leadingCandidate;
}

function inferPerfectFifthCandidate(
  evidencePitchClasses: number[],
  preferredRoot: number | undefined,
  keyRoot: number,
  keyMode: KeyMode,
): ChordCandidate | null {
  if (evidencePitchClasses.length !== 2) {
    return null;
  }

  const [firstPitchClass, secondPitchClass] = evidencePitchClasses;

  if (firstPitchClass === undefined || secondPitchClass === undefined) {
    return null;
  }

  const normalizedPreferredRoot =
    preferredRoot === undefined ? undefined : pitchClass(preferredRoot);
  const inferredRoot =
    normalizedPreferredRoot !== undefined &&
    evidencePitchClasses.includes(normalizedPreferredRoot) &&
    evidencePitchClasses.includes(pitchClass(normalizedPreferredRoot + 7))
      ? normalizedPreferredRoot
      : findPerfectFifthRoot(firstPitchClass, secondPitchClass);

  if (inferredRoot === null) {
    return null;
  }

  const quality = diatonicTriadQuality(inferredRoot, keyRoot, keyMode);

  if (!quality) {
    return null;
  }

  const chordTones = chordTonePitchClasses(inferredRoot, quality);
  const matchedPitchClasses = chordTones.filter((tone) =>
    evidencePitchClasses.includes(tone),
  );
  const missingPitchClasses = chordTones.filter(
    (tone) => !evidencePitchClasses.includes(tone),
  );

  return {
    root: inferredRoot,
    quality,
    symbol: chordSymbol(inferredRoot, quality),
    confidence: PERFECT_FIFTH_CONFIDENCE,
    matchedPitchClasses,
    missingPitchClasses,
  };
}

function findPerfectFifthRoot(
  firstPitchClass: number,
  secondPitchClass: number,
): number | null {
  if (pitchClass(firstPitchClass + 7) === secondPitchClass) {
    return firstPitchClass;
  }

  if (pitchClass(secondPitchClass + 7) === firstPitchClass) {
    return secondPitchClass;
  }

  return null;
}

function diatonicTriadQuality(
  root: number,
  keyRoot: number,
  keyMode: KeyMode,
): ChordQuality | null {
  const scaleDegree = pitchClass(root - keyRoot);
  const qualities =
    keyMode === "minor"
      ? NATURAL_MINOR_SCALE_DIATONIC_QUALITIES
      : MAJOR_SCALE_DIATONIC_QUALITIES;

  return qualities.get(scaleDegree) ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
