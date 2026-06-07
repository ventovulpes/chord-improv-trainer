import { describe, expect, it } from "vitest";
import {
  applyNoteEvent,
  createInitialNoteState,
  resetNoteState,
} from "./noteState";
import { normalizeMidiMessage } from "./midiMessages";
import { replayNoteEvents } from "./replay";
import type { AppInputEvent, NoteInputEvent } from "./noteEvents";

describe("note state", () => {
  it("press C → active notes include C", () => {
    const state = applyNoteEvent(createInitialNoteState(), noteOn(60, 0));

    expect(state.activeNotes).toEqual([
      { note: 60, velocity: 100, startedAtMs: 0 },
    ]);
  });

  it("release C → active notes remove C", () => {
    const pressed = applyNoteEvent(createInitialNoteState(), noteOn(60, 0));
    const released = applyNoteEvent(pressed, noteOff(60, 100));

    expect(released.activeNotes).toEqual([]);
  });

  it("play C E G → recent pitch classes include C E G", () => {
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
    const populated = replayNoteEvents([
      noteOn(60, 0),
      noteOn(64, 100),
      sustainChange(true, 200),
    ]);

    expect(populated.activeNotes.length).toBeGreaterThan(0);
    expect(populated.isSustainDown).toBe(true);
    expect(resetNoteState()).toEqual({
      activeNotes: [],
      recentEvents: [],
      recentPitchClasses: [],
      isSustainDown: false,
      likelyBassNote: null,
      likelyMelodyNote: null,
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

  it("sustain events toggle sustain state without changing note history", () => {
    const sustained = applyNoteEvent(
      createInitialNoteState(),
      sustainChange(true, 0),
    );
    const released = applyNoteEvent(sustained, sustainChange(false, 100));

    expect(sustained.isSustainDown).toBe(true);
    expect(sustained.recentEvents).toEqual([]);
    expect(released.isSustainDown).toBe(false);
  });

  it("tracks likely bass and melody notes from recent evidence", () => {
    const state = replayNoteEvents([
      noteOn(72, 0),
      noteOn(48, 100),
      noteOn(64, 200),
    ]);

    expect(state.likelyBassNote).toBe(48);
    expect(state.likelyMelodyNote).toBe(72);
  });

  it("updates likely melody immediately when a held upper note changes", () => {
    const state = replayNoteEvents([
      noteOn(24, 0),
      noteOn(55, 100),
      noteOff(55, 200),
      noteOn(53, 300),
    ]);

    expect(state.activeNotes.map((activeNote) => activeNote.note)).toEqual([
      24,
      53,
    ]);
    expect(state.likelyBassNote).toBe(24);
    expect(state.likelyMelodyNote).toBe(53);
  });

  it("expires bass and melody evidence with the recent window", () => {
    const state = replayNoteEvents(
      [noteOn(48, 0), noteOff(48, 100), noteOn(72, 1500)],
      { recentWindowMs: 1000 },
    );

    expect(state.likelyBassNote).toBe(72);
    expect(state.likelyMelodyNote).toBe(72);
  });

  it("applies fake events and MIDI-normalized events through the same path", () => {
    const fakeState = replayNoteEvents([
      noteOn(60, 0),
      noteOn(64, 100),
      noteOff(60, 200),
    ]);
    const midiEvents = [
      normalizeMidiMessage([0x90, 60, 100], 0),
      normalizeMidiMessage([0x90, 64, 100], 100),
      normalizeMidiMessage([0x80, 60, 64], 200),
    ].filter(isAppInputEvent);
    const midiState = replayNoteEvents(midiEvents);

    expect(midiState).toEqual(fakeState);
  });
});

function noteOn(note: number, timestampMs: number): NoteInputEvent {
  return { type: "noteOn", note, velocity: 100, timestampMs };
}

function noteOff(note: number, timestampMs: number): NoteInputEvent {
  return { type: "noteOff", note, velocity: 0, timestampMs };
}

function sustainChange(isDown: boolean, timestampMs: number) {
  return { type: "sustainChange" as const, isDown, timestampMs };
}

function isAppInputEvent(event: AppInputEvent | null): event is AppInputEvent {
  return event !== null;
}
