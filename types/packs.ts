/** Compact on-disk formats written by scripts/import/import-oorep.ts (gzip JSON). */
export interface PublicumPack {
  meta: Record<string, unknown> & { repertory: string; title: string; license: string; counts: Record<string, number> };
  /** [oorepRemedyId, abbrev, fullName, altNames] */
  remedies: [number, string, string, string[]][];
  /** [oorepRubricId, fullPath] — path segments joined with ", " (first segment = chapter) */
  rubrics: [number, string][];
  /** rubricId → [[remedyId, grade]] */
  relations: Record<string, [number, number][]>;
}

export interface BoerickePack {
  meta: Record<string, unknown> & { title: string; author: string; year: string; license: string };
  entries: { remedyId: number; heading: string; sections: { heading: string; depth: number; text: string }[] }[];
}
