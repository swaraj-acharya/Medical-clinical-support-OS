/**
 * Removes obvious direct identifiers from free text before it leaves the app (AI extraction, research prompts).
 * Defence in depth only — the UI also asks clinicians never to enter identifiers. Pure; safe on client and server.
 */
export function scrubIdentifiers(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, "[number]")
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[id]")
    .replace(/\b(mr|mrs|ms|miss|dr|shri|smt|kumari|master|baby)\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/gi, "[name]")
    .replace(/\b(UHID|MRN|IP|OP|OPD|reg(istration)?)\s*(no\.?|number|#|:)?\s*[A-Z0-9/-]{3,}/gi, "[record-no]");
}
