# Architecture Doc

## 1. Architecture Overview

The app is a local-first browser application that listens to live MIDI input, tracks note history, detects implied chords from both block chords and patterns, suggests next chords, and grades whether the user played a suggested chord.

The app is visual-only.

It does not play sound.

It does not suggest chord voicings or hand shapes.

Core loop:

```txt
MIDI input
→ note history
→ pattern-aware chord detection
→ harmonic context
→ chord suggestion
→ practice attempt
→ feedback
→ local progress
```

---

## 2. High-Level Architecture

```txt
┌───────────────────────────────────────┐
│              React UI                 │
│                                       │
│  MIDI Device Selector                 │
│  Keyboard View                        │
│  Active Notes View                    │
│  Recent Notes View                    │
│  Detected Chord View                  │
│  Suggestion Cards                     │
│  Practice Feedback                    │
│  Settings Panel                       │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│              App State                │
│                                       │
│  MIDI state                           │
│  Note history                         │
│  Musical context                      │
│  Suggestions                          │
│  Practice state                       │
│  User settings                        │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│             MIDI Layer                │
│                                       │
│  Web MIDI access                      │
│  Device selection                     │
│  Raw event normalization              │
│  Sustain pedal tracking               │
│  Active note tracking                 │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│          Note History Engine          │
│                                       │
│  Active notes                         │
│  Recent notes                         │
│  Rolling time windows                 │
│  Recent pitch classes                 │
│  Bass note tracking                   │
│  Melody note tracking                 │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│      Pattern-Aware Chord Detection    │
│                                       │
│  Block chord detection                │
│  Arpeggio detection                   │
│  Broken pattern detection             │
│  Candidate scoring                    │
│  Ambiguity handling                   │
│  Harmonic stability                   │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│          Harmonic Context             │
│                                       │
│  Selected key                         │
│  Selected mode                        │
│  Current detected chord               │
│  Previous chord                       │
│  Chord history                        │
│  Recent melody evidence               │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│        Chord Suggestion Engine        │
│                                       │
│  Concept generators                   │
│  Candidate ranking                    │
│  Explanation generation               │
│  Suggestion deduplication             │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│          Practice Engine              │
│                                       │
│  Target chord tracking                │
│  Attempt detection                    │
│  Pitch-class matching                 │
│  Feedback generation                  │
│  Progress logging                     │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│              Storage                  │
│                                       │
│  localStorage settings                │
│  IndexedDB practice history           │
└───────────────────────────────────────┘
```