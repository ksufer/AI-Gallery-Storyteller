/** Escape regex metacharacters so a literal string can be used safely as a RegExp pattern. */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
