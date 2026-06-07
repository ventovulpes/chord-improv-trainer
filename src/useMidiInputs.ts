import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeMidiMessage } from "./domain/midiMessages";
import type { AppInputEvent } from "./domain/noteEvents";

type MidiSupportStatus =
  | "unsupported"
  | "idle"
  | "requesting"
  | "ready"
  | "no-device"
  | "disconnected"
  | "denied"
  | "error";

export type MidiInputInfo = {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
};

type MidiInputLike = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
};

type MidiMessageEventLike = {
  data: ArrayLike<number>;
};

type MidiConnectionEventLike = {
  port?: {
    type?: string;
  };
};

type MidiAccessLike = {
  inputs: {
    values(): IterableIterator<MidiInputLike>;
  };
  onstatechange: ((event: MidiConnectionEventLike) => void) | null;
};

type NavigatorWithMidi = {
  requestMIDIAccess?: () => Promise<unknown>;
};

export function useMidiInputs(onInputEvent: (event: AppInputEvent) => void) {
  const [status, setStatus] = useState<MidiSupportStatus>(() =>
    hasWebMidiSupport() ? "idle" : "unsupported",
  );
  const [midiAccess, setMidiAccess] = useState<MidiAccessLike | null>(null);
  const [inputs, setInputs] = useState<MidiInputInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [unsupportedMessageCount, setUnsupportedMessageCount] = useState(0);

  const selectedInput = useMemo(
    () => inputs.find((input) => input.id === selectedInputId) ?? null,
    [inputs, selectedInputId],
  );

  const refreshInputs = useCallback((access: MidiAccessLike) => {
    const nextInputs = Array.from(access.inputs.values()).map(toInputInfo);

    setInputs(nextInputs);
    setSelectedInputId((currentId) => {
      if (currentId && nextInputs.some((input) => input.id === currentId)) {
        setStatus("ready");
        setStatusMessage(null);
        return currentId;
      }

      if (currentId) {
        setStatus(nextInputs.length === 0 ? "no-device" : "disconnected");
        setStatusMessage("The selected MIDI input disconnected.");
        return null;
      }

      setStatus(nextInputs.length === 0 ? "no-device" : "ready");
      setStatusMessage(
        nextInputs.length === 0 ? "No MIDI input devices are available." : null,
      );

      return nextInputs[0]?.id ?? null;
    });
  }, []);

  const requestAccess = useCallback(async () => {
    const requestMIDIAccess = getRequestMIDIAccess();

    if (!requestMIDIAccess) {
      setStatus("unsupported");
      setErrorMessage("Web MIDI is not available in this browser.");
      return;
    }

    setStatus("requesting");
    setErrorMessage(null);

    try {
      const access = await requestMIDIAccess();

      setMidiAccess(access);
      refreshInputs(access);
    } catch (error) {
      setMidiAccess(null);
      setInputs([]);
      setSelectedInputId(null);
      setStatus(isPermissionDeniedError(error) ? "denied" : "error");
      setErrorMessage(getErrorMessage(error));
    }
  }, [refreshInputs]);

  useEffect(() => {
    if (!midiAccess) {
      return;
    }

    midiAccess.onstatechange = (event) => {
      if (event.port?.type === "input" || event.port?.type === undefined) {
        refreshInputs(midiAccess);
      }
    };

    return () => {
      midiAccess.onstatechange = null;
    };
  }, [midiAccess, refreshInputs]);

  useEffect(() => {
    if (!midiAccess || !selectedInputId) {
      return;
    }

    const input =
      Array.from(midiAccess.inputs.values()).find(
        (candidate) => candidate.id === selectedInputId,
      ) ?? null;

    if (!input) {
      return;
    }

    input.onmidimessage = (message) => {
      const normalizedEvent = normalizeMidiMessage(message.data, performance.now());

      if (normalizedEvent) {
        onInputEvent(normalizedEvent);
        return;
      }

      setUnsupportedMessageCount((count) => count + 1);
      setStatusMessage("Ignored an unsupported MIDI message.");
    };

    return () => {
      input.onmidimessage = null;
    };
  }, [midiAccess, onInputEvent, selectedInputId]);

  return {
    status,
    inputs,
    selectedInput,
    selectedInputId,
    errorMessage,
    statusMessage,
    unsupportedMessageCount,
    requestAccess,
    selectInput: (inputId: string | null) => {
      setSelectedInputId(inputId);
      setStatus(inputId ? "ready" : inputs.length === 0 ? "no-device" : "disconnected");
      setStatusMessage(inputId ? null : "No MIDI input is selected.");
    },
  };
}

function hasWebMidiSupport(): boolean {
  return getRequestMIDIAccess() !== undefined;
}

function getRequestMIDIAccess(): (() => Promise<MidiAccessLike>) | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  const requestMIDIAccess = (navigator as unknown as NavigatorWithMidi)
    .requestMIDIAccess;

  if (!requestMIDIAccess) {
    return undefined;
  }

  return async () => {
    const access = await requestMIDIAccess.call(navigator);

    return access as MidiAccessLike;
  };
}

function toInputInfo(input: MidiInputLike): MidiInputInfo {
  return {
    id: input.id,
    name: input.name?.trim() || "Unnamed MIDI input",
    manufacturer: input.manufacturer?.trim() || "Unknown manufacturer",
    state: input.state ?? "unknown",
  };
}

function isPermissionDeniedError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "SecurityError";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to access MIDI inputs.";
}
