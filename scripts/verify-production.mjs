import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`[verify] ${message}`); };
const ok = (message) => console.log(`✓ ${message}`);

function unique(values) {
  return [...new Set(values)];
}

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const value of values) seen.has(value) ? dup.add(value) : seen.add(value);
  return [...dup];
}

const packageJson = JSON.parse(read('package.json'));
const appVersion = read('lib/app-version.ts').match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
if (!appVersion || packageJson.version !== appVersion) fail(`package version ${packageJson.version} khác APP_VERSION ${appVersion || 'missing'}`);
ok(`version đồng bộ ${appVersion}`);

const catalogTs = read('lib/kpi-catalog.ts');
const catalogGs = read('apps-script/PdfImport.gs');
const tsIds = [...catalogTs.matchAll(/\bid:'([A-Z0-9_]+)'/g)].map((m) => m[1]);
const gsSection = catalogGs.match(/const PDF_CATALOG_V18_2\s*=\s*\[([\s\S]*?)\n\];/)?.[1] || '';
const gsIds = [...gsSection.matchAll(/\['([A-Z0-9_]+)'\s*,/g)].map((m) => m[1]);
if (!tsIds.length || !gsIds.length) fail('không đọc được KPI catalog');
if (duplicates(tsIds).length) fail(`KPI catalog TypeScript trùng ID: ${duplicates(tsIds).join(', ')}`);
if (duplicates(gsIds).length) fail(`KPI catalog Apps Script trùng ID: ${duplicates(gsIds).join(', ')}`);
const onlyTs = unique(tsIds).filter((id) => !gsIds.includes(id));
const onlyGs = unique(gsIds).filter((id) => !tsIds.includes(id));
if (onlyTs.length || onlyGs.length) fail(`KPI catalog lệch. Chỉ TS=[${onlyTs.join(',')}], chỉ Apps Script=[${onlyGs.join(',')}]`);
ok(`KPI catalog đồng bộ ${unique(tsIds).length} mã`);

const actionEngine = read('lib/action-engine.ts');
if (actionEngine.includes('toIsoDate(')) fail('Action Center còn tự sinh deadline');
if (!actionEngine.includes("origin: 'suggested'")) fail('Action Center chưa phân biệt gợi ý hệ thống');
ok('Action Center không tự sinh deadline');

const health = read('lib/health-score.ts');
const forecast = read('lib/forecast-v2.ts');
if (!health.includes('buildUnifiedForecast') || !forecast.includes('buildUnifiedForecast')) fail('Health/Warning chưa dùng chung Forecast engine');
ok('Health Score và Early Warning dùng Forecast engine thống nhất');

const appShell = read('components/AppShell.tsx');
if (appShell.includes('function forecastFor(')) fail('AppShell còn Forecast engine cũ');
if (!appShell.includes('buildUnifiedForecast')) fail('AppShell chưa nối Forecast engine thống nhất');
if (appShell.includes('Dự báo DEMO')) fail('AppShell còn nhãn Dự báo DEMO');
ok('AppShell đã bỏ Forecast engine/nhãn DEMO cũ');

const forbiddenProductionTokens = [
  'USE_DEMO_DATA',
  "dataMode === 'demo'",
  "'pdf-seed'",
  'DEMO giả lập',
  'Giải pháp DEMO',
  'Dự báo DEMO',
];
const productionSources = ['app', 'components', 'lib', 'types'];
for (const base of productionSources) {
  const stack = [path.join(root, base)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(file);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const token of forbiddenProductionTokens) {
          if (text.includes(token)) fail(`${path.relative(root, file)} còn dấu vết Production cũ: ${token}`);
        }
      }
    }
  }
}
ok('Production source không còn nhánh demo/pdf-seed cũ');

const lock = JSON.parse(read('package-lock.json'));
if (lock.name !== packageJson.name || lock.version !== packageJson.version || lock.packages?.['']?.name !== packageJson.name || lock.packages?.['']?.version !== packageJson.version) {
  fail('package-lock root metadata chưa đồng bộ package.json');
}
ok('package-lock metadata đồng bộ');

console.log('\nProduction verification passed. Raw KPI/history values are not rewritten by this verification step.');
