import {
  detectChordFromNoteState,
  type ChordCandidate,
  type ChordDetectionResult,
} from "./chordDetection";
import {
  suggestNextChords,
  type ChordSuggestion,
  type SelectedChordConcept,
} from "./harmonySuggestions";
import { areChordsEquivalent } from "./chordTheory";
import type { KeyMode } from "./key";
import type { NoteState } from "./noteState";

export const DEFAULT_KEY_ROOT = 0;
export const DEFAULT_KEY_MODE: KeyMode = "major";
export const MAX_CHORD_HISTORY = 24;

export type MusicalContext = {
  keyRoot: number;
  keyMode: KeyMode;
  selectedConcept: SelectedChordConcept;
  chordDetection: ChordDetectionResult;
  chordHistory: ChordCandidate[];
  visibleSuggestions: ChordSuggestion[];
};

export type MusicalContextOptions = {
  keyRoot?: number;
  keyMode?: KeyMode;
  random?: () => number;
  selectedConcept?: SelectedChordConcept;
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
    keyMode: options.keyMode ?? DEFAULT_KEY_MODE,
    selectedConcept: options.selectedConcept ?? "automatic",
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
  const keyMode = options.keyMode ?? context.keyMode;
  const selectedConcept = options.selectedConcept ?? context.selectedConcept;
  const previousChord = context.chordHistory[context.chordHistory.length - 1];
  const stableChordDetection = detectChordFromNoteState(noteState, {
    keyRoot,
    keyMode,
    previousChord,
  });
  const chordSuggestions = suggestNextChords(stableChordDetection.best, {
    chordHistory: context.chordHistory,
    keyRoot,
    keyMode,
    recentSuggestionIds: context.visibleSuggestions.map(
      (suggestion) => suggestion.id,
    ),
    random: options.random,
    selectedConcept,
  });
  const visibleSuggestions = chooseVisibleSuggestions(
    context,
    stableChordDetection.best,
    chordSuggestions,
    keyRoot,
    keyMode,
    selectedConcept,
  );

  return {
    keyRoot,
    keyMode,
    selectedConcept,
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
  keyMode: KeyMode,
  selectedConcept: SelectedChordConcept,
): ChordSuggestion[] {
  if (chordSuggestions.length === 0) {
    return context.visibleSuggestions;
  }

  if (
    keyRoot !== context.keyRoot ||
    keyMode !== context.keyMode ||
    selectedConcept !== context.selectedConcept
  ) {
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
