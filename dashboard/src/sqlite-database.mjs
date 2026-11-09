// D1-compatible statements over isolated Durable Object SQLite storage.
// Consume all cursors synchronously; batches are one synchronous transaction.
export function sqliteDatabase(storage) {
  return {
    prepare(query) {
      let values = [];
      const statement = {
        bind(...args) { values = args; return statement; },
        async first() { return storage.sql.exec(query, ...values).toArray()[0] || null; },
        async all() { return {results: storage.sql.exec(query, ...values).toArray()}; },
        execute() {
          storage.sql.exec(query, ...values).toArray();
          return {success: true, meta: {changes: storage.sql.exec('SELECT changes() AS count').toArray()[0].count}};
        },
        async run() { return statement.execute(); },
      };
      return statement;
    },
    async batch(statements) { return storage.transactionSync(() => statements.map(s => s.execute())); },
  };
}
export function migrate(storage, migrations) {
  storage.sql.exec('CREATE TABLE IF NOT EXISTS _dashboard_migrations(name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)').toArray();
  for (const migration of migrations) {
    if (storage.sql.exec('SELECT name FROM _dashboard_migrations WHERE name=?', migration.name).toArray().length) continue;
    storage.transactionSync(() => {
      storage.sql.exec(migration.sql).toArray();
      storage.sql.exec('INSERT INTO _dashboard_migrations VALUES(?,?)', migration.name, Date.now()).toArray();
    });
  }
}
