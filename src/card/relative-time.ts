// The card's own wall-clock stamp: two-digit year through minutes, in the browser's local
// zone. Lives here beside the relative phrasings rather than in card-template.ts, so the
// modules that only need a timestamp (the debug overlay) don't have to import a template
// module to get one.
export function formatDate(date: Date): string {
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

// Minutes to the coarsest unit that still reads as a number, shared by both tenses below so
// the "m" -> "h" step happens at one place rather than once per affix.
const bucket = (minutes: number) => (minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`);

export function formatRelativeAge(date: Date, now: Date): string {
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  return diffMin < 1 ? "just now" : `${bucket(diffMin)} ago`;
}

/**
 * The same phrasing as formatRelativeAge, but for an instant that may be in either direction.
 *
 * Earth and Sun tiles only ever show images already captured, so "ago" is the only tense they
 * need. The sky Moon tile points at 22:00 local, which is ahead of the user for most of the
 * day and behind them between 22:00 and midnight — one caption that flips tense on its own,
 * rather than two captions and a rule for choosing between them.
 */
export function formatRelativeWhen(date: Date, now: Date): string {
  // Floored, not rounded, so the sub-minute window either side of the instant reads "just
  // now" the same way it does on its way past — rounding would tick over to "in 1m" while the
  // moment is still half a minute away.
  const diffMin = Math.floor((date.getTime() - now.getTime()) / 60000);
  return diffMin <= 0 ? formatRelativeAge(date, now) : `in ${bucket(diffMin)}`;
}

// Deliberately not `bucket`: a duration-since-mount starts at zero, so it needs a seconds case
// the relative phrasings never reach, and it keeps the remainder minutes ("2h 5m") that an age
// throws away.
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return `${Math.floor(ms / 1000)}s`;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainderMin = minutes % 60;
  return remainderMin ? `${hours}h ${remainderMin}m` : `${hours}h`;
}
