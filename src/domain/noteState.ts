import { pitchClass, type AppInputEvent, type NoteInputEvent } from "./noteEvents";

export const DEFAULT_RECENT_WINDOW_MS = 1000;

export type ActiveNote = {
  note: number;
  velocity: number;
  startedAtMs: number;
};

export type NoteState = {
  activeNotes: ActiveNote[];
  recentEvents: NoteInputEvent[];
  recentPitchClasses: number[];
  isSustainDown: boolean;
  likelyBassNote: number | null;
  likelyMelodyNote: number | null;
};

export type NoteStateOptions = {
  recentWindowMs?: number;
};

export const initialNoteState: NoteState = {
  activeNotes: [],
  recentEvents: [],
  recentPitchClasses: [],
  isSustainDown: false,
  likelyBassNote: null,
  likelyMelodyNote: null,
};

export function createInitialNoteState(): NoteState {
  return {
    activeNotes: [],
    recentEvents: [],
    recentPitchClasses: [],
    isSustainDown: false,
    likelyBassNote: null,
    likelyMelodyNote: null,
  };
}

export function resetNoteState(): NoteState {
  return createInitialNoteState();
}

export function applyNoteEvent(
  state: NoteState,
  event: AppInputEvent,
  options: NoteStateOptions = {},
): NoteState {
  if (event.type === "sustainChange") {
    return {
      ...state,
      isSustainDown: event.isDown,
    };
  }

  const recentWindowMs = options.recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS;
  const activeNotes = applyActiveNoteEvent(state.activeNotes, event);
  const recentEvents = expireOldEvents(
    [...state.recentEvents, event],
    event.timestampMs,
    recentWindowMs,
  );

  return {
    activeNotes,
    recentEvents,
    recentPitchClasses: collectRecentPitchClasses(recentEvents),
    isSustainDown: state.isSustainDown,
    likelyBassNote: findLikelyBassNote(activeNotes, recentEvents),
    likelyMelodyNote: findLikelyMelodyNote(activeNotes, recentEvents),
  };
}

function applyActiveNoteEvent(
  activeNotes: ActiveNote[],
  event: NoteInputEvent,
): ActiveNote[] {
  if (event.type === "noteOff" || event.velocity === 0) {
    return activeNotes.filter((activeNote) => activeNote.note !== event.note);
  }

  const nextNote: ActiveNote = {
    note: event.note,
    velocity: event.velocity,
    startedAtMs: event.timestampMs,
  };
  const otherNotes = activeNotes.filter(
    (activeNote) => activeNote.note !== event.note,
  );

  return [...otherNotes, nextNote].sort((a, b) => a.note - b.note);
}

function expireOldEvents(
  events: NoteInputEvent[],
  nowMs: number,
  recentWindowMs: number,
): NoteInputEvent[] {
  const oldestAllowedMs = nowMs - recentWindowMs;

  return events.filter((event) => event.timestampMs >= oldestAllowedMs);
}

function collectRecentPitchClasses(events: NoteInputEvent[]): number[] {
  const pitchClasses = new Set<number>();

  for (const event of events) {
    if (event.type === "noteOn" && event.velocity > 0) {
      pitchClasses.add(pitchClass(event.note));
    }
  }

  return [...pitchClasses].sort((a, b) => a - b);
}

function findLikelyBassNote(
  activeNotes: ActiveNote[],
  recentEvents: NoteInputEvent[],
): number | null {
  const notes = collectEvidenceNotes(activeNotes, recentEvents);

  return notes.length === 0 ? null : Math.min(...notes);
}

function findLikelyMelodyNote(
  activeNotes: ActiveNote[],
  recentEvents: NoteInputEvent[],
): number | null {
  const notes = collectEvidenceNotes(activeNotes, recentEvents);

  return notes.length === 0 ? null : Math.max(...notes);
}

function collectEvidenceNotes(
  activeNotes: ActiveNote[],
  recentEvents: NoteInputEvent[],
): number[] {
  if (activeNotes.length > 0) {
    return activeNotes.map((activeNote) => activeNote.note);
  }

  const notes = new Set<number>();

  for (const event of recentEvents) {
    if (event.type === "noteOn" && event.velocity > 0) {
      notes.add(event.note);
    }
  }

  return [...notes];
}
