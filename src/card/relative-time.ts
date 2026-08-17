export function formatRelativeAge(date: Date, now: Date): string {
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

// Same floor-to-minutes/floor-to-hours bucketing as formatRelativeAge, just phrased for a
// duration-since-mount instead of an age-of-a-timestamp, so "running for" reads naturally.
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return `${Math.floor(ms / 1000)}s`;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainderMin = minutes % 60;
  return remainderMin ? `${hours}h ${remainderMin}m` : `${hours}h`;
}
