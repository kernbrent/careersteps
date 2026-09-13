import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve('dist');
const origin = 'https://www.choice1recruiting.com/';
const pages = new Map();
const assets = new Map();
const failures = [];
const decode = s => s.replaceAll('&amp;', '&');
async function get(url) {
  const cache=path.join('source-cache',crypto.createHash('sha256').update(url).digest('hex'));
  try { const type=await fs.readFile(cache+'.type','utf8'); return {body:await fs.readFile(cache),type}; } catch {}
  const r = await fetch(url, {signal: AbortSignal.timeout(60000)});
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const result={body: Buffer.from(await r.arrayBuffer()), type:r.headers.get('content-type') || ''};
  await fs.mkdir('source-cache',{recursive:true}); await fs.writeFile(cache,result.body); await fs.writeFile(cache+'.type',result.type);
  return result;
}
async function page(url) {
  const u = new URL(url, origin); u.hash=''; u.search='';
  if (pages.has(u.href)) return;
  pages.set(u.href, null);
  try {
    let result;
    try { result=await get(u.href); } catch(e) {
      if(!u.pathname.endsWith('.html')) throw e;
      result=await get(u.href.replace(/\.html$/,'/'));
    }
    const {body,type}=result;
    if (!type.includes('text/html')) return;
    const html = body.toString();
    let name=u.pathname.slice(1) || 'index.html';
    if (name.endsWith('/')) name+='index.html';
    pages.set(u.href, {html,name});
    for (const m of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
      const link = new URL(decode(m[1]), u);
      if (link.hostname.replace(/^www\./,'')==='choice1recruiting.com' && /(?:\.html|\/)$/i.test(link.pathname)) await page(link.href);
    }
  } catch(e) { failures.push(String(e)); }
}
function urls(text) {
  return [...new Set([...text.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)].map(m=>decode(m[0])))].filter(s=>/\.(?:cdn-website\.com|gstatic\.com)\/.+/.test(s) && !s.endsWith('/6522') && !s.includes('.svg?'));
}
async function asset(url) {
  if (assets.has(url)) return;
  const ext = path.extname(new URL(url).pathname);
  const name='/assets/'+crypto.createHash('sha256').update(url).digest('hex').slice(0,20)+(ext && ext.length<8 ? ext : '.css');
  assets.set(url,{name});
  try {
    const {body,type}=await get(url);
    const record=assets.get(url); record.body=body; record.type=type;
    if(body.length>25*1024*1024) {record.external=true; return;}
    if (type.includes('text/css')) {
      const css=body.toString();
      const children=urls(css);
      for (const m of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
        if (!m[1].startsWith('data:')) children.push(new URL(m[1],url).href);
      }
      for (const child of new Set(children)) await asset(child);
    }
  } catch(e) { failures.push(String(e)); assets.delete(url); }
}
await page(origin);
for (const p of pages.values()) if(p) for (const url of urls(p.html)) await asset(url);
function rewrite(text,base) {
  text=text.replace(/([ps]k)\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'');
  for (const [url,a] of [...assets].sort((a,b)=>b[0].length-a[0].length)) if(a.body && !a.external) text=text.replaceAll(url,a.name).replaceAll(url.replaceAll('&','&amp;'),a.name);
  if(base) text=text.replace(/url\(\s*(["']?)([^\s"')]+)\1\s*\)/g,(full,q,url)=>{
    if(url.startsWith('data:') || url.startsWith('/assets/')) return full;
    const a=assets.get(new URL(url,base).href); return a?.body ? `url(${q}${a.name}${q})` : full;
  });
  return text;
}
await fs.mkdir(root,{recursive:true});
for(const [url,p] of pages) if(p) {
  let html=rewrite(p.html);
  html=html.replaceAll('https://www.choice1recruiting.com/','https://choice.careersteps.net/').replaceAll('https://choice1recruiting.com/','https://choice.careersteps.net/');
  await fs.mkdir(path.dirname(path.join(root,p.name)),{recursive:true});
  await fs.writeFile(path.join(root,p.name),html);
}
await fs.mkdir(path.join(root,'assets'),{recursive:true});
for(const [url,a] of assets) if(a.body && !a.external) await fs.writeFile(path.join(root,a.name),a.type.includes('text/css')?rewrite(a.body.toString(),url):a.body);
await fs.writeFile('mirror-report.json',JSON.stringify({pages:[...pages].filter(x=>x[1]).map(([url,p])=>({url,file:p.name})),assets:[...assets].map(([url,a])=>({url,file:a.external?null:a.name,external:!!a.external,bytes:a.body?.length})),failures:[...new Set(failures)]},null,2));
console.log(JSON.stringify({pages:pages.size,assets:assets.size,failures},null,2));
