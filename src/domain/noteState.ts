import { pitchClass, type TestNoteEvent } from "./noteEvents";

export const DEFAULT_RECENT_WINDOW_MS = 2000;

export type ActiveNote = {
  note: number;
  velocity: number;
  startedAtMs: number;
};

export type NoteState = {
  activeNotes: ActiveNote[];
  recentEvents: TestNoteEvent[];
  recentPitchClasses: number[];
};

export type NoteStateOptions = {
  recentWindowMs?: number;
};

export const initialNoteState: NoteState = {
  activeNotes: [],
  recentEvents: [],
  recentPitchClasses: [],
};

export function createInitialNoteState(): NoteState {
  return {
    activeNotes: [],
    recentEvents: [],
    recentPitchClasses: [],
  };
}

export function resetNoteState(): NoteState {
  return createInitialNoteState();
}

export function applyNoteEvent(
  state: NoteState,
  event: TestNoteEvent,
  options: NoteStateOptions = {},
): NoteState {
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
  };
}

function applyActiveNoteEvent(
  activeNotes: ActiveNote[],
  event: TestNoteEvent,
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
  events: TestNoteEvent[],
  nowMs: number,
  recentWindowMs: number,
): TestNoteEvent[] {
  const oldestAllowedMs = nowMs - recentWindowMs;

  return events.filter((event) => event.timestampMs >= oldestAllowedMs);
}

function collectRecentPitchClasses(events: TestNoteEvent[]): number[] {
  const pitchClasses = new Set<number>();

  for (const event of events) {
    if (event.type === "noteOn" && event.velocity > 0) {
      pitchClasses.add(pitchClass(event.note));
    }
  }

  return [...pitchClasses].sort((a, b) => a - b);
}
