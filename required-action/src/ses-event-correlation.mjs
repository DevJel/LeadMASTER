/** Parse the optional numeric chunk suffix added by the SES SMTP transport. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSesEventCorrelation(value) {
  const correlation = String(value || "");
  const match = /^(.*)-(\d+)$/.exec(correlation);
  if (match && UUID.test(match[1]) && Number(match[2]) >= 1) {
    return { messageId: match[1], batchChunk: Number(match[2]) };
  }
  return { messageId: correlation, batchChunk: null };
}
