/** Source hierarchy (see ARCHITECTURE.md §Source hierarchy). Lower number = more authoritative. */
export type SourceLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MedicalSystem = "allopathy" | "ayurveda" | "homeopathy";
export type SystemScope = MedicalSystem | "shared";

/**
 * How a fact entered the knowledge base.
 * - imported-from-source: machine-imported from a bundled, licensed dataset (importer output).
 * - curated-pending-verification: hand-curated seed fact, not yet machine-verified against the live source.
 * - curated-verified: curated fact cross-checked against the cited source by an importer or reviewer.
 * - metadata-only: we hold a pointer/citation only; content is not copied (licence or size).
 */
export type VerificationStatus =
  | "imported-from-source"
  | "curated-pending-verification"
  | "curated-verified"
  | "metadata-only";

export interface SourceRef {
  sourceId: string;
  reference?: string;
  url?: string;
  version?: string;
  lastVerified?: string;
  note?: string;
}

export interface Provenanced {
  sources: SourceRef[];
  verification: VerificationStatus;
}

export interface SourceRegistryEntry {
  id: string;
  name: string;
  system: SystemScope;
  type: string;
  level: SourceLevel;
  url: string;
  description: string;
  codeLicense: string | null;
  dataLicense: string;
  commercialUse: "permitted" | "restricted" | "prohibited" | "unclear" | "not-applicable";
  redistribution: "permitted" | "permitted-with-conditions" | "not-permitted" | "unclear";
  attributionRequired: boolean;
  attributionText?: string;
  integration: "bundled-import" | "bundled-subset" | "api-adapter" | "user-supplied-import" | "metadata-only" | "reference-link" | "architecture-reference";
  dataCopied: boolean;
  importedFields: string[];
  updateFrequency: string;
  lastChecked: string;
  lastUpstreamUpdate?: string;
  status: "active" | "stale" | "unavailable" | "unverified";
  recommendedUse: string;
  provenance: string;
  notes: string;
}
