// Staging-only mappings for the server response shapes. Not mounted in the app.
// Do not fabricate categories, snippets, attachments, body text, or delivery outcomes.
const text = value => typeof value === 'string' ? value : '';
const timestamp = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const requireRows = (value, property) => {
  if (!value || !Array.isArray(value[property])) throw new TypeError(`Invalid ${property} response`);
  return value[property];
};
export function mapMailbox(response, folder) {
  if (!['inbox','sent','archived','deleted'].includes(folder)) throw new TypeError('Unsupported mapped folder');
  return requireRows(response, 'items').map(row => {
    if (!row || typeof row.id !== 'string' || !row.id) throw new TypeError('Invalid mailbox row');
    const inbound = folder === 'inbox' || folder === 'archived' || (folder === 'deleted' && row.kind === 'received');
    const outgoing = folder === 'sent' || (folder === 'deleted' && row.kind === 'sent');
    if (!inbound && !outgoing) throw new TypeError('Invalid deleted message kind');
    return {
      id: row.id, kind: inbound ? 'received' : 'sent', folder,
      sender: text(row.from_name) || text(row.from_address) || text(row.from_email),
      from: text(row.from_address) || text(row.from_email),
      to: inbound ? text(row.to_address) : text(row.recipient),
      subject: text(row.subject), at: timestamp(inbound ? row.received_at : (row.created_at ?? row.received_at)),
      read: inbound && row.read_at != null ? true : inbound && folder !== 'deleted' ? false : null,
      status: text(row.status), queueStatus: text(row.queue_status), deliveryStatus: text(row.delivery_status),
    };
  });
}
export function mapMessage(response) {
  if (!response || typeof response.id !== 'string' || !response.id) throw new TypeError('Invalid message response');
  return {id:response.id, subject:text(response.subject), textBody:text(response.text_body),
    attachmentCount:typeof response.attachments === 'number' ? response.attachments : null,
    sourceUrl:typeof response.download_url === 'string' && /^\/api\/admin\/mail\/[0-9a-f-]{36}\/source$/i.test(response.download_url) ? response.download_url : null,
    status:text(response.status), queueStatus:text(response.queue_status), deliveryStatus:text(response.delivery_status)};
}
export function mapTemplateList(response) {
  return requireRows(response, 'templates').map(row => {
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') throw new TypeError('Invalid template row');
    return {id:row.id, name:row.name, updatedAt:timestamp(row.updated_at)};
  });
}
export function mapTemplateDetail(response) {
  const row=response?.template;
  if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') throw new TypeError('Invalid template detail');
  return {id:row.id,name:row.name,subject:text(row.subject),text:text(row.text_body),html:text(row.html_body),updatedAt:timestamp(row.updated_at)};
}
