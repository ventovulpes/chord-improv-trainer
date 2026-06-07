# Roadmap

## Guiding Principle

Build in **vertical slices**: every phase should produce a small working user loop with UI, state, music logic, and tests.

Avoid building large horizontal systems like “all MIDI,” then “all theory,” then “all UI.” Each phase should be usable, testable, and hard to accidentally break.

Core loop:

```txt
Input notes
→ update note history
→ detect harmony
→ suggest chord
→ user attempts chord
→ store progress
```

---

## Phase 1 — Foundation + Replayable Input Harness

### Goal

Create the app shell and a testable note-event pipeline before depending on real MIDI hardware.

### Build

* Set up React + TypeScript + Tailwind + Vite.
* Add Vitest.
* Define core domain types.
* Create app layout panels:

  * MIDI/input status
  * Active notes
  * Recent notes
  * Detected chord
  * Suggestions
* Add fake note input buttons or keyboard controls.
* Add timestamped event replay utilities.

### Key Types

```ts
type TestNoteEvent = {
  type: "noteOn" | "noteOff";
  note: number;
  velocity: number;
  timestampMs: number;
};
```

### Tests

```txt
press C → active notes include C
release C → active notes remove C
play C E G → recent pitch classes include C E G
old notes expire from recent window
reset clears state
```

### Success Criteria

* App runs.
* Tests run.
* Notes can be simulated without MIDI hardware.
* Future chord detection can be tested through replayable fixtures.

---

## Phase 2 — Real MIDI + Note History Slice

### Goal

Connect real MIDI into the same pipeline used by fake input.

### Build

* Request Web MIDI access.
* List MIDI inputs.
* Select MIDI device.
* Normalize raw MIDI messages.
* Handle:

  * `noteOn`
  * `noteOff`
  * `noteOn` with velocity `0`
  * sustain pedal CC 64
  * device disconnect
  * panic/reset
* Track:

  * active notes
  * recent notes
  * recent pitch classes
  * likely bass note
  * likely melody note
* Display active and recent notes in UI.

### Tests

```txt
0x90 velocity > 0 → noteOn
0x90 velocity = 0 → noteOff
0x80              → noteOff
0xB0 CC 64        → sustain pedal
C E G over time   → recent pitch classes include C E G
```

### Success Criteria

* Fake input and real MIDI use the same event path.
* Real keyboard input appears in UI.
* Web MIDI code is isolated.
* Note history is bounded, predictable, and testable.

---

## Phase 3 — Minimal Pattern-Aware Chord Detection

### Goal

Detect the simplest useful chords from both block chords and arpeggios.

### Build

* Add pitch-class utilities.
* Add major/minor chord templates.
* Add rolling detection window.
* Score chord candidates from recent pitch-class evidence.
* Show detected chord and confidence.
* Show simple alternatives when ambiguous.

Initial supported chords:

```txt
major
minor
```

### Tests

```txt
C E G together           → C major
A C E together           → A minor
C E G over 900ms         → C major
C G E G broken pattern   → C major
A E C E broken pattern   → A minor
C E only                 → no confident chord
C E G then long wait     → lower confidence or no chord
```

### Success Criteria

* App detects block major/minor triads.
* App detects arpeggiated major/minor triads.
* Detection uses recent history, not only held notes.
* Timing behavior is covered by replay tests.

---

## Phase 4 — First Complete Practice Loop

### Goal

Prove the full product loop with one key and one concept.

### Build

* Add manual key selector.
* Start with C major.
* Add one concept generator: secondary dominants.
* After detecting a chord, show 1–3 suggestions.
* Accept:

  * block chords
  * arpeggios
  * broken patterns

Example suggestion:

```txt
E7 → Am
Concept: Secondary dominant
Roman numeral: V/vi → vi
Why: E7 temporarily tonicizes Am because G# pulls toward A.
Chord tones: E G# B D
```

### Tests

```txt
C major generates E7 → Am
C major generates D7 → G
play C E G → detect C → show secondary dominant suggestion
```
write other tests

### Success Criteria

* User can play a chord.
* App detects it.
* App suggests a next chord.
* User can practice the suggestion.
* This is the first true MVP loop.

---

## Phase 5 — Expand Music Coverage Safely

### Goal

Add musical breadth without breaking the core loop.

### Build

Add chord types:

```txt
diminished
augmented
dominant7
major7
minor7
halfDiminished7
diminished7
sus2
sus4
```

Add concept generators:

```txt
diatonic
borrowed iv
modal mixture
tritone substitution
diminished passing chords
```

### Tests

```txt
E G# B D       → E7
C E G B        → Cmaj7
A C E G        → Am7, with C6 alternative
B D F A        → Bm7b5
C F G          → Csus4
C D G          → Csus2
C E G A G E    → remains likely C
C E G then A C E repeated → switches to Am
```

Concept tests:

```txt
C major diatonic includes Dm, Em, F, G, Am
C major borrowed iv includes Fm
C major modal mixture includes Ab, Bb, Eb, Fm
C major tritone sub includes Db7 → C
C major diminished passing includes C#dim7 → Dm
```

### Success Criteria

* More chords are detected.
* More concepts are suggested.
* Earlier major/minor behavior still passes regression tests.
* Detection feels stable during real playing.

---

## Phase 6 — Ranking, Persistence, Polish, Hardening

### Goal

Make the MVP usable for regular practice.

### Build

Suggestion ranking:

* Selected concept boost.
* Spice-level filtering.
* Repetition penalty.
* Deduplication.
* Categories:

  * Safe
  * Color
  * Spicy
  * Concept

Polish:

* Unsupported MIDI message.
* Permission denied message.
* No-device state.
* Device disconnected state.

### Tests

```txt
selected concept ranks higher
repeated suggestion ranks lower
spice level filters suggestions
unsupported MIDI state renders
suggestion card renders
```

### Success Criteria

* Suggestions are limited and readable.
* Error states are clear.
* UI contains no music logic.
* App is usable without audio, backend, AI, or voicing suggestions.

---

# Final MVP Completion Criteria

The MVP is complete when a user can:

1. Connect a MIDI keyboard.
2. Select a key and concept.
3. Play block chords, arpeggios, or broken patterns.
4. See the app infer the current chord.
5. Receive useful next-chord suggestions.
6. Understand why each suggestion works.
7. Practice a suggested chord in any pattern.

---

# Guardrails

* Build one end-to-end behavior at a time.
* Use fake input before relying on real MIDI.
* Prefer replay tests over manual testing.
* Keep music logic outside React components.
* Add only one chord/concept expansion at a time.
* Add regression tests before changing detection logic.
* Do not add dependencies unless they remove major complexity.
* Do not optimize until the core loop works.
* The safest path is always: fixture → test → implementation → UI.