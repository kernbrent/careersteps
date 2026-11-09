import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const definitions=[
 ['careersteps','careersteps.net','careersteps-admin-api','/api/admin/login','standard'],
 ['christiansteps','christiansteps.net','christian-steps-admin-api','/api/admin/login','standard'],
 ['hopesojourns','hopesojourns.com','hope-sojourns-interest-production','/api/interest/admin/login','hope'],
 ['hope-test','test.hopesojourns.com','hope-sojourns-interest-test','/api/interest/admin/login','hope'],
 ['choice1','choice1recruiting.com','choice1-recruiting','/api/admin/login','standard'],
 ['josh','joshbeyondborders.org',null,null,'workbook'],
 ['prayer','prayer.hopesojourns.com','hope-sojourns-prayer-production','/api/login','prayer'],
 ['prayer-test','prayer-test.hopesojourns.com','hope-sojourns-prayer-test','/api/login','prayer'],
 ['earthquakes','ntxearthquakes.com','ntx-earthquakes-admin','/api/site-admin/login','standard']
];
const accounts={careersteps:'dd6360191de72c9a8f0b45e1676cec65',christiansteps:'dd6360191de72c9a8f0b45e1676cec65',hopesojourns:'dd6360191de72c9a8f0b45e1676cec65','hope-test':'dd6360191de72c9a8f0b45e1676cec65',choice1:'7f6fca36cf1374a72ec972086e4fc680',josh:'dd6360191de72c9a8f0b45e1676cec65',prayer:'dd6360191de72c9a8f0b45e1676cec65','prayer-test':'dd6360191de72c9a8f0b45e1676cec65',earthquakes:'dd6360191de72c9a8f0b45e1676cec65'};
// Account and zone ownership verified against Cloudflare before the approved release.
await mkdir(path.join(root,'connectors','configs'),{recursive:true});
for(const [id,host,service,login,kind] of definitions){const test=id==='hope-test'||id==='prayer-test';const config={name:'dashboard-connect-'+id,main:'../worker.mjs',compatibility_date:'2026-09-01',workers_dev:false,preview_urls:false,routes:[{pattern:host+'/dashboard-connect*',zone_name:host.split('.').slice(-2).join('.')},{pattern:host+'/api/dashboard-connect/*',zone_name:host.split('.').slice(-2).join('.')}],vars:{SITE_ID:id==='hope-test'?'hopesojourns':id==='prayer-test'?'prayer':id,SITE_ORIGIN:'https://'+host,DASHBOARD_ORIGIN:test?'https://dashboard-test.careersteps.net':'https://dashboard.careersteps.net',AUTH_KIND:kind,AUTH_NEXT:id.startsWith('prayer')?'/':'/admin/'}};if(accounts[id])config.account_id=accounts[id];if(service){config.services=[{binding:'AUTH_BACKEND',service}];config.vars.AUTH_LOGIN_PATH=login;}if(kind==='workbook')config.vars.AUTH_NEXT='/admin/';await writeFile(path.join(root,'connectors','configs',id+'.jsonc'),JSON.stringify(config,null,2)+'\n');}
console.log('Prepared nine isolated connector configurations. No credentials, remote changes, or deployments.');
