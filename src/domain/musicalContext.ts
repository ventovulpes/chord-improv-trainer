import {
  detectChordFromNoteState,
  type ChordCandidate,
  type ChordDetectionResult,
} from "./chordDetection";
import {
  suggestNextChords,
  type ChordSuggestion,
} from "./harmonySuggestions";
import { areChordsEquivalent } from "./chordTheory";
import type { NoteState } from "./noteState";

export const DEFAULT_KEY_ROOT = 0;
export const MAX_CHORD_HISTORY = 24;

export type MusicalContext = {
  keyRoot: number;
  chordDetection: ChordDetectionResult;
  chordHistory: ChordCandidate[];
  visibleSuggestions: ChordSuggestion[];
};

export type MusicalContextOptions = {
  keyRoot?: number;
};

const EMPTY_CHORD_DETECTION: ChordDetectionResult = {
  best: null,
  alternatives: [],
};

export function createInitialMusicalContext(
  options: MusicalContextOptions = {},
): MusicalContext {
  return {
    keyRoot: options.keyRoot ?? DEFAULT_KEY_ROOT,
    chordDetection: EMPTY_CHORD_DETECTION,
    chordHistory: [],
    visibleSuggestions: [],
  };
}

export function resetMusicalContext(
  options: MusicalContextOptions = {},
): MusicalContext {
  return createInitialMusicalContext(options);
}

export function updateMusicalContext(
  context: MusicalContext,
  noteState: NoteState,
  options: MusicalContextOptions = {},
): MusicalContext {
  const keyRoot = options.keyRoot ?? context.keyRoot;
  const previousChord = context.chordHistory[context.chordHistory.length - 1];
  const stableChordDetection = detectChordFromNoteState(noteState, {
    keyRoot,
    previousChord,
  });
  const chordSuggestions = suggestNextChords(stableChordDetection.best, {
    chordHistory: context.chordHistory,
    keyRoot,
  });
  const visibleSuggestions = chooseVisibleSuggestions(
    context,
    stableChordDetection.best,
    chordSuggestions,
    keyRoot,
  );

  return {
    keyRoot,
    chordDetection: stableChordDetection,
    chordHistory: appendDetectedChord(
      context.chordHistory,
      stableChordDetection.best,
    ),
    visibleSuggestions,
  };
}

function chooseVisibleSuggestions(
  context: MusicalContext,
  detectedChord: ChordCandidate | null,
  chordSuggestions: ChordSuggestion[],
  keyRoot: number,
): ChordSuggestion[] {
  if (chordSuggestions.length === 0) {
    return context.visibleSuggestions;
  }

  if (keyRoot !== context.keyRoot) {
    return chordSuggestions;
  }

  const lastKnownChord =
    context.chordDetection.best ??
    context.chordHistory[context.chordHistory.length - 1] ??
    null;

  if (
    detectedChord &&
    lastKnownChord &&
    areChordsEquivalent(lastKnownChord, detectedChord) &&
    context.visibleSuggestions.length > 0
  ) {
    return context.visibleSuggestions;
  }

  return chordSuggestions;
}

function appendDetectedChord(
  chordHistory: ChordCandidate[],
  detectedChord: ChordCandidate | null,
): ChordCandidate[] {
  if (!detectedChord) {
    return chordHistory;
  }

  const lastPlayedChord = chordHistory[chordHistory.length - 1];

  if (
    lastPlayedChord &&
    areChordsEquivalent(lastPlayedChord, detectedChord)
  ) {
    return chordHistory;
  }

  return [...chordHistory, detectedChord].slice(-MAX_CHORD_HISTORY);
}
