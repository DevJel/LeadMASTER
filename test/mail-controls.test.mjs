import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('src/Mandatory LeadMASTER Dashboard.html','utf8');
test('mail controls no longer claim unsupported filters and export',()=>{
  assert(!html.includes('Export prepared as a workspace feature'));
  assert(!html.includes('aria:"Last 15 days",value:S'));
  assert(html.includes('"aria-label":"Search messages"'));
});
test('mailbox has confirmation, authoritative reload, and uncertain results',()=>{
  assert(html.includes('window.confirm("Move this message to Deleted?")'));
  assert(html.includes('The result could not be confirmed. Refresh the mailbox before trying again.'));
  assert(html.includes('setLiveMailDetail(null);setMailRefresh(x=>x+1);R("Message moved to Deleted.")'));
  assert(html.includes('Messages are temporarily unavailable.'));
  assert(html.includes('Could not open message. Please try again.'));
});
