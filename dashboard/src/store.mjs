import app from './worker.mjs';
import {sqliteDatabase,migrate} from './sqlite-database.mjs';
import {productionSchema,testSchema} from './schema.mjs';
export class DashboardStore {
  constructor(ctx,env) {
    migrate(ctx.storage,[{name:'0001_dashboard.sql',sql:env.ENVIRONMENT==='test'?testSchema:productionSchema}]);
    this.env={...env,DB:sqliteDatabase(ctx.storage)};
  }
  async fetch(request) {return app.fetch(request,this.env);}
}
