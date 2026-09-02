import crypto from 'node:crypto';

const TTL_SECONDS = 60 * 60 * 4;

function secret() {
  return process.env.PDF_ADMIN_SECRET || '';
}

function sign(payload:string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function pdfAdminConfigured() {
  return Boolean(process.env.PDF_ADMIN_PIN && secret());
}

export function validatePdfAdminPin(pin:string) {
  const expected = process.env.PDF_ADMIN_PIN || '';
  if (!expected || !secret()) return false;
  const a = Buffer.from(String(pin));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}

export function createPdfAdminToken() {
  const body = Buffer.from(JSON.stringify({ exp:Math.floor(Date.now()/1000)+TTL_SECONDS, scope:'pdf-import' })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyPdfAdminToken(token?:string|null) {
  if (!token || !secret()) return false;
  const [body,sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = sign(body);
  const a=Buffer.from(sig), b=Buffer.from(expected);
  if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    return decoded?.scope==='pdf-import' && Number(decoded?.exp)>Math.floor(Date.now()/1000);
  } catch { return false; }
}

export function bearerToken(request:Request) {
  const value=request.headers.get('authorization')||'';
  return value.startsWith('Bearer ')?value.slice(7):'';
}
