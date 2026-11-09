import { readFile, writeFile } from 'node:fs/promises';
const source='src/Mandatory LeadMASTER Dashboard.html', mirror='public/dashboard.html';
const fragment=await readFile('src/compose-panel.html','utf8');
let html=await readFile(source,'utf8');
if(!html.includes('id="lm-compose-page"')) {
 const start=html.indexOf('<dialog id="lm-live-compose"');
 const script=html.indexOf('<script>(function(){const dlg=document.getElementById("lm-live-compose")',start);
 const end=html.indexOf('</script>',script)+9;
 if(start<0||script<0||end<9)throw Error('Expected original composer not found; refusing to edit');
 html=html.slice(0,start)+fragment+html.slice(end);
 const exact='document.getElementById("lm-live-compose").showModal()';
 const optional='document.getElementById("lm-live-compose")?.showModal()';
 if(html.split(exact).length!==2||html.split(optional).length!==3)throw Error('Unexpected composer entry points');
 html=html.replaceAll(exact,'window.lmOpenComposer()').replaceAll(optional,'window.lmOpenComposer()');
 const edits=[['{id:"broadcasts",label:"Broadcasts",icon:"broadcasts"}','{id:"broadcasts",label:"Campaigns",icon:"broadcasts"}'],['title:"Broadcasts",sub:"Send a one-time message to up to 500 recipients using the existing sending queue."','title:"Campaigns",sub:"Immediate group emails use the sending queue. Saved groups and scheduling are not available yet."'],['" New broadcast"','" New campaign"'],['children:"Compose broadcast"','children:"Compose email"']];
 for(const [before,after] of edits){if(!html.includes(before))throw Error('Expected campaign label not found: '+before);html=html.replace(before,after);}
}
await writeFile(source,html,'utf8');await writeFile(mirror,html,'utf8');
console.log('Composer page installed and dashboard mirror synchronized.');
