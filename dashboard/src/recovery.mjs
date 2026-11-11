// Operator-only recovery configured through a Cloudflare Worker secret.
// No public recovery route or plaintext password is accepted here.
export function recoverPassword(storage, configuration) {
  if (!configuration) return false;
  const {id,salt,hash}=JSON.parse(configuration);
  if (typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)||
      typeof salt!=='string'||!/^[\w-]{43}$/.test(salt)||
      typeof hash!=='string'||!/^[\w-]{43}$/.test(hash)) {
    throw new Error('Invalid operator recovery configuration.');
  }
  return storage.transactionSync(()=>{
    const applied=storage.sql.exec("SELECT value FROM settings WHERE key='password_recovery_id'").toArray()[0];
    if (applied?.value===id) return false;
    storage.sql.exec("INSERT INTO settings(key,value) VALUES('password',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({salt,hash})).toArray();
    storage.sql.exec('DELETE FROM launch_tickets').toArray();
    storage.sql.exec('DELETE FROM password_resets').toArray();
    storage.sql.exec('DELETE FROM sessions').toArray();
    storage.sql.exec("INSERT INTO settings(key,value) VALUES('password_recovery_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",id).toArray();
    storage.sql.exec('INSERT INTO audit_events(id,action,site_id,created_at) VALUES(?,?,NULL,?)',crypto.randomUUID(),'password_reset',Date.now()).toArray();
    return true;
  });
}
