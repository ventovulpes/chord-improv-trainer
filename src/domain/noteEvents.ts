export type TestNoteEvent = {
  type: "noteOn" | "noteOff";
  note: number;
  velocity: number;
  timestampMs: number;
};

export const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export function pitchClass(note: number): number {
  return ((note % 12) + 12) % 12;
}

export function noteName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  return `${PITCH_CLASS_NAMES[pitchClass(note)]}${octave}`;
}

export function pitchClassName(value: number): string {
  return PITCH_CLASS_NAMES[pitchClass(value)];
}
