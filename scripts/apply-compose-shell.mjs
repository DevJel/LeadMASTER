import {readFile,writeFile} from 'node:fs/promises';
const path='src/Mandatory LeadMASTER Dashboard.html';let html=await readFile(path,'utf8');const replacement=await readFile('src/compose-shell-replacement.html','utf8');
const start=html.indexOf('<section id="lm-compose-page"'),end=html.indexOf('</script>',start)+9;
if(start<0||end<9||!html.slice(start,end).includes('id="lm-compose-form"')||!replacement.includes('main.appendChild(page)'))throw Error('Expected composer source not found');
html=html.slice(0,start)+replacement+html.slice(end);await writeFile(path,html);await writeFile('public/dashboard.html',html);console.log('Integrated composer into dashboard shell.');
