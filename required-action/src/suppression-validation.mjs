/** Match the admin send endpoint's basic address shape without accepting whitespace. */
export function validSuppressionEmail(value) {
  return typeof value === 'string' && value.length <= 254 && !value.includes('..') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
