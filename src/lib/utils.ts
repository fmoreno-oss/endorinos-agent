export function daysAgo(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function parsePeriod(input: string): number {
  const match = input.match(/^(\d+)([dhw])$/);
  if (!match) return 1; // default 1 day

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'h': return value / 24;
    case 'd': return value;
    case 'w': return value * 7;
    default: return 1;
  }
}
