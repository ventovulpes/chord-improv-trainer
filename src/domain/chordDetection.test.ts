import { describe, expect, it } from "vitest";
import {
  detectChordFromEvents,
  detectChordFromNoteState,
} from "./chordDetection";
import { replayNoteEvents } from "./replay";
import type { NoteInputEvent } from "./noteEvents";

describe("chord detection", () => {
  it("detects C major from a block chord", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(60, 0), noteOn(64, 0), noteOn(67, 0)]),
    );

    expect(detection.best?.symbol).toBe("C");
    expect(detection.best?.quality).toBe("major");
    expect(detection.best?.confidence).toBe(1);
  });

  it("detects A minor from a block chord", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(69, 0), noteOn(72, 0), noteOn(76, 0)]),
    );

    expect(detection.best?.symbol).toBe("Am");
    expect(detection.best?.quality).toBe("minor");
    expect(detection.best?.confidence).toBe(1);
  });

  it("detects C major from notes spread over 900ms", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(60, 0), noteOn(64, 450), noteOn(67, 900)]),
    );

    expect(detection.best?.symbol).toBe("C");
  });

  it("detects C major from a broken C G E G pattern", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([
        noteOn(60, 0),
        noteOn(67, 250),
        noteOn(64, 500),
        noteOn(67, 750),
      ]),
    );

    expect(detection.best?.symbol).toBe("C");
  });

  it("detects A minor from a broken A E C E pattern", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([
        noteOn(69, 0),
        noteOn(76, 250),
        noteOn(72, 500),
        noteOn(76, 750),
      ]),
    );

    expect(detection.best?.symbol).toBe("Am");
  });

  it("does not confidently detect a chord from only C and E", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(60, 0), noteOn(64, 250)]),
    );

    expect(detection.best).toBeNull();
    expect(detection.alternatives).toEqual([]);
  });

  it("detects C and G as a mid-confidence C major in the default key", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(60, 0), noteOn(67, 250)]),
    );

    expect(detection.best?.symbol).toBe("C");
    expect(detection.best?.quality).toBe("major");
    expect(detection.best?.confidence).toBe(0.66);
    expect(detection.best?.matchedPitchClasses).toEqual([0, 7]);
    expect(detection.best?.missingPitchClasses).toEqual([4]);
  });

  it("detects A and E as a mid-confidence A minor in the default key", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(69, 0), noteOn(76, 250)]),
    );

    expect(detection.best?.symbol).toBe("Am");
    expect(detection.best?.quality).toBe("minor");
    expect(detection.best?.confidence).toBe(0.66);
    expect(detection.best?.matchedPitchClasses).toEqual([9, 4]);
    expect(detection.best?.missingPitchClasses).toEqual([0]);
  });

  it("uses the configured major key to infer perfect-fifth quality", () => {
    const detection = detectChordFromEvents(
      [noteOn(62, 0), noteOn(69, 250)],
      undefined,
      { keyRoot: 7 },
    );

    expect(detection.best?.symbol).toBe("D");
    expect(detection.best?.quality).toBe("major");
  });

  it("uses the configured minor key to infer perfect-fifth quality", () => {
    const detection = detectChordFromEvents(
      [noteOn(69, 0), noteOn(76, 250)],
      undefined,
      { keyMode: "minor", keyRoot: 9 },
    );

    expect(detection.best?.symbol).toBe("Am");
    expect(detection.best?.quality).toBe("minor");
  });

  it("does not infer a quality for a non-diatonic perfect fifth", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([noteOn(61, 0), noteOn(68, 250)]),
    );

    expect(detection.best).toBeNull();
  });

  it("drops the detected chord after old evidence expires", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents(
        [
          noteOn(60, 0),
          noteOn(64, 250),
          noteOn(67, 500),
          noteOn(72, 3000),
        ],
        { recentWindowMs: 1000 },
      ),
    );

    expect(detection.best).toBeNull();
  });

  it("returns alternatives when the pitch-class set is ambiguous", () => {
    const detection = detectChordFromNoteState(
      replayNoteEvents([
        noteOn(60, 0),
        noteOn(64, 100),
        noteOn(67, 200),
        noteOn(69, 300),
      ]),
    );

    expect(detection.best?.symbol).toBe("Am7");
    expect(detection.best?.confidence).toBe(1);
    expect(detection.alternatives.map((candidate) => candidate.symbol)).toContain(
      "C",
    );
  });

  it("detects Phase 5 chord qualities", () => {
    expect(
      detectChordFromNoteState(
        replayNoteEvents([
          noteOn(64, 0),
          noteOn(68, 100),
          noteOn(71, 200),
          noteOn(74, 300),
        ]),
      ).best?.symbol,
    ).toBe("E7");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([
          noteOn(60, 0),
          noteOn(64, 100),
          noteOn(67, 200),
          noteOn(71, 300),
        ]),
      ).best?.symbol,
    ).toBe("Cmaj7");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([
          noteOn(71, 0),
          noteOn(74, 100),
          noteOn(77, 200),
          noteOn(81, 300),
        ]),
      ).best?.symbol,
    ).toBe("Bm7b5");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([noteOn(60, 0), noteOn(65, 100), noteOn(67, 200)]),
      ).best?.symbol,
    ).toBe("Csus4");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([noteOn(60, 0), noteOn(62, 100), noteOn(67, 200)]),
      ).best?.symbol,
    ).toBe("Csus2");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([noteOn(60, 0), noteOn(63, 100), noteOn(66, 200)]),
      ).best?.symbol,
    ).toBe("Cdim");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([noteOn(60, 0), noteOn(64, 100), noteOn(68, 200)]),
      ).best?.symbol,
    ).toBe("Caug");
    expect(
      detectChordFromNoteState(
        replayNoteEvents([
          noteOn(60, 0),
          noteOn(63, 100),
          noteOn(66, 200),
          noteOn(69, 300),
        ]),
      ).best?.symbol,
    ).toBe("Cdim7");
  });

  it("prefers the previous chord when passing-tone evidence is close", () => {
    const cMajor = detectedChordCandidate("C", 0, "major");
    const detection = detectChordFromNoteState(
      replayNoteEvents([
        noteOn(60, 0),
        noteOn(64, 100),
        noteOn(67, 200),
        noteOn(69, 300),
        noteOn(67, 400),
        noteOn(64, 500),
      ]),
      { previousChord: cMajor },
    );

    expect(detection.best?.symbol).toBe("C");
  });

  it("switches from the previous chord when new chord evidence is strong", () => {
    const cMajor = detectedChordCandidate("C", 0, "major");
    const detection = detectChordFromNoteState(
      replayNoteEvents([
        noteOn(69, 0),
        noteOn(72, 100),
        noteOn(76, 200),
        noteOn(72, 300),
        noteOn(76, 400),
      ]),
      { previousChord: cMajor },
    );

    expect(detection.best?.symbol).toBe("Am");
  });
});

function noteOn(note: number, timestampMs: number): NoteInputEvent {
  return { type: "noteOn", note, velocity: 100, timestampMs };
}

function detectedChordCandidate(
  symbol: string,
  root: number,
  quality: NonNullable<
    ReturnType<typeof detectChordFromNoteState>["best"]
  >["quality"],
): NonNullable<ReturnType<typeof detectChordFromNoteState>["best"]> {
  return {
    root,
    quality,
    symbol,
    confidence: 1,
    matchedPitchClasses: [],
    missingPitchClasses: [],
  };
}
