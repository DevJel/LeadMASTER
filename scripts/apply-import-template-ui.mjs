import { readFile, writeFile } from 'node:fs/promises';
const source='src/Mandatory LeadMASTER Dashboard.html',mirror='public/dashboard.html';
let html=await readFile(source,'utf8');let panel=await readFile('src/compose-panel-replacement.html','utf8');
const importer=(await readFile('src/recipient-import.mjs','utf8')).replace('export function extractRecipientEmails','function extractRecipientEmails');
if(!panel.includes('{{IMPORT_FUNCTION}}'))throw Error('Missing import placeholder');panel=panel.replace('{{IMPORT_FUNCTION}}',importer);
const start=html.indexOf('<section id="lm-compose-page"');const end=html.indexOf('</script>',start)+9;
if(start<0||end<9||!html.slice(start,end).includes('id="lm-compose-form"'))throw Error('Expected composer not found');
html=html.slice(0,start)+panel+html.slice(end);
for(const [before,after] of [
 ['Saved email templates are not enabled for this account.','Save and insert account-owned templates from the email composer.'],
 ['No saved templates','Create and insert templates'],
 ['You can compose and send messages from Emails. A saved-template library is not currently available, so no sample templates are shown here.','Open Compose to save a subject and message as a template, or insert one you previously saved.']
]) {if(!html.includes(before))throw Error('Expected template text missing: '+before);html=html.replace(before,after)}
await writeFile(source,html,'utf8');await writeFile(mirror,html,'utf8');console.log('Installed import, template and HTML composer controls.');
