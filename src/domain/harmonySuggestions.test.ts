import { describe, expect, it } from "vitest";
import type { ChordCandidate } from "./chordDetection";
import { suggestNextChords } from "./harmonySuggestions";

describe("harmony suggestions expected behavior", () => {
  it("returns no suggestions when no chord is detected", () => {
    expect(suggestNextChords(null)).toEqual([]);
  });

  it("uses the suggestion symbol as the chord to play and context as the reasoning", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"));

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "E7",
          context: "Secondary dominant -> Am",
          romanNumeral: "V/vi -> vi",
          chordTones: ["E", "G#", "B", "D"],
        }),
        expect.objectContaining({
          symbol: "D7",
          context: "Secondary dominant -> G",
          romanNumeral: "V/V -> V",
          chordTones: ["D", "F#", "A", "C"],
        }),
        expect.objectContaining({
          symbol: "A7",
          context: "Secondary dominant -> Dm",
          romanNumeral: "V/ii -> ii",
          chordTones: ["A", "C#", "E", "G"],
        }),
      ]),
    );
  });

  it("suggests C major diatonic chords as possible next chords", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"));

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "Dm",
          context: "Diatonic",
          romanNumeral: "ii",
          chordTones: ["D", "F", "A"],
        }),
        expect.objectContaining({
          symbol: "Em",
          context: "Diatonic",
          romanNumeral: "iii",
          chordTones: ["E", "G", "B"],
        }),
        expect.objectContaining({
          symbol: "F",
          context: "Diatonic",
          romanNumeral: "IV",
          chordTones: ["F", "A", "C"],
        }),
        expect.objectContaining({
          symbol: "G",
          context: "Diatonic",
          romanNumeral: "V",
          chordTones: ["G", "B", "D"],
        }),
        expect.objectContaining({
          symbol: "Am",
          context: "Diatonic",
          romanNumeral: "vi",
          chordTones: ["A", "C", "E"],
        }),
      ]),
    );
  });

  it("does not suggest diatonic dominant roots or V/iii as C major secondary dominants", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"));
    const secondaryDominantContexts = suggestions.filter((suggestion) =>
      suggestion.context.startsWith("Secondary dominant"),
    );
    const secondaryDominantSymbols = secondaryDominantContexts.map(
      (suggestion) => suggestion.symbol,
    );

    expect(secondaryDominantSymbols).toEqual(["E7", "D7", "A7"]);
    expect(secondaryDominantSymbols).not.toEqual(
      expect.arrayContaining(["C7", "F7", "G7", "B7"]),
    );
  });

  it("does not suggest the currently detected chord", () => {
    const cSuggestions = suggestNextChords(detectedChord("C", 0, "major"));
    const gSuggestions = suggestNextChords(detectedChord("G", 7, "major"));
    const amSuggestions = suggestNextChords(detectedChord("Am", 9, "minor"));

    expect(cSuggestions.map((suggestion) => suggestion.symbol)).not.toContain("C");
    expect(gSuggestions.map((suggestion) => suggestion.symbol)).not.toContain("G");
    expect(amSuggestions.map((suggestion) => suggestion.symbol)).not.toContain("Am");
  });

  it("diatonic chords suggest secondary dominants that resolve to diatonic chords", () => {
    const gSuggestions = suggestNextChords(detectedChord("G", 7, "major"));
    const amSuggestions = suggestNextChords(detectedChord("Am", 9, "minor"));

    expect(gSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "E7",
          context: "Secondary dominant -> Am",
          romanNumeral: "V/vi -> vi",
        }),
      ]),
    );
    expect(amSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "D7",
          context: "Secondary dominant -> G",
          romanNumeral: "V/V -> V",
        }),
      ]),
    );
  });

  it("suggests the resolution after a played non-diatonic major secondary dominant", () => {
    expect(suggestNextChords(detectedChord("E", 4, "major"))).toEqual([
      expect.objectContaining({
        symbol: "Am",
        context: "Resolution from E7",
        romanNumeral: "vi",
        chordTones: ["A", "C", "E"],
      }),
    ]);
    expect(suggestNextChords(detectedChord("D", 2, "major"))).toEqual([
      expect.objectContaining({
        symbol: "G",
        context: "Resolution from D7",
        romanNumeral: "V",
        chordTones: ["G", "B", "D"],
      }),
    ]);
  });

  it("transposes secondary dominant rules to the selected key", () => {
    const suggestions = suggestNextChords(detectedChord("G", 7, "major"), {
      keyRoot: 7,
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "B7",
          context: "Secondary dominant -> Em",
          romanNumeral: "V/vi -> vi",
        }),
        expect.objectContaining({
          symbol: "A7",
          context: "Secondary dominant -> D",
          romanNumeral: "V/V -> V",
        }),
      ]),
    );
    expect(suggestions.map((suggestion) => suggestion.symbol)).not.toEqual(
      expect.arrayContaining(["D", "D7"]),
    );
  });
});

function detectedChord(
  symbol: string,
  root: number,
  quality: ChordCandidate["quality"],
): ChordCandidate {
  return {
    root,
    quality,
    symbol,
    confidence: 1,
    matchedPitchClasses: [],
    missingPitchClasses: [],
  };
}
