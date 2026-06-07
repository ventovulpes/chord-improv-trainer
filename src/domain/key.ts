import { pitchClassName } from "./noteEvents";

export type KeyMode = "major" | "minor";

export type KeySignature = {
  root: number;
  mode: KeyMode;
  label: string;
};

export const KEY_SIGNATURES: KeySignature[] = Array.from(
  { length: 12 },
  (_, root) => [
    { root, mode: "major" as const, label: `${pitchClassName(root)} major` },
    { root, mode: "minor" as const, label: `${pitchClassName(root)} minor` },
  ],
).flat();
