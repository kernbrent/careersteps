import app from './worker.mjs';
export {DashboardStore} from './store.mjs';
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/')||path==='/connect') {
      try {return await env.DASHBOARD_STORE.get(env.DASHBOARD_STORE.idFromName('dashboard')).fetch(request);}
      catch {return Response.json({error:'The dashboard is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
    }
    return app.fetch(request,env);
  },
};
