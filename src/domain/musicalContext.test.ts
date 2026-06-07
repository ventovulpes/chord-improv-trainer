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

  it("keeps suggestion order when the same chord is still detected after notes are released", () => {
    const initialContext = createInitialMusicalContext();
    const cContext = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
    );
    const releasedContext = updateMusicalContext(
      cContext,
      replayNoteEvents([
        noteOn(60, 0),
        noteOn(64, 100),
        noteOn(67, 200),
        noteOff(60, 300),
        noteOff(64, 300),
        noteOff(67, 300),
      ]),
    );

    expect(releasedContext.chordDetection.best?.symbol).toBe("C");
    expect(releasedContext.visibleSuggestions).toEqual(
      cContext.visibleSuggestions,
    );
  });

  it("treats seventh chords as equivalent to their triad counterparts in context", () => {
    const initialContext = createInitialMusicalContext();
    const cContext = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
    );
    const cMajorSevenContext = updateMusicalContext(
      cContext,
      replayNoteEvents([
        noteOn(60, 0),
        noteOn(64, 100),
        noteOn(67, 200),
        noteOn(71, 300),
      ]),
    );

    expect(cMajorSevenContext.chordDetection.best?.symbol).toBe("Cmaj7");
    expect(cMajorSevenContext.chordHistory.map((chord) => chord.symbol)).toEqual([
      "C",
    ]);
    expect(cMajorSevenContext.visibleSuggestions).toEqual(
      cContext.visibleSuggestions,
    );
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
    expect(context.visibleSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "B7",
          context: "Secondary dominant → Em",
        }),
      ]),
    );
  });

  it("passes selected concept into visible suggestions", () => {
    const initialContext = createInitialMusicalContext();
    const context = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
      {
        selectedConcept: "secondaryDominant",
      },
    );

    expect(context.selectedConcept).toBe("secondaryDominant");
    expect(context.visibleSuggestions[0]).toEqual(
      expect.objectContaining({
        concept: "secondaryDominant",
      }),
    );
  });

  it("refreshes visible suggestions when the selected concept changes", () => {
    const initialContext = createInitialMusicalContext();
    const cContext = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
    );
    const selectedConceptContext = updateMusicalContext(
      cContext,
      replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(67, 200)]),
      { selectedConcept: "tritoneSubstitution" },
    );

    expect(selectedConceptContext.visibleSuggestions).not.toEqual(
      cContext.visibleSuggestions,
    );
    expect(selectedConceptContext.visibleSuggestions[0]?.concept).toBe(
      "tritoneSubstitution",
    );
  });

  it("uses chord history to suggest the resolution of a previously suggested passing chord", () => {
    const initialContext = createInitialMusicalContext();
    const fContext = updateMusicalContext(
      initialContext,
      replayNoteEvents([noteOn(65, 0), noteOn(69, 100), noteOn(72, 200)]),
    );
    const passingChordContext = updateMusicalContext(
      fContext,
      replayNoteEvents([
        noteOn(66, 0),
        noteOn(69, 100),
        noteOn(72, 200),
        noteOn(75, 300),
      ]),
    );

    expect(passingChordContext.chordDetection.best?.symbol).toBe("F#dim7");
    expect(passingChordContext.visibleSuggestions).toEqual([
      expect.objectContaining({
        symbol: "G",
        concept: "diminishedPassing",
        context: "Resolution from F#dim7",
      }),
    ]);
  });
});

function noteOn(note: number, timestampMs: number): NoteInputEvent {
  return { type: "noteOn", note, velocity: 100, timestampMs };
}

function noteOff(note: number, timestampMs: number): NoteInputEvent {
  return { type: "noteOff", note, velocity: 0, timestampMs };
}
