import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { ChordCandidate } from "./domain/chordDetection";
import type { ChordSuggestion } from "./domain/harmonySuggestions";
import {
  createInitialMusicalContext,
  resetMusicalContext,
  updateMusicalContext,
  type MusicalContext,
} from "./domain/musicalContext";
import {
  DEFAULT_RECENT_WINDOW_MS,
  applyNoteEvent,
  createInitialNoteState,
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

const KEY_OPTIONS = [
  { root: 0, label: "C major" },
  { root: 1, label: "C# major" },
  { root: 2, label: "D major" },
  { root: 3, label: "D# major" },
  { root: 4, label: "E major" },
  { root: 5, label: "F major" },
  { root: 6, label: "F# major" },
  { root: 7, label: "G major" },
  { root: 8, label: "G# major" },
  { root: 9, label: "A major" },
  { root: 10, label: "A# major" },
  { root: 11, label: "B major" },
];

const SUGGESTION_LIMIT_OPTIONS = [
  { value: "3", label: "3" },
  { value: "6", label: "6" },
  { value: "9", label: "9" },
  { value: "all", label: "All" },
] as const;

type SuggestionLimit = (typeof SUGGESTION_LIMIT_OPTIONS)[number]["value"];

type AppState = {
  noteState: NoteState;
  musicalContext: MusicalContext;
  recentWindowMs: number;
  suggestionLimit: SuggestionLimit;
};

type AppAction =
  | { type: "event"; event: AppInputEvent }
  | { type: "reset" }
  | { type: "setKeyRoot"; keyRoot: number }
  | { type: "setRecentWindowMs"; recentWindowMs: number }
  | { type: "setSuggestionLimit"; suggestionLimit: SuggestionLimit };

function createInitialAppState(): AppState {
  return {
    noteState: createInitialNoteState(),
    musicalContext: createInitialMusicalContext(),
    recentWindowMs: DEFAULT_RECENT_WINDOW_MS,
    suggestionLimit: "3",
  };
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "event": {
      const noteState = applyNoteEvent(state.noteState, action.event, {
        recentWindowMs: state.recentWindowMs,
      });

      return {
        noteState,
        musicalContext: updateMusicalContext(
          state.musicalContext,
          noteState,
        ),
        recentWindowMs: state.recentWindowMs,
        suggestionLimit: state.suggestionLimit,
      };
    }
    case "reset": {
      return {
        noteState: createInitialNoteState(),
        musicalContext: resetMusicalContext({
          keyRoot: state.musicalContext.keyRoot,
        }),
        recentWindowMs: state.recentWindowMs,
        suggestionLimit: state.suggestionLimit,
      };
    }
    case "setKeyRoot": {
      return {
        noteState: state.noteState,
        musicalContext: updateMusicalContext(
          state.musicalContext,
          state.noteState,
          { keyRoot: action.keyRoot },
        ),
        recentWindowMs: state.recentWindowMs,
        suggestionLimit: state.suggestionLimit,
      };
    }
    case "setRecentWindowMs": {
      return {
        ...state,
        recentWindowMs: action.recentWindowMs,
      };
    }
    case "setSuggestionLimit": {
      return {
        ...state,
        suggestionLimit: action.suggestionLimit,
      };
    }
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialAppState(),
  );
  const [isInputPanelsCollapsed, setIsInputPanelsCollapsed] = useState(false);
  const { noteState, musicalContext, recentWindowMs, suggestionLimit } = state;
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
  const displayedSuggestions = useMemo(
    () =>
      suggestionLimit === "all"
        ? musicalContext.visibleSuggestions
        : musicalContext.visibleSuggestions.slice(0, Number(suggestionLimit)),
    [musicalContext.visibleSuggestions, suggestionLimit],
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

  function resetApp() {
    dispatch({ type: "reset" });
  }

  function setRecentWindowMs(value: string) {
    const nextRecentWindowMs = Number(value);

    if (Number.isFinite(nextRecentWindowMs) && nextRecentWindowMs > 0) {
      dispatch({
        type: "setRecentWindowMs",
        recentWindowMs: Math.floor(nextRecentWindowMs),
      });
    }
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-row items-center gap-2 text-sm font-medium text-[#5b6b82]">
              Key
              <select
                className="rounded-md border border-[#cbd3df] bg-white px-3 py-2 text-[#172033]"
                value={musicalContext.keyRoot}
                onChange={(event) =>
                  dispatch({
                    type: "setKeyRoot",
                    keyRoot: Number(event.currentTarget.value),
                  })
                }
              >
                {KEY_OPTIONS.map((option) => (
                  <option key={option.root} value={option.root}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex w-fit items-center rounded-md border border-[#cbd3df] bg-white px-3 py-2 text-sm font-semibold text-[#172033] hover:bg-[#eef2f7]"
              type="button"
              aria-expanded={!isInputPanelsCollapsed}
              onClick={() =>
                setIsInputPanelsCollapsed((isCollapsed) => !isCollapsed)
              }
            >
              {isInputPanelsCollapsed ? "Show input panels" : "Hide input panels"}
            </button>
            <button
              className="inline-flex w-fit items-center rounded-md bg-[#172033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2c3b56]"
              type="button"
              onClick={resetApp}
            >
              Reset MIDI
            </button>
          </div>
        </header>

        {isInputPanelsCollapsed ? null : (
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
                      midi.status === "unsupported" ||
                      midi.status === "requesting"
                    }
                  >
                    {midi.status === "requesting"
                      ? "Connecting..."
                      : "Connect MIDI"}
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
                  <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-[#5b6b82]">
                    Recent window
                    <input
                      className="min-w-0 rounded-md border border-[#cbd3df] bg-white px-3 py-2 text-[#172033]"
                      type="number"
                      step={10}
                      value={recentWindowMs}
                      onChange={(event) =>
                        setRecentWindowMs(event.currentTarget.value)
                      }
                    />
                  </label>
                  <StatusRow
                    label="Tracked events"
                    value={String(noteState.recentEvents.length)}
                  />
                </div>
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
                        {noteName(note)}{" "}
                        {activeNoteNumbers.has(note) ? "Off" : "On"}
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
        )}

        <Panel title="Suggestions">
          <div className="flex flex-col gap-2">
            {musicalContext.visibleSuggestions.length === 0 ? (
              <EmptyText>Play a chord to see next chord suggestions</EmptyText>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {displayedSuggestions.map((suggestion: ChordSuggestion) => (
                  <SuggestionCard
                    suggestion={suggestion}
                    key={suggestion.id}
                  />
                ))}
              </div>
            )}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex w-fit items-center gap-2 text-sm font-medium text-[#5b6b82]">
                Show
                <select
                  className="rounded-md border border-[#cbd3df] bg-white px-3 py-2 text-[#172033]"
                  value={suggestionLimit}
                  onChange={(event) =>
                    dispatch({
                      type: "setSuggestionLimit",
                      suggestionLimit: event.currentTarget
                        .value as SuggestionLimit,
                    })
                  }
                >
                  {SUGGESTION_LIMIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Panel>

        <Panel title="Detected Chord">
          {musicalContext.chordDetection.best ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <StatusRow
                  label="Chord"
                  value={musicalContext.chordDetection.best.symbol}
                />
                <StatusRow
                  label="Quality"
                  value={qualityLabel(musicalContext.chordDetection.best.quality)}
                />
                <StatusRow
                  label="Confidence"
                  value={confidenceLabel(
                    musicalContext.chordDetection.best.confidence,
                  )}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#5b6b82]">
                  Matched pitch classes
                </h3>
                <PitchClassBadges
                  pitchClasses={
                    musicalContext.chordDetection.best.matchedPitchClasses
                  }
                />
              </div>
              {musicalContext.chordDetection.alternatives.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#5b6b82]">
                    Alternatives
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {musicalContext.chordDetection.alternatives.map((candidate: ChordCandidate) => (
                      <CandidateSummary
                        candidate={candidate}
                        key={candidate.symbol}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyText>No confident chord detected</EmptyText>
          )}
        </Panel>

        <section className="grid gap-4 lg:grid-cols-4">
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

          <Panel title="Chord History">
            {musicalContext.chordHistory.length === 0 ? (
              <EmptyText>No detected chords yet</EmptyText>
            ) : (
              <ul className="flex flex-col-reverse gap-2">
                {musicalContext.chordHistory.map((chord: ChordCandidate, index: number) => (
                  <li
                    className="flex items-center rounded-md border border-[#d7dce5] bg-white px-3 py-2 text-sm"
                    key={`${chord.symbol}-${index}`}
                  >
                    <span>{chord.symbol}</span>
                  </li>
                ))}
              </ul>
            )}
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

function CandidateSummary({ candidate }: { candidate: ChordCandidate }) {
  return (
    <div className="rounded-md border border-[#d7dce5] bg-white px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{candidate.symbol}</span>
        <span className="text-[#5b6b82]">
          {confidenceLabel(candidate.confidence)}
        </span>
      </div>
      <div className="mt-2">
        <PitchClassBadges pitchClasses={candidate.matchedPitchClasses} compact />
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: ChordSuggestion }) {
  return (
    <article className="flex h-full flex-col gap-2 rounded-md border border-[#d7dce5] bg-white p-4">
      <div>
        <h3 className="text-2xl font-semibold tracking-normal">
          {suggestion.symbol}
        </h3>
        <p className="text-sm leading-6 text-[#34445f]">
          {suggestion.context}
        </p>
      </div>
    </article>
  );
}

function PitchClassBadges({
  pitchClasses,
  compact = false,
}: {
  pitchClasses: number[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {pitchClasses.map((pitchClass) => (
        <Badge compact={compact} key={pitchClass}>
          {pitchClassName(pitchClass)}
        </Badge>
      ))}
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

function Badge({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <span
      className={`rounded-md border border-[#b8c2d1] bg-white text-sm font-semibold ${
        compact ? "px-2 py-1" : "px-3 py-2"
      }`}
    >
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#5b6b82]">{children}</p>;
}

function qualityLabel(quality: ChordCandidate["quality"]): string {
  switch (quality) {
    case "major":
      return "Major";
    case "minor":
      return "Minor";
    case "diminished":
      return "Diminished";
    case "augmented":
      return "Augmented";
    case "dominant7":
      return "Dominant 7";
    case "major7":
      return "Major 7";
    case "minor7":
      return "Minor 7";
    case "halfDiminished7":
      return "Half-diminished 7";
    case "diminished7":
      return "Diminished 7";
    case "sus2":
      return "Sus2";
    case "sus4":
      return "Sus4";
  }
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
