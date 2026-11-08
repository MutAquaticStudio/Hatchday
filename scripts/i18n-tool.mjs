// Công cụ đa ngôn ngữ, đọc mã bằng trình phân tích TypeScript (không dùng regex trên mã):
//   node scripts/i18n-tool.mjs wrap      bọc mọi chuỗi tiếng Việt hiển thị bằng _t('…') / _t`…` và thêm import
//   node scripts/i18n-tool.mjs keys      in danh sách khoá (câu tiếng Việt) ra src/i18n/keys.json
//   node scripts/i18n-tool.mjs check     báo chuỗi tiếng Việt chưa bọc và khoá thiếu bản dịch (exit 1 nếu có)
// Bỏ qua: chú thích, khoá thuộc tính, import, so sánh (=== / case), RegExp, console, tệp test, dữ liệu bản Chơi thử, bộ lọc từ.
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const VI = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ]/;
const SKIP_FILE = f => /\.test\.ts$/.test(f) || /[\\/]i18n[\\/]/.test(f) || /[\\/]data[\\/]demo-/.test(f) || /[\\/]net[\\/](sim|moderation)/.test(f) || /\.d\.ts$/.test(f);
const files = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) files(p, out); else if (/\.(ts|js)$/.test(n) && !SKIP_FILE(p)) out.push(p); } return out; };

/** Khoá của một literal: chuỗi thường giữ nguyên, template thay ${…} bằng {0}, {1}… */
function keyOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  let k = node.head.text; node.templateSpans.forEach((sp, i) => { k += `{${i}}` + sp.literal.text; }); return k;
}
const isCallTo = (n, names) => ts.isCallExpression(n) && (ts.isIdentifier(n.expression) ? names.includes(n.expression.text) : ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && names.includes(n.expression.expression.text + '.' + n.expression.name.text));

/** Trả về {wrap:[nodes], skipped:[{node,why}]} cho một tệp. */
function scan(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const wrap = [], skipped = [], wrapped = [];
  const visit = (n, insideTemplateOfVi) => {
    const lit = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n);
    if (lit && VI.test(n.getText(sf))) {
      const p = n.parent;
      let why = '';
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) why = 'import';
      else if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isEnumMember(p)) && p.name === n) why = 'key';
      else if (ts.isElementAccessExpression(p) && p.argumentExpression === n) why = 'index';
      else if (ts.isLiteralTypeNode(p)) why = 'type';
      else if (ts.isTaggedTemplateExpression(p)) { if (ts.isIdentifier(p.tag) && (p.tag.text === '_t' || p.tag.text === 't')) { wrapped.push(n); } else why = 'tagged'; }
      else if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === '_t' || p.expression.text === 't') && p.arguments[0] === n) { wrapped.push(n); }
      else if (ts.isCaseClause(p)) why = 'case';
      else if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) why = 'compare';
      else if (isCallTo(p, ['RegExp', 'console.log', 'console.warn', 'console.error', 'console.info'])) why = 'console/regexp';
      else if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'RegExp') why = 'regexp';
      if (why) skipped.push({ node: n, why }); else if (!wrapped.includes(n)) wrap.push(n);
    }
    ts.forEachChild(n, c => visit(c, insideTemplateOfVi));
  };
  visit(sf, false);
  return { sf, text, wrap, skipped, wrapped };
}

const mode = process.argv[2];
if (mode === 'wrap') {
  let total = 0;
  for (const f of files(SRC)) {
    const { sf, text, wrap } = scan(f); if (!wrap.length) continue;
    const edits = wrap.map(n => ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)
      ? { pos: n.getStart(sf), end: n.getStart(sf), ins: '_t' }
      : { pos: n.getStart(sf), end: n.getEnd(), ins: `_t(${n.getText(sf)})` });
    edits.sort((a, b) => b.pos - a.pos);
    let out = text;
    for (const e of edits) out = out.slice(0, e.pos) + e.ins + out.slice(e.end);
    if (!/import \{[^}]*\b_t\b[^}]*\} from ['"][./]+i18n(\/index)?['"]/.test(out)) {
      let rel = relative(dirname(f), join(SRC, 'i18n')).replace(/\\/g, '/'); if (!rel.startsWith('.')) rel = './' + rel;
      const imp = `import { _t } from '${rel}';\n`;
      // sau khối chú thích đầu tệp và trước import đầu tiên (nếu có)
      const m = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*\n))*/.exec(out); const at = m ? m[0].length : 0;
      out = out.slice(0, at) + imp + out.slice(at);
    }
    writeFileSync(f, out); total += wrap.length; console.log(`${wrap.length}\t${relative(ROOT, f)}`);
  }
  console.log('đã bọc', total);
} else if (mode === 'keys' || mode === 'check') {
  const keys = new Map(); const unwrapped = []; const skippedAll = [];
  for (const f of files(SRC)) {
    const { sf, wrap, skipped, wrapped } = scan(f);
    for (const n of wrapped) { const k = keyOf(n); if (!keys.has(k)) keys.set(k, `${relative(ROOT, f)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`); }
    for (const n of wrap) unwrapped.push(`${relative(ROOT, f)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}  ${n.getText(sf).slice(0, 70)}`);
    for (const s of skipped) skippedAll.push(`${s.why}\t${relative(ROOT, f)}:${sf.getLineAndCharacterOfPosition(s.node.getStart(sf)).line + 1}  ${s.node.getText(sf).slice(0, 60)}`);
  }
  // HTML tĩnh: markup.html
  const html = readFileSync(join(SRC, 'game', 'markup.html'), 'utf8');
  for (const m of html.matchAll(/>([^<>]*?)</g)) { const k = m[1].trim(); if (k && VI.test(k) && !keys.has(k)) keys.set(k, 'src/game/markup.html'); }
  for (const m of html.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g)) { const k = m[1].replace(/&amp;/g, '&'); if (VI.test(k) && !keys.has(k)) keys.set(k, 'src/game/markup.html'); }
  if (mode === 'keys') {
    writeFileSync(join(SRC, 'i18n', 'keys.json'), JSON.stringify(Object.fromEntries([...keys].sort((a, b) => a[1].localeCompare(b[1]))), null, 1));
    console.log('khoá', keys.size, '· chưa bọc', unwrapped.length, '· bỏ qua', skippedAll.length);
    if (process.argv.includes('--skipped')) console.log(skippedAll.join('\n'));
  } else {
    const en = JSON.parse(readFileSync(join(SRC, 'i18n', 'en.json'), 'utf8'));
    const missing = [...keys.keys()].filter(k => !en[k]);
    const extra = Object.keys(en).filter(k => !keys.has(k));
    console.log(`khoá ${keys.size} · thiếu bản dịch ${missing.length} · chưa bọc ${unwrapped.length} · bản dịch thừa ${extra.length}`);
    if (process.argv.includes('-v')) { console.log(unwrapped.slice(0, 50).join('\n')); console.log(missing.slice(0, 50).join('\n')); }
    process.exit(missing.length || unwrapped.length ? 1 : 0);
  }
}
