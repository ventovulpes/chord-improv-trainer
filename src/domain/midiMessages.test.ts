import { describe, expect, it } from "vitest";
import { normalizeMidiMessage } from "./midiMessages";

describe("normalizeMidiMessage", () => {
  it("converts note-on with velocity into a noteOn event", () => {
    expect(normalizeMidiMessage([0x90, 60, 100], 10)).toEqual({
      type: "noteOn",
      note: 60,
      velocity: 100,
      timestampMs: 10,
    });
  });

  it("converts note-on with zero velocity into a noteOff event", () => {
    expect(normalizeMidiMessage([0x90, 60, 0], 20)).toEqual({
      type: "noteOff",
      note: 60,
      velocity: 0,
      timestampMs: 20,
    });
  });

  it("converts note-off into a noteOff event", () => {
    expect(normalizeMidiMessage([0x80, 60, 64], 30)).toEqual({
      type: "noteOff",
      note: 60,
      velocity: 0,
      timestampMs: 30,
    });
  });

  it("converts sustain pedal values at or above 64 into sustain down", () => {
    expect(normalizeMidiMessage([0xb0, 64, 127], 40)).toEqual({
      type: "sustainChange",
      isDown: true,
      timestampMs: 40,
    });
  });

  it("converts sustain pedal values below 64 into sustain up", () => {
    expect(normalizeMidiMessage([0xb0, 64, 0], 50)).toEqual({
      type: "sustainChange",
      isDown: false,
      timestampMs: 50,
    });
  });

  it("ignores unsupported MIDI messages", () => {
    expect(normalizeMidiMessage([0xe0, 0, 64], 60)).toBeNull();
    expect(normalizeMidiMessage([0xb0, 1, 127], 60)).toBeNull();
  });

  it("handles channelized MIDI status bytes", () => {
    expect(normalizeMidiMessage([0x92, 64, 90], 70)).toEqual({
      type: "noteOn",
      note: 64,
      velocity: 90,
      timestampMs: 70,
    });
  });
});
