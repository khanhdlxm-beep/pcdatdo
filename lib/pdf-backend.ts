const apiUrl = () => process.env.APPS_SCRIPT_API_URL || '';
const apiKey = () => process.env.APPS_SCRIPT_API_KEY || '';

export function pdfBackendConfigured() { return Boolean(apiUrl()); }

export async function pdfBackendGet(action:string, params:Record<string,string>={}) {
  if (!apiUrl()) return { ok:false, configured:false, error:'Chưa cấu hình APPS_SCRIPT_API_URL' };
  const url=new URL(apiUrl());
  url.searchParams.set('action',action);
  if (apiKey()) url.searchParams.set('apiKey',apiKey());
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url.toString(),{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
  return response.json();
}

export async function pdfBackendPost(action:string, payload:Record<string,unknown>) {
  if (!apiUrl()) return { ok:false, configured:false, error:'Chưa cấu hình APPS_SCRIPT_API_URL' };
  const response=await fetch(apiUrl(),{
    method:'POST',cache:'no-store',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,apiKey:apiKey(),...payload}),signal:AbortSignal.timeout(30000),
  });
  if(!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
  return response.json();
}
