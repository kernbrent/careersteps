import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve('dist');
const errors=[];
let pageCount=0, referenceCount=0;
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.html'))) {
  pageCount++;
  const html=fs.readFileSync(path.join(root,name),'utf8');
  for(const m of html.matchAll(/(?:href|src|poster)=["']([^"']+)["']/g)) {
    const value=m[1];
    if(/^(https?:|mailto:|tel:|data:|#|javascript:|\/\/)/.test(value)) continue;
    const local=path.join(root,value.split(/[?#]/)[0]);
    if(value && !fs.existsSync(local)) errors.push(`${name}: missing ${value}`);
    referenceCount++;
  }
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(/type=["']application\/(?:ld\+)?json/.test(m[1]) || !m[2].trim()) continue;
    try{new vm.Script(m[2]);}catch(e){errors.push(`${name}: ${e.message}`);}
  }
}
console.log(JSON.stringify({pageCount,referenceCount,errors},null,2));
if(process.argv.includes('--live')) {
  const files=fs.readdirSync(root,{recursive:true}).filter(n=>fs.statSync(path.join(root,n)).isFile());
  let checked=0;
  for(let start=0;start<files.length;start+=8) await Promise.all(files.slice(start,start+8).map(async name=>{
    const r=await fetch('https://choice.careersteps.net/'+name.replaceAll('\\','/'));
    const body=Buffer.from(await r.arrayBuffer());
    if(!r.ok || !body.equals(fs.readFileSync(path.join(root,name)))) errors.push(`Live mismatch: ${name} (${r.status})`);
    checked++;
  }));
  const home=await fetch('https://choice.careersteps.net/');
  if(!home.ok) errors.push('Homepage failed');
  console.log(JSON.stringify({liveFilesChecked:checked,errors},null,2));
}
if(errors.length) process.exitCode=1;
