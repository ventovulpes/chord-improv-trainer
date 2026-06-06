# Master Plan

## 1. Goals

### 1.1 Product Goal

Build a browser-based MIDI practice app that helps piano players improvise with more interesting harmony.

The app listens to live MIDI input, detects the chord or harmony the user is implying, and suggests possible next chords that help the user practice useful harmonic concepts.

The app is a visual practice assistant, not an audio playback tool.

---

### 1.2 Core User Problem

When improvising, the user may have enough mental bandwidth to improvise a melody, but not enough to also invent interesting chord progressions in real time.

As a result, the user often defaults to simple diatonic chords.

The app should reduce the cognitive load of harmony by suggesting useful next chords while the user plays.

---

### 1.3 Core Product Behavior

The user plays on a MIDI keyboard.

The app detects the current harmonic context from the user’s playing.

The app should detect chords from:

- Block chords
- Arpeggios
- Broken chord patterns
- Repeated chord tones
- Bass notes followed by upper notes
- Notes spread across both hands
- Sustained notes and recent note history

The app then suggests possible next chords.

Each suggestion should include:

- Chord symbol
- Roman numeral
- Harmonic concept
- Resolution target, when applicable
- Short explanation
- Optional chord tones

The app should not suggest exact piano voicings or hand shapes.

---

### 1.4 Learning Goal

The app should help the user build harmonic intuition and muscle memory by repeatedly exposing them to useful chord movements.

Examples:

- Secondary dominants
- Borrowed iv chords
- Modal mixture
- Tritone substitutions
- Diminished passing chords
- Diatonic progressions

The app should teach not only what chord to play, but why the chord works.

---

### 1.5 MVP Goal

Create a local-first web app that can:

- Connect to a MIDI keyboard
- Track live and recent MIDI notes
- Detect chords from block chords and patterns
- Suggest interesting next chords
- Explain harmonic concepts
- Check whether the user played a suggested chord
- Track local practice progress

---

## 2. Constraints

### 2.1 Technical Constraints

The app should use:

- React
- TypeScript
- Tailwind CSS
- Vite
- Web MIDI API
- Custom music theory engine
- Custom chord detection engine
- Custom harmony suggestion engine
- localStorage
- IndexedDB
- Vitest

The app should avoid unnecessary dependencies.

Runtime dependencies should initially be limited to:

- React
- React DOM

Additional libraries should only be added if they significantly reduce implementation complexity.

---

### 2.2 No Audio Output

The app does not need to play any sounds.

The MVP should not include:

- Web Audio API
- Tone.js
- Synthesizers
- Sample libraries
- Audio scheduling
- Backing tracks
- Metronome sounds

---

### 2.3 No Chord Voicing Suggestions

The app should suggest chords, not hand shapes.

The MVP should not answer:

- Which inversion should I play?
- Which hand should play which note?
- What exact piano shape should I use?

The MVP should answer:

- What chord could come next?
- Why does this chord work?
- What concept does it demonstrate?
- Where does it resolve?
- Did I play the intended chord?

---

### 2.4 Pattern-Aware Chord Detection

The app must not rely only on currently held notes.

It must maintain recent note history and infer harmony from notes distributed over time.

For example, all of the following should be recognized as C major evidence:

- `C E G` played together
- `C E G C` played as an arpeggio
- `C G E G` played as a broken pattern
- `C` in the bass, followed by `E G`
- Repeated `C E G` tones over a short window

This is one of the most important technical requirements.

---

### 2.5 Browser Constraints

The MVP targets desktop browsers with Web MIDI support.

Primary target:

- Desktop Chrome
- Desktop Edge
- Desktop Firefox, if Web MIDI support is available in the user’s environment

The MVP does not need to guarantee:

- Safari support
- iOS support
- Mobile support

---

### 2.6 Local-First Constraint

The MVP should work without a backend.

User data should be stored locally.

Use:

- `localStorage` for settings
- `IndexedDB` for practice history and larger records

A backend can be added later for accounts, sync, sharing, and teacher workflows.

---

### 2.7 Explainability Constraint

Every suggestion should be explainable.

The app should avoid black-box suggestions in the MVP.

For example, instead of only showing:
````
E7
````

the app should show:

```txt
E7 → Am7
Concept: Secondary dominant
Roman numeral: V/vi → vi
Why: E7 temporarily tonicizes Am. The G# pulls strongly toward A.
```

---

### 2.8 MVP Exclusions

The MVP should not include:

* Audio playback
* Backing tracks
* Chord voicing suggestions
* Hand-shape recommendations
* AI generation
* Automatic key detection
* Uploaded MIDI file parsing
* Sheet music notation
* User accounts
* Cloud sync
* Social features
* Payments
* Teacher dashboard
* Full jazz chord-symbol parser
* Full accompaniment generation

## 3. Roadmap

Found in docs/roadmap.md

### Next Phase: 3

## 4. Architecture

Found in docs/architecture.md