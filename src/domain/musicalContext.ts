import {
  detectChordFromNoteState,
  type ChordCandidate,
  type ChordDetectionResult,
} from "./chordDetection";
import {
  suggestNextChords,
  type ChordSuggestion,
} from "./harmonySuggestions";
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
  const chordDetection = detectChordFromNoteState(noteState, { keyRoot });
  const chordSuggestions = suggestNextChords(chordDetection.best, {
    keyRoot,
  });

  return {
    keyRoot,
    chordDetection,
    chordHistory: appendDetectedChord(context.chordHistory, chordDetection.best),
    visibleSuggestions:
      chordSuggestions.length > 0
        ? chordSuggestions
        : context.visibleSuggestions,
  };
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
    lastPlayedChord.root === detectedChord.root &&
    lastPlayedChord.quality === detectedChord.quality
  ) {
    return chordHistory;
  }

  return [...chordHistory, detectedChord].slice(-MAX_CHORD_HISTORY);
}
