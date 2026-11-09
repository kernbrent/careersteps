CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE sites (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, public_url TEXT NOT NULL, admin_url TEXT NOT NULL DEFAULT '',
 mode TEXT NOT NULL CHECK(mode IN ('bridge','external','public','placeholder')), category TEXT NOT NULL DEFAULT 'Website',
 notes TEXT NOT NULL DEFAULT '', vault TEXT, sort_order INTEGER NOT NULL DEFAULT 100, updated_at INTEGER NOT NULL
);
CREATE TABLE launch_tickets (token_hash TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, session_hash TEXT NOT NULL, challenge TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX launch_expiry ON launch_tickets(expires_at);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, action TEXT NOT NULL, site_id TEXT, created_at INTEGER NOT NULL);
INSERT INTO sites(id,name,public_url,admin_url,mode,category,notes,sort_order,updated_at) VALUES
 ('careersteps','Career Steps','https://careersteps.net/','https://careersteps.net/admin/','bridge','Consulting','',1,0),
 ('christiansteps','Christian Steps Ministries','https://christiansteps.net/','https://christiansteps.net/admin/','bridge','Ministry','',2,0),
 ('hopesojourns','Hope Sojourns','https://hopesojourns.com/','https://hopesojourns.com/admin/','bridge','Ministry','',3,0),
 ('choice1','Choice 1 Recruiting','https://choice1recruiting.com/','https://choice1recruiting.com/admin/','bridge','Client','',4,0),
 ('josh','Josh Beyond Borders','https://joshbeyondborders.org/','https://joshbeyondborders.org/admin/','bridge','Ministry','Encrypted giving workbook. Dashboard access unlocks it without saving the password in this browser.',5,0),
 ('prayer','Prayer Portal','https://prayer.hopesojourns.com/','https://prayer.hopesojourns.com/','bridge','Ministry','Separate invitation-only prayer community.',6,0),
 ('earthquakes','NTX Earthquakes','https://ntxearthquakes.com/','https://ntxearthquakes.com/admin/','bridge','Community','Manage the team calendar, roster, and results.',7,0),
 ('streetfc','Street FC','https://streetfc.org/','','public','Community','Public website. Content is maintained in its source project.',8,0),
 ('intervarsity','InterVarsity / Benzi George','https://intervarsity.careersteps.net/','','placeholder','In development','Website concepts for Benzi. An admin portal can be connected when its scope is decided.',9,0),
 ('lightappraisal','Light Appraisal','https://lightappraisal.com/','','placeholder','In development','Public-site placeholder for Eric Clanton. Hosting and admin access are still to be confirmed.',10,0),
 ('metro-live','Metro Relief — current site','https://metrorelief.org/','https://www.metrorelief.org/admin','external','Client','Existing WebInOne administration. Automatic sign-in depends on provider support.',11,0),
 ('metro-review','Metro Relief — replacement site','https://metro.careersteps.net/','','public','Client','Separate replacement/review website. Kept alongside the current production site.',12,0);
