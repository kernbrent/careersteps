import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{await access(path.join(root,'.dev.vars'));console.log('Local setup already exists; no secrets were changed.');process.exit(0);}catch{}
const password=randomBytes(24).toString('base64url'),vault=randomBytes(32).toString('base64url');
await mkdir(path.join(root,'.private'),{recursive:true});
await writeFile(path.join(root,'.dev.vars'),`ADMIN_PASSWORD="${password}"\nVAULT_KEY="${vault}"\nAPP_ORIGIN="http://localhost:8798"\n`,{mode:0o600});
await writeFile(path.join(root,'.private','LOCAL-LOGIN.txt'),`LOCAL PREVIEW ONLY\nhttp://localhost:8798\nUsername: admin@careersteps.net\nPassword: ${password}\n\nProduction uses separately provisioned secrets. Never publish this file.\n`,{mode:0o600});
console.log('Local-only secrets created. Open .private/LOCAL-LOGIN.txt for preview access.');
