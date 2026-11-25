// Mirrors what pipeline/build.mjs writes.
export type Timed = { at: number; text: string };
export type NameItem = { arabic: string; latin: string; meaning: string };
export type Verse = { key: string; surah: string; arabic: string; translation: string; source: string };

export type Scene = {
  type: "lines" | "reveal" | "verse" | "names" | "doors" | "end";
  audio: { from: number; to: number };
  lines: Timed[];
  arabic?: string;
  verse?: Verse;
  names?: NameItem[];
  title?: string;
  footer?: string;
};

export type Storyboard = {
  source: { title: string; url: string; audioFile: string };
  fps: number;
  review: { approved: boolean; reviewer: string; flags: string[] };
  scenes: Scene[];
};
