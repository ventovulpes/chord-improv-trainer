import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  DEFAULT_RECENT_WINDOW_MS,
  applyNoteEvent,
  createInitialNoteState,
  resetNoteState,
  type NoteState,
} from "./domain/noteState";
import {
  noteName,
  pitchClassName,
  type AppInputEvent,
  type NoteInputEvent,
} from "./domain/noteEvents";
import { useMidiInputs } from "./useMidiInputs";

const INPUT_NOTES = [
  { note: 60, key: "a" },
  { note: 62, key: "s" },
  { note: 64, key: "d" },
  { note: 65, key: "f" },
  { note: 67, key: "j" },
  { note: 69, key: "k" },
  { note: 71, key: "l" },
  { note: 72, key: ";" },
];

type AppAction =
  | { type: "event"; event: AppInputEvent }
  | { type: "reset" };

function reducer(state: NoteState, action: AppAction): NoteState {
  switch (action.type) {
    case "event":
      return applyNoteEvent(state, action.event);
    case "reset":
      return resetNoteState();
  }
}

export default function App() {
  const [noteState, dispatch] = useReducer(reducer, undefined, () =>
    createInitialNoteState(),
  );
  const handleMidiInputEvent = useCallback((event: AppInputEvent) => {
    dispatch({ type: "event", event });
  }, []);
  const midi = useMidiInputs(handleMidiInputEvent);

  useEffect(() => {
    const notesByKey = new Map(
      INPUT_NOTES.map(({ note, key }) => [key.toLowerCase(), note]),
    );

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }

      const note = notesByKey.get(event.key.toLowerCase());

      if (note !== undefined) {
        event.preventDefault();
        dispatch({ type: "event", event: createUiNoteEvent("noteOn", note) });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const note = notesByKey.get(event.key.toLowerCase());

      if (note !== undefined) {
        event.preventDefault();
        dispatch({ type: "event", event: createUiNoteEvent("noteOff", note) });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const recentEvents = useMemo(
    () => [...noteState.recentEvents].reverse(),
    [noteState.recentEvents],
  );
  const activeNoteNumbers = useMemo(
    () => new Set(noteState.activeNotes.map((activeNote) => activeNote.note)),
    [noteState.activeNotes],
  );

  function sendEvent(type: NoteInputEvent["type"], note: number) {
    dispatch({
      type: "event",
      event: createUiNoteEvent(type, note),
    });
  }

  function toggleNote(note: number) {
    sendEvent(activeNoteNumbers.has(note) ? "noteOff" : "noteOn", note);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-[#172033] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-[#d7dce5] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">
              Chord Improv Trainer
            </h1>
          </div>
          <button
            className="inline-flex w-fit items-center rounded-md bg-[#172033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2c3b56]"
            type="button"
            onClick={() => dispatch({ type: "reset" })}
          >
            Reset
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="MIDI / Input Status">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <StatusRow
                  label="Hardware MIDI"
                  value={midiStatusLabel(midi.status)}
                />
                <StatusRow
                  label="Selected input"
                  value={midi.selectedInput?.name ?? "None"}
                />
              </div>
              {midi.errorMessage ? (
                <p className="rounded-md border border-[#e0b4b4] bg-[#fff8f8] px-3 py-2 text-sm text-[#8a2d2d]">
                  {midi.errorMessage}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <button
                  className="inline-flex w-fit items-center rounded-md bg-[#172033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2c3b56] disabled:cursor-not-allowed disabled:bg-[#8b96a8]"
                  type="button"
                  onClick={midi.requestAccess}
                  disabled={
                    midi.status === "unsupported" || midi.status === "requesting"
                  }
                >
                  {midi.status === "requesting" ? "Connecting..." : "Connect MIDI"}
                </button>
                <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-[#5b6b82]">
                  MIDI input
                  <select
                    className="min-w-0 rounded-md border border-[#cbd3df] bg-white px-3 py-2 text-[#172033] disabled:bg-[#eef2f7]"
                    value={midi.selectedInputId ?? ""}
                    onChange={(event) =>
                      midi.selectInput(event.currentTarget.value || null)
                    }
                    disabled={midi.inputs.length === 0}
                  >
                    {midi.inputs.length === 0 ? (
                      <option value="">No MIDI inputs</option>
                    ) : null}
                    {midi.inputs.map((input) => (
                      <option key={input.id} value={input.id}>
                        {input.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <StatusRow label="Input fallback" value="Simulated notes" />
                <StatusRow
                  label="Sustain pedal"
                  value={noteState.isSustainDown ? "Down" : "Up"}
                />
              </div>
              <StatusRow
                label="Recent window"
                value={`${DEFAULT_RECENT_WINDOW_MS}ms`}
              />
              <StatusRow
                label="Tracked events"
                value={String(noteState.recentEvents.length)}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INPUT_NOTES.map(({ note, key }) => (
                  <div
                    className="overflow-hidden rounded-md border border-[#cbd3df] bg-white"
                    key={note}
                  >
                    <button
                      className={`block w-full border-b border-[#cbd3df] px-3 py-3 text-center text-sm font-semibold ${
                        activeNoteNumbers.has(note)
                          ? "bg-[#172033] text-white hover:bg-[#2c3b56]"
                          : "hover:bg-[#eef2f7]"
                      }`}
                      type="button"
                      aria-pressed={activeNoteNumbers.has(note)}
                      onClick={() => toggleNote(note)}
                    >
                      {noteName(note)} {activeNoteNumbers.has(note) ? "Off" : "On"}
                    </button>
                    <div className="border-t border-[#d7dce5] px-2 py-1 text-center text-xs font-medium text-[#5b6b82]">
                      Key: {key === ";" ? ";" : key.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Active Notes">
            {noteState.activeNotes.length === 0 ? (
              <EmptyText>No active notes</EmptyText>
            ) : (
              <div className="flex flex-wrap gap-2">
                {noteState.activeNotes.map((activeNote) => (
                  <Badge key={activeNote.note}>
                    {noteName(activeNote.note)} · {activeNote.velocity}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <Panel title="Detected Chord">
          <EmptyText>Chord detection starts in Phase 3</EmptyText>
        </Panel>

        <Panel title="Suggestions">
          <EmptyText>Harmony suggestions start in Phase 4</EmptyText>
        </Panel>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Recent Notes">
            {recentEvents.length === 0 ? (
              <EmptyText>No recent events</EmptyText>
            ) : (
              <ol className="flex flex-col gap-2">
                {recentEvents.map((event, index) => (
                  <li
                    className="flex items-center justify-between rounded-md border border-[#d7dce5] bg-white px-3 py-2 text-sm"
                    key={`${event.timestampMs}-${event.note}-${index}`}
                  >
                    <span className="font-medium">{noteName(event.note)}</span>
                    <span className="text-[#5b6b82]">{event.type}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Recent Pitch Classes">
            {noteState.recentPitchClasses.length === 0 ? (
              <EmptyText>No recent pitch classes</EmptyText>
            ) : (
              <div className="flex flex-wrap gap-2">
                {noteState.recentPitchClasses.map((pitchClass) => (
                  <Badge key={pitchClass}>{pitchClassName(pitchClass)}</Badge>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Bass / Melody Evidence">
            <div className="flex flex-col gap-2">
              <StatusRow
                label="Likely bass"
                value={
                  noteState.likelyBassNote === null
                    ? "None"
                    : noteName(noteState.likelyBassNote)
                }
              />
              <StatusRow
                label="Likely melody"
                value={
                  noteState.likelyMelodyNote === null
                    ? "None"
                    : noteName(noteState.likelyMelodyNote)
                }
              />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function createUiNoteEvent(
  type: NoteInputEvent["type"],
  note: number,
): NoteInputEvent {
  return {
    type,
    note,
    velocity: type === "noteOn" ? 100 : 0,
    timestampMs: performance.now(),
  };
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#d7dce5] bg-[#fbfcfe] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5b6b82]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-[#d7dce5] bg-white px-3 py-2 text-sm">
      <span className="text-[#5b6b82]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function midiStatusLabel(status: ReturnType<typeof useMidiInputs>["status"]) {
  switch (status) {
    case "unsupported":
      return "Unsupported";
    case "idle":
      return "Not connected";
    case "requesting":
      return "Requesting access";
    case "ready":
      return "Ready";
    case "denied":
      return "Permission denied";
    case "error":
      return "Error";
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-[#b8c2d1] bg-white px-3 py-2 text-sm font-semibold">
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#5b6b82]">{children}</p>;
}
