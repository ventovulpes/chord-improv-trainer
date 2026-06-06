import {
  applyNoteEvent,
  createInitialNoteState,
  type NoteState,
  type NoteStateOptions,
} from "./noteState";
import type { TestNoteEvent } from "./noteEvents";

export function replayNoteEvents(
  events: TestNoteEvent[],
  options: NoteStateOptions = {},
  initialState: NoteState = createInitialNoteState(),
): NoteState {
  return [...events]
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .reduce(
      (state, event) => applyNoteEvent(state, event, options),
      initialState,
    );
}
