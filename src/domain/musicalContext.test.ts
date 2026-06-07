import { describe, expect, it } from "vitest";
import {
  createInitialMusicalContext,
  updateMusicalContext,
} from "./musicalContext";
import { replayNoteEvents } from "./replay";
import type { NoteInputEvent } from "./noteEvents";

describe("musical context", () => {
  it("tracks detected chords chronologically", () => {
    const initialContext = createInitialMusicalContext();
    const cContext = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
    );
    const amContext = updateMusicalContext(
      cContext,
      replayNoteEvents([noteOn(69, 0), noteOn(72, 100), noteOn(76, 200)]),
    );

    expect(amContext.chordHistory.map((chord) => chord.symbol)).toEqual([
      "C",
      "Am",
    ]);
  });

  it("does not duplicate consecutive chord detections", () => {
    const initialContext = createInitialMusicalContext();
    const cNotes = replayNoteEvents([
      noteOn(60, 0),
      noteOn(64, 100),
      noteOn(67, 200),
    ]);
    const firstContext = updateMusicalContext(initialContext, cNotes);
    const secondContext = updateMusicalContext(firstContext, cNotes);

    expect(secondContext.chordHistory.map((chord) => chord.symbol)).toEqual([
      "C",
    ]);
  });

  it("keeps visible suggestions when note evidence is released or expires", () => {
    const initialContext = createInitialMusicalContext();
    const cContext = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
    );
    const emptyContext = updateMusicalContext(cContext, replayNoteEvents([]));

    expect(cContext.visibleSuggestions.length).toBeGreaterThan(0);
    expect(emptyContext.chordDetection.best).toBeNull();
    expect(emptyContext.visibleSuggestions).toEqual(cContext.visibleSuggestions);
  });

  it("uses the selected key when updating detection and suggestions", () => {
    const initialContext = createInitialMusicalContext({ keyRoot: 7 });
    const context = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(67, 0), noteOn(71, 100), noteOn(74, 200)]),
      { keyRoot: 7 },
    );

    expect(context.keyRoot).toBe(7);
    expect(context.chordDetection.best?.symbol).toBe("G");
    expect(context.visibleSuggestions[0]).toMatchObject({
      symbol: "B7",
      context: "Secondary dominant -> Em",
    });
  });
});

function noteOn(note: number, timestampMs: number): NoteInputEvent {
  return { type: "noteOn", note, velocity: 100, timestampMs };
}
