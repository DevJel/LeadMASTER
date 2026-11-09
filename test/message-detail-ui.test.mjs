import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync('src/Mandatory LeadMASTER Dashboard.html','utf8');
test('message errors render separately from the message body',()=>{assert(html.includes('liveMailDetail.error_message?a("p",{role:"status"'));assert(html.includes('children:liveMailDetail.text_body||"No readable message body."'));assert(!html.includes('children:liveMailDetail.text_body||liveMailDetail.error_message||'));});
