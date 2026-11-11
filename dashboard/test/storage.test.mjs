import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {migrate,sqliteDatabase} from '../src/sqlite-database.mjs';import {productionSchema,testSchema} from '../src/schema.mjs';import dashboard from '../src/worker.mjs';import {fixture,req,signed} from './helpers.mjs';
function storage(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');return {db,sql:{exec(query,...values){if(!values.length&&query.split(';').filter(v=>v.trim()).length>1){db.exec(query);return {toArray:()=>[]};}const rows=db.prepare(query).all(...values);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}

import {recoverPassword} from '../src/recovery.mjs';
import {passwordHash,verifyPassword} from '../src/security.mjs';
import {resetSchema} from '../src/email-recovery.mjs';
test('operator recovery changes only authentication, revokes old access, and applies once',async()=>{
 const s=storage();migrate(s,[{name:'initial',sql:productionSchema}]);
 s.db.exec(resetSchema);
 const env={...fixture(),DB:sqliteDatabase(s)},old=await signed(dashboard,env);
 const sites=s.db.prepare('SELECT * FROM sites ORDER BY id').all();
 const saved=await passwordHash('Local-only-recovered-password!');
 const config=JSON.stringify({id:crypto.randomUUID(),...saved});
 assert.equal(recoverPassword(s,config),true);
 assert(await verifyPassword(env,'Local-only-recovered-password!'));
 assert(!await verifyPassword(env,env.ADMIN_PASSWORD));
 assert.equal((await dashboard.fetch(req('/api/sites',{headers:old}),env)).status,401);
 assert.equal(s.db.prepare('SELECT count(*) n FROM launch_tickets').get().n,0);
 assert.deepEqual(s.db.prepare('SELECT * FROM sites ORDER BY id').all(),sites);
 const login=await dashboard.fetch(req('/api/login',{method:'POST',body:{username:'admin@careersteps.net',password:'Local-only-recovered-password!'}},env.APP_ORIGIN),env);
 assert.equal(login.status,200);
 assert.equal(recoverPassword(s,config),false);
 assert.equal(recoverPassword(s,undefined),false);
 assert.equal(s.db.prepare('SELECT count(*) n FROM sessions').get().n,1);
 assert.equal(s.db.prepare("SELECT count(*) n FROM audit_events WHERE action='password_reset'").get().n,1);
});
test('invalid recovery configuration and transaction failures leave credentials intact',()=>{
 const s=storage();migrate(s,[{name:'initial',sql:productionSchema}]);
 s.db.exec(resetSchema);
 assert.throws(()=>recoverPassword(s,'{"id":"bad","salt":"bad","hash":"bad"}'));
 assert.equal(s.db.prepare('SELECT count(*) n FROM settings').get().n,0);
 const config=JSON.stringify({id:crypto.randomUUID(),salt:'a'.repeat(43),hash:'b'.repeat(43)});
 s.db.exec('DROP TABLE audit_events');
 assert.throws(()=>recoverPassword(s,config));
 assert.equal(s.db.prepare('SELECT count(*) n FROM settings').get().n,0);
});
test('hosted SQLite migration is atomic, idempotent, and preserves edited records',()=>{const s=storage(),m=[{name:'initial',sql:productionSchema}];migrate(s,m);s.db.prepare("UPDATE sites SET name='Preserved change' WHERE id='careersteps'").run();migrate(s,m);assert.equal(s.db.prepare('SELECT count(*) n FROM sites').get().n,12);assert.equal(s.db.prepare("SELECT name FROM sites WHERE id='careersteps'").get().name,'Preserved change');assert.throws(()=>migrate(s,[{name:'bad',sql:"CREATE TABLE unwanted(id); INSERT INTO missing VALUES(1);"}]));assert(!s.db.prepare("SELECT name FROM sqlite_master WHERE name='unwanted'").get());});
test('hosted SQLite query adapter runs the real dashboard login, encrypted CRUD, and rollback',async()=>{const s=storage();migrate(s,[{name:'initial',sql:productionSchema}]);const env={...fixture(),DB:sqliteDatabase(s)},h=await signed(dashboard,env);const r=await dashboard.fetch(req('/api/sites',{method:'POST',headers:h,body:{name:'Hosted check',publicUrl:'https://hosted.example/',mode:'public',password:'hosted-password'}}),env);assert.equal(r.status,200);const list=await (await dashboard.fetch(req('/api/sites',{headers:h}),env)).json();assert.equal(list.sites.length,13);await assert.rejects(env.DB.batch([env.DB.prepare("UPDATE sites SET name='Should roll back' WHERE id='careersteps'"),env.DB.prepare('INSERT INTO missing VALUES(1)')]));assert.equal(s.db.prepare("SELECT name FROM sites WHERE id='careersteps'").get().name,'Career Steps');});
test('hosted test schema cannot point a connected HS or Prayer tile at production',()=>{const s=storage();migrate(s,[{name:'initial',sql:testSchema}]);const connected=s.db.prepare("SELECT id,public_url FROM sites WHERE mode='bridge' ORDER BY id").all();assert.deepEqual(connected.map(r=>r.id),['hopesojourns','prayer']);assert.equal(connected[0].public_url,'https://test.hopesojourns.com/');assert.equal(connected[1].public_url,'https://prayer-test.hopesojourns.com/');});
