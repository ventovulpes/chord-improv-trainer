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
          concept: "secondaryDominant",
          context: "Secondary dominant → Am",
          romanNumeral: "V/vi → vi",
          chordTones: ["E", "G#", "B", "D"],
        }),
        expect.objectContaining({
          symbol: "D7",
          concept: "secondaryDominant",
          context: "Secondary dominant → G",
          romanNumeral: "V/V → V",
          chordTones: ["D", "F#", "A", "C"],
        }),
        expect.objectContaining({
          symbol: "A7",
          concept: "secondaryDominant",
          context: "Secondary dominant → Dm",
          romanNumeral: "V/ii → ii",
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
          concept: "diatonic",
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

    expect(secondaryDominantSymbols).toEqual(
      expect.arrayContaining(["E7", "D7", "A7"]),
    );
    expect(secondaryDominantSymbols).toHaveLength(3);
    expect(secondaryDominantSymbols).not.toEqual(
      expect.arrayContaining(["C7", "F7", "G7", "B7"]),
    );
  });

  it("uses weighted randomness to order suggestions", () => {
    const lowRandomSuggestions = suggestNextChords(
      detectedChord("C", 0, "major"),
      { random: () => 0 },
    );
    const highRandomSuggestions = suggestNextChords(
      detectedChord("C", 0, "major"),
      { random: () => 0.99 },
    );

    expect(lowRandomSuggestions.map((suggestion) => suggestion.symbol)).not.toEqual(
      highRandomSuggestions.map((suggestion) => suggestion.symbol),
    );
    expect(new Set(lowRandomSuggestions.map((suggestion) => suggestion.id)).size)
      .toBe(lowRandomSuggestions.length);
  });

  it("weights the selected concept ahead of other suggestions", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"), {
      random: () => 0.25,
      selectedConcept: "tritoneSubstitution",
    });

    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        concept: "tritoneSubstitution",
      }),
    );
  });

  it("penalizes repeated suggestions", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"), {
      random: () => 0,
    });
    const repeatedSuggestion = suggestions[0];
    const rerankedSuggestions = suggestNextChords(
      detectedChord("G", 7, "major"),
      {
        random: () => 0.05,
        recentSuggestionIds: [repeatedSuggestion.id],
      },
    );

    expect(rerankedSuggestions[0]?.id).not.toBe(repeatedSuggestion.id);
    expect(rerankedSuggestions.map((suggestion) => suggestion.id)).toContain(
      repeatedSuggestion.id,
    );
  });

  it("deduplicates suggestions by symbol and concept", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"));
    const uniqueKeys = new Set(
      suggestions.map((suggestion) => `${suggestion.symbol}-${suggestion.concept}`),
    );

    expect(uniqueKeys.size).toBe(suggestions.length);
  });

  it("generates Phase 5 harmonic concepts through the shared suggestion system", () => {
    const suggestions = suggestNextChords(detectedChord("C", 0, "major"));

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "Fm",
          concept: "borrowedIv",
          context: "Borrowed iv → C",
          romanNumeral: "iv → I",
        }),
        expect.objectContaining({
          symbol: "A#",
          concept: "modalMixture",
          romanNumeral: "bVII",
        }),
        expect.objectContaining({
          symbol: "C#7",
          concept: "tritoneSubstitution",
          context: "Tritone substitution → C",
          romanNumeral: "subV/I → I",
        }),
        expect.objectContaining({
          symbol: "C#dim7",
          concept: "diminishedPassing",
          context: "Diminished passing chord → Dm",
          romanNumeral: "#i°7 → ii",
        }),
      ]),
    );
  });

  it("only suggests diminished passing chords a half step above the current chord", () => {
    const cSuggestions = suggestNextChords(detectedChord("C", 0, "major"));
    const fSuggestions = suggestNextChords(detectedChord("F", 5, "major"));
    const gSuggestions = suggestNextChords(detectedChord("G", 7, "major"));

    expect(
      cSuggestions
        .filter((suggestion) => suggestion.concept === "diminishedPassing")
        .map((suggestion) => suggestion.symbol),
    ).toEqual(["C#dim7"]);
    expect(
      fSuggestions
        .filter((suggestion) => suggestion.concept === "diminishedPassing")
        .map((suggestion) => suggestion.symbol),
    ).toEqual(["F#dim7"]);
    expect(
      gSuggestions
        .filter((suggestion) => suggestion.concept === "diminishedPassing")
        .map((suggestion) => suggestion.symbol),
    ).toEqual(["G#dim7"]);
  });

  it("does not suggest the currently detected chord", () => {
    const cSuggestions = suggestNextChords(detectedChord("C", 0, "major"));
    const gSuggestions = suggestNextChords(detectedChord("G", 7, "major"));
    const amSuggestions = suggestNextChords(detectedChord("Am", 9, "minor"));
    const g7Suggestions = suggestNextChords(
      detectedChord("G7", 7, "dominant7"),
    );

    expect(cSuggestions.map((suggestion) => suggestion.symbol)).not.toContain("C");
    expect(gSuggestions.map((suggestion) => suggestion.symbol)).not.toContain("G");
    expect(amSuggestions.map((suggestion) => suggestion.symbol)).not.toContain("Am");
    expect(g7Suggestions.map((suggestion) => suggestion.symbol)).not.toContain("G");
  });

  it("diatonic chords suggest secondary dominants that resolve to diatonic chords", () => {
    const gSuggestions = suggestNextChords(detectedChord("G", 7, "major"));
    const amSuggestions = suggestNextChords(detectedChord("Am", 9, "minor"));

    expect(gSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "E7",
          context: "Secondary dominant → Am",
          romanNumeral: "V/vi → vi",
        }),
      ]),
    );
    expect(amSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "D7",
          context: "Secondary dominant → G",
          romanNumeral: "V/V → V",
        }),
      ]),
    );
  });

  it("suggests the resolution after a played non-diatonic major secondary dominant", () => {
    expect(suggestNextChords(detectedChord("E", 4, "major"))).toEqual([
      expect.objectContaining({
        symbol: "Am",
        concept: "secondaryDominant",
        context: "Resolution from E7",
        romanNumeral: "vi",
        chordTones: ["A", "C", "E"],
      }),
    ]);
    expect(suggestNextChords(detectedChord("E7", 4, "dominant7"))).toEqual([
      expect.objectContaining({
        symbol: "Am",
        concept: "secondaryDominant",
        context: "Resolution from E7",
        romanNumeral: "vi",
        chordTones: ["A", "C", "E"],
      }),
    ]);
    expect(suggestNextChords(detectedChord("D", 2, "major"))).toEqual([
      expect.objectContaining({
        symbol: "G",
        concept: "secondaryDominant",
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
          context: "Secondary dominant → Em",
          romanNumeral: "V/vi → vi",
        }),
        expect.objectContaining({
          symbol: "A7",
          context: "Secondary dominant → D",
          romanNumeral: "V/V → V",
        }),
      ]),
    );
    expect(suggestions.map((suggestion) => suggestion.symbol)).not.toEqual(
      expect.arrayContaining(["D", "D7"]),
    );
  });

  it("suggests natural minor diatonic chords in a selected minor key", () => {
    const suggestions = suggestNextChords(detectedChord("Am", 9, "minor"), {
      keyMode: "minor",
      keyRoot: 9,
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "Bdim",
          concept: "diatonic",
          romanNumeral: "ii°",
          chordTones: ["B", "D", "F"],
        }),
        expect.objectContaining({
          symbol: "C",
          concept: "diatonic",
          romanNumeral: "bIII",
        }),
        expect.objectContaining({
          symbol: "Dm",
          concept: "diatonic",
          romanNumeral: "iv",
        }),
        expect.objectContaining({
          symbol: "Em",
          concept: "diatonic",
          romanNumeral: "v",
        }),
        expect.objectContaining({
          symbol: "F",
          concept: "diatonic",
          romanNumeral: "bVI",
        }),
        expect.objectContaining({
          symbol: "G",
          concept: "diatonic",
          romanNumeral: "bVII",
        }),
      ]),
    );
    expect(suggestions.map((suggestion) => suggestion.symbol)).not.toContain("Am");
  });

  it("generates minor-key harmonic concepts in a selected minor key", () => {
    const suggestions = suggestNextChords(detectedChord("Am", 9, "minor"), {
      keyMode: "minor",
      keyRoot: 9,
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "E7",
          concept: "harmonicMinorDominant",
          context: "Harmonic minor dominant → Am",
          romanNumeral: "V7 → i",
          chordTones: ["E", "G#", "B", "D"],
        }),
        expect.objectContaining({
          symbol: "G#dim7",
          concept: "harmonicMinorDominant",
          romanNumeral: "vii°7 → i",
        }),
        expect.objectContaining({
          symbol: "A#",
          concept: "neapolitan",
          context: "Neapolitan predominant → E7",
          romanNumeral: "bII → V",
        }),
        expect.objectContaining({
          symbol: "A",
          concept: "picardyThird",
          context: "Picardy third color on Am",
          romanNumeral: "I",
        }),
      ]),
    );
  });

  it("suggests minor-key resolutions for harmonic minor dominant and Neapolitan chords", () => {
    expect(
      suggestNextChords(detectedChord("E7", 4, "dominant7"), {
        keyMode: "minor",
        keyRoot: 9,
      }),
    ).toEqual([
      expect.objectContaining({
        symbol: "Am",
        concept: "harmonicMinorDominant",
        context: "Resolution from E7",
        romanNumeral: "i",
      }),
    ]);
    expect(
      suggestNextChords(detectedChord("A#", 10, "major"), {
        keyMode: "minor",
        keyRoot: 9,
      }),
    ).toEqual([
      expect.objectContaining({
        symbol: "E7",
        concept: "neapolitan",
        context: "Resolution from A#",
        romanNumeral: "V7",
      }),
    ]);
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
