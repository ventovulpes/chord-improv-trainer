import { describe, expect, it } from "vitest";
import {
  applyNoteEvent,
  createInitialNoteState,
  resetNoteState,
} from "./noteState";
import { replayNoteEvents } from "./replay";
import type { TestNoteEvent } from "./noteEvents";

describe("note state", () => {
  it("press C -> active notes include C", () => {
    const state = applyNoteEvent(createInitialNoteState(), noteOn(60, 0));

    expect(state.activeNotes).toEqual([
      { note: 60, velocity: 100, startedAtMs: 0 },
    ]);
  });

  it("release C -> active notes remove C", () => {
    const pressed = applyNoteEvent(createInitialNoteState(), noteOn(60, 0));
    const released = applyNoteEvent(pressed, noteOff(60, 100));

    expect(released.activeNotes).toEqual([]);
  });

  it("play C E G -> recent pitch classes include C E G", () => {
    const state = replayNoteEvents([
      noteOn(60, 0),
      noteOn(64, 100),
      noteOn(67, 200),
    ]);

    expect(state.recentPitchClasses).toEqual([0, 4, 7]);
  });

  it("old notes expire from recent window", () => {
    const state = replayNoteEvents(
      [noteOn(60, 0), noteOn(64, 1200), noteOn(67, 2100)],
      { recentWindowMs: 1000 },
    );

    expect(state.recentEvents.map((event) => event.note)).toEqual([64, 67]);
    expect(state.recentPitchClasses).toEqual([4, 7]);
  });

  it("reset clears state", () => {
    const populated = replayNoteEvents([noteOn(60, 0), noteOn(64, 100)]);

    expect(populated.activeNotes.length).toBeGreaterThan(0);
    expect(resetNoteState()).toEqual({
      activeNotes: [],
      recentEvents: [],
      recentPitchClasses: [],
    });
  });

  it("replay applies events in timestamp order", () => {
    const state = replayNoteEvents([
      noteOff(60, 200),
      noteOn(60, 0),
      noteOn(64, 100),
    ]);

    expect(state.activeNotes.map((activeNote) => activeNote.note)).toEqual([
      64,
    ]);
  });
});

function noteOn(note: number, timestampMs: number): TestNoteEvent {
  return { type: "noteOn", note, velocity: 100, timestampMs };
}

function noteOff(note: number, timestampMs: number): TestNoteEvent {
  return { type: "noteOff", note, velocity: 0, timestampMs };
}
