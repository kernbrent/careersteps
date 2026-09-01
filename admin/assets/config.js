/*
 * Public browser configuration only. The Supabase publishable key is designed
 * to be exposed in client applications and is protected by the database's RLS
 * policies. Never place a secret key or service-role key in this file.
 */
window.CAREERSTEPS_ADMIN_CONFIG = Object.freeze({
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabasePublishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  storageBucket: "bookkeeping-attachments",
});
