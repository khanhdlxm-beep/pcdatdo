const apiUrl = () => process.env.APPS_SCRIPT_API_URL || '';
const apiKey = () => process.env.APPS_SCRIPT_API_KEY || '';

export function pdfBackendConfigured() {
  return Boolean(apiUrl() && apiKey());
}

async function sleep(ms:number) {
  await new Promise((resolve)=>setTimeout(resolve,ms));
}

export async function pdfBackendGet(action:string, params:Record<string,string>={}) {
  if (!apiUrl()) return { ok:false, configured:false, error:'Chưa cấu hình APPS_SCRIPT_API_URL' };
  if (!apiKey()) return { ok:false, configured:false, error:'Chưa cấu hình APPS_SCRIPT_API_KEY' };

  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    const url=new URL(apiUrl());
    url.searchParams.set('action',action);
    url.searchParams.set('apiKey',apiKey());
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    try{
      const response=await fetch(url.toString(),{
        cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(20000),
      });
      if(!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
      const data=await response.json();
      if(data?.ok===false) throw new Error(data?.error||`Apps Script ${action} returned ok=false`);
      return data;
    }catch(error){
      lastError=error;
      if(attempt<2) await sleep(500*(attempt+1));
    }
  }
  throw lastError instanceof Error?lastError:new Error(String(lastError));
}

export async function pdfBackendPost(action:string, payload:Record<string,unknown>) {
  if (!apiUrl()) return { ok:false, configured:false, error:'Chưa cấu hình APPS_SCRIPT_API_URL' };
  if (!apiKey()) return { ok:false, configured:false, error:'Chưa cấu hình APPS_SCRIPT_API_KEY' };

  // Stage/save are idempotent by importId and safe to retry once. Approve/correct
  // are not retried automatically to avoid duplicate change-log entries.
  const attempts=(action==='stagePdfImport'||action==='savePdfStaging')?2:1;
  let lastError:unknown;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetch(apiUrl(),{
        method:'POST',cache:'no-store',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({action,apiKey:apiKey(),...payload}),signal:AbortSignal.timeout(60000),
      });
      if(!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
      const data=await response.json();
      if(data?.ok===false) throw new Error(data?.error||`Apps Script ${action} returned ok=false`);
      return data;
    }catch(error){
      lastError=error;
      if(attempt<attempts-1) await sleep(800);
    }
  }
  throw lastError instanceof Error?lastError:new Error(String(lastError));
}
