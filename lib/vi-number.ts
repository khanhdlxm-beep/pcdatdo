/** Numbers in Vietnamese reports: a dot groups thousands, a comma is decimal. */
export function parseViNumber(raw: string): number | undefined {
  const s = String(raw ?? '').trim().replace(/\s+/g, '').replace(/[−–—]/g, '-').replace(/%$/, '');
  if (!s || /^(?:-|–|—)$/.test(s)) return undefined;
  let normalized: string;
  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d+(?:,\d+)?$/.test(s)) {
    normalized = s.replace(',', '.');
  } else if (/^[+-]?\d+\.\d{1,2}$/.test(s)) {
    // Reports sometimes use a dot for decimals, e.g. 2.93 or 76.4%.
    normalized = s;
  } else {
    return undefined;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}
