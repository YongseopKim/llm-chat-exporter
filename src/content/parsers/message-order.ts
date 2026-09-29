/** Merge overlapping mounted windows while walking towards older messages. */
export function mergeTurnOrder(existing: string[], incoming: string[]): string[] {
  if (existing.length === 0) {
    return [...incoming];
  }

  const known = new Set(existing);
  const merged: string[] = [];
  let i = 0;
  let j = 0;

  while (i < existing.length || j < incoming.length) {
    if (j >= incoming.length) {
      merged.push(existing[i]);
      i += 1;
    } else if (i >= existing.length || !known.has(incoming[j])) {
      merged.push(incoming[j]);
      j += 1;
    } else if (existing[i] === incoming[j]) {
      merged.push(existing[i]);
      i += 1;
      j += 1;
    } else {
      merged.push(existing[i]);
      i += 1;
    }
  }

  const seen = new Set<string>();
  return merged.filter((key) => {
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
