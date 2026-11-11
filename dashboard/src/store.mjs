import app from './worker.mjs';
import {sqliteDatabase,migrate} from './sqlite-database.mjs';
import {productionSchema,testSchema} from './schema.mjs';
import {recoverPassword} from './recovery.mjs';
import {resetSchema} from './email-recovery.mjs';
export class DashboardStore {
  constructor(ctx,env) {
    migrate(ctx.storage,[{name:'0001_dashboard.sql',sql:env.ENVIRONMENT==='test'?testSchema:productionSchema},{name:'0002_email_recovery.sql',sql:resetSchema}]);
    recoverPassword(ctx.storage,env.DASHBOARD_PASSWORD_RECOVERY);
    this.env={...env,DB:sqliteDatabase(ctx.storage)};
  }
  async fetch(request) {return app.fetch(request,this.env);}
}
