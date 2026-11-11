import {Problem,body,sameOrigin,rate,token,digest,json,passwordHash} from './security.mjs';
export const resetSchema='CREATE TABLE password_resets(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);';
const response=()=>json({ok:true,message:'If those details match your account, a reset link will arrive at your recovery email. Check your inbox and spam folder.'});
export async function requestReset(request,env){
 sameOrigin(request,env.APP_ORIGIN);const b=await body(request,1000);
 await rate(env.DB,'reset-request:'+(request.headers.get('CF-Connecting-IP')||'local'),5);
 const identity=typeof b.username==='string'?b.username.trim().toLowerCase():'';
 if(!identity||![env.ADMIN_USERNAME?.toLowerCase(),env.RECOVERY_EMAIL?.toLowerCase()].includes(identity))return response();
 if(!env.RECOVERY_EMAIL||!env.RECOVERY_FROM||!env.RECOVERY_MAIL?.send)throw new Problem(503,'Password recovery is temporarily unavailable. Please try again later.');
 await rate(env.DB,'reset-email',3);
 const raw=token(),hash=await digest(raw),link=new URL('/',env.APP_ORIGIN);link.hash='reset='+raw;
 await env.DB.batch([env.DB.prepare('DELETE FROM password_resets WHERE expires_at<=?').bind(Date.now()),env.DB.prepare('INSERT INTO password_resets(token_hash,expires_at) VALUES(?,?)').bind(hash,Date.now()+900000)]);
 try{await env.RECOVERY_MAIL.send({from:env.RECOVERY_FROM,to:env.RECOVERY_EMAIL,subject:'Reset your Career Steps dashboard password',text:'You requested a password reset for your private website dashboard.\n\nOpen this link and choose a new password:\n'+link.href+'\n\nThis link expires in 15 minutes and can be used once. It changes only your dashboard password. If you did not request it, ignore this email; your password has not changed.'});}
 catch{await env.DB.prepare('DELETE FROM password_resets WHERE token_hash=?').bind(hash).run();throw new Problem(503,'The reset email could not be sent. Please try again later.');}
 return response();
}
export async function resetPassword(request,env){
 sameOrigin(request,env.APP_ORIGIN);const b=await body(request,1500);
 await rate(env.DB,'reset-finish:'+(request.headers.get('CF-Connecting-IP')||'local'),8);
 if(typeof b.token!=='string'||!/^[\w-]{43}$/.test(b.token))throw new Problem(403,'This reset link is invalid or expired. Request a new one.');
 if(typeof b.newPassword!=='string'||b.newPassword.length<16||b.newPassword.length>256)throw new Problem(422,'Use a dashboard password between 16 and 256 characters.');
 const hash=await digest(b.token),now=Date.now(),stored=JSON.stringify(await passwordHash(b.newPassword));
 const exists='EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at>?)';
 const result=await env.DB.batch([
  env.DB.prepare("INSERT INTO settings(key,value) SELECT 'password',? WHERE "+exists+" ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(stored,hash,now),
  env.DB.prepare('DELETE FROM sessions WHERE '+exists).bind(hash,now),
  env.DB.prepare('DELETE FROM launch_tickets WHERE '+exists).bind(hash,now),
  env.DB.prepare("INSERT INTO audit_events(id,action,site_id,created_at) SELECT ?,'password_reset_email',NULL,? WHERE "+exists).bind(crypto.randomUUID(),now,hash,now),
  env.DB.prepare('DELETE FROM password_resets WHERE '+exists).bind(hash,now),
 ]);
 if(!result[0].meta.changes)throw new Problem(403,'This reset link is invalid or expired. Request a new one.');
 return json({ok:true});
}
