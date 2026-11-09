import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),earth=path.resolve(root,'../../Earthquakes');
await mkdir(path.join(earth,'worker/src'),{recursive:true});await copyFile(path.join(root,'src/security.mjs'),path.join(earth,'worker/src/security.mjs'));
const lines=['-- Initial public team data, copied from the existing site. Apply only to the new dedicated admin database.'];
for(const key of ['calendar','roster','results']){const records=JSON.parse(await readFile(path.join(earth,'data',key+'.json'),'utf8'));lines.push(`INSERT INTO content(key,value,revision,updated_at) VALUES('${key}','${JSON.stringify(records).replaceAll("'","''")}',1,0);`);}
await writeFile(path.join(earth,'worker/migrations/0002_seed_existing_data.sql'),lines.join('\n')+'\n');console.log('NTX admin security helper and initial public data prepared. Existing public files unchanged.');
