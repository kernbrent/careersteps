import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {bytes64} from '../src/security.mjs';
import {resetSchema} from '../src/email-recovery.mjs';
export class D1 {
 constructor(schema){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec('PRAGMA foreign_keys=ON;');this.sqlite.exec(schema);}
 prepare(sql){const db=this.sqlite;let values=[];const s={bind(...v){values=v;return s;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const r=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}};}};return s;}
 async batch(statements){this.sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.sqlite.exec('COMMIT');return out;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
export const schema=readFileSync(fileURLToPath(new URL('../migrations/0001_dashboard.sql',import.meta.url)),'utf8')+resetSchema;
export function fixture(){const DB=new D1(schema);return {DB,APP_ORIGIN:'https://dashboard.careersteps.net',ADMIN_USERNAME:'admin@careersteps.net',ADMIN_PASSWORD:'Local-test-password-2026!',VAULT_KEY:bytes64(crypto.getRandomValues(new Uint8Array(32))),ASSETS:{fetch:async()=>new Response('<h1>Dashboard</h1>',{headers:{'Content-Type':'text/html'}})}};}
export function req(path,options={},origin='https://dashboard.careersteps.net'){return new Request(new URL(path,origin),{...options,headers:{Origin:origin,'Content-Type':'application/json',...options.headers},...(options.body&&typeof options.body!=='string'?{body:JSON.stringify(options.body)}:{})});}
export async function signed(worker,env){const response=await worker.fetch(req('/api/login',{method:'POST',body:{username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD}}),env);const b=await response.json();return {'Cookie':response.headers.getSetCookie()[0].split(';')[0],'X-CSRF-Token':b.csrf};}
