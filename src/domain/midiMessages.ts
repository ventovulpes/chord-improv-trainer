import type { AppInputEvent } from "./noteEvents";

const STATUS_COMMAND_MASK = 0xf0;
const NOTE_OFF_COMMAND = 0x80;
const NOTE_ON_COMMAND = 0x90;
const CONTROL_CHANGE_COMMAND = 0xb0;
const SUSTAIN_PEDAL_CONTROL = 64;
const SUSTAIN_DOWN_THRESHOLD = 64;

export function normalizeMidiMessage(
  data: ArrayLike<number>,
  timestampMs: number,
): AppInputEvent | null {
  const status = data[0];
  const firstDataByte = data[1];
  const secondDataByte = data[2];

  if (
    status === undefined ||
    firstDataByte === undefined ||
    secondDataByte === undefined
  ) {
    return null;
  }

  const command = status & STATUS_COMMAND_MASK;

  if (command === NOTE_ON_COMMAND) {
    if (secondDataByte === 0) {
      return {
        type: "noteOff",
        note: firstDataByte,
        velocity: 0,
        timestampMs,
      };
    }

    return {
      type: "noteOn",
      note: firstDataByte,
      velocity: secondDataByte,
      timestampMs,
    };
  }

  if (command === NOTE_OFF_COMMAND) {
    return {
      type: "noteOff",
      note: firstDataByte,
      velocity: 0,
      timestampMs,
    };
  }

  if (
    command === CONTROL_CHANGE_COMMAND &&
    firstDataByte === SUSTAIN_PEDAL_CONTROL
  ) {
    return {
      type: "sustainChange",
      isDown: secondDataByte >= SUSTAIN_DOWN_THRESHOLD,
      timestampMs,
    };
  }

  return null;
}
