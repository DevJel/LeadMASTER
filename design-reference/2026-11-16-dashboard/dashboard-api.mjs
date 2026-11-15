// Staging-only API adapter. Not yet loaded by the production dashboard.
// Do not add credentials, simulated persistence, automatic retries, or delivery claims here.
export class DashboardApiError extends Error {
  constructor(message, {status = 0, data = null, uncertain = false} = {}) {
    super(message);
    this.name = 'DashboardApiError';
    this.status = status;
    this.data = data;
    this.uncertain = uncertain;
  }
}

export function createDashboardApi(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  const segment = value => {
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new TypeError('Invalid resource ID');
    return encodeURIComponent(value);
  };
  async function request(path, {method = 'GET', body} = {}) {
    let response;
    try {
      response = await fetchImpl(path, {
        method, credentials: 'same-origin', cache: 'no-store',
        ...(body === undefined ? {} : {headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}),
      });
    } catch {
      // A failed connection to a mutating endpoint cannot establish whether it ran.
      throw new DashboardApiError('The request could not be confirmed. Check the current state before retrying.', {uncertain: method !== 'GET'});
    }
    let data;
    try { data = await response.json(); }
    catch { throw new DashboardApiError('The response could not be read. Check the current state before retrying.', {status: response.status, uncertain: method !== 'GET'}); }
    if (!response.ok) throw new DashboardApiError(typeof data?.error === 'string' ? data.error : 'The request failed.', {
      status: response.status, data, uncertain: data?.status === 'submission_unconfirmed' || (method !== 'GET' && response.status >= 500),
    });
    return data;
  }
  const mailId = id => `/api/admin/mail/${segment(id)}`;
  const templateId = id => `/api/admin/templates/${segment(id)}`;
  const groupId = id => `/api/admin/audience/groups/${segment(id)}`;
  const keyId = id => `/api/developer/keys/${segment(id)}`;
  const hookId = id => `/api/admin/webhooks/${segment(id)}`;
  return Object.freeze({
    session: () => request('/api/auth/session'),
    profile: () => request('/api/account/profile'),
    updateProfile: fullName => request('/api/account/profile', {method:'PATCH', body:{fullName}}),
    logout: () => request('/api/auth/logout', {method:'POST'}),
    mailbox: ({folder = 'inbox', q = '', domain = ''} = {}) => {
      if (!['counts','inbox','sent','bounced','unsuccessful','unsubscribed','archived','deleted'].includes(folder)) throw new TypeError('Unsupported mailbox folder');
      const query = new URLSearchParams({folder});
      if (q) query.set('q',q);
      if (domain) query.set('domain',domain);
      return request(`/api/admin/mail?${query}`);
    },
    message: id => request(mailId(id)),
    messageAction: (id, action, read) => {
      if (!['read','archive','unarchive','delete','restore','permanentDelete'].includes(action)) throw new TypeError('Unsupported mailbox action');
      if (action === 'read' && typeof read !== 'boolean') throw new TypeError('Read state must be boolean');
      return request(mailId(id), {method:'PATCH', body:action === 'read' ? {action,read} : {action}});
    },
    suggestReply: id => request(`${mailId(id)}/suggest`, {method:'POST'}),
    send: message => request('/api/admin/send', {method:'POST',body:message}),
    sendBatches: () => request('/api/admin/send-batches'),
    templates: () => request('/api/admin/templates'),
    template: id => request(templateId(id)),
    createTemplate: template => request('/api/admin/templates', {method:'POST',body:template}),
    updateTemplate: (id, template) => request(templateId(id), {method:'PUT',body:template}),
    deleteTemplate: id => request(templateId(id), {method:'DELETE'}),
    groups: () => request('/api/admin/audience/groups'),
    group: id => request(groupId(id)),
    createGroup: name => request('/api/admin/audience/groups', {method:'POST',body:{name}}),
    addGroupMembers: (id, emails) => request(`${groupId(id)}/members`, {method:'POST',body:{emails}}),
    suppressions: () => request('/api/admin/unsubscribes'),
    addSuppression: (email, reason) => request('/api/admin/unsubscribes', {method:'POST',body:{email,reason}}),
    activity: () => request('/api/admin/activity'),
    notifications: () => request('/api/admin/notifications'),
    readNotification: id => request(`/api/admin/notifications/${segment(id)}`, {method:'POST'}),
    apiKeys: () => request('/api/developer/keys'),
    createApiKey: value => request('/api/developer/keys', {method:'POST',body:value}),
    revokeApiKey: id => request(keyId(id), {method:'DELETE'}),
    webhooks: () => request('/api/admin/webhooks'),
    createWebhook: value => request('/api/admin/webhooks', {method:'POST',body:value}),
    revokeWebhook: id => request(hookId(id), {method:'DELETE'}),
    webhookDeliveries: id => request(`${hookId(id)}/deliveries`),
  });
}
