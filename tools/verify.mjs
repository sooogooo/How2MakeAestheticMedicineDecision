// 结构校验：确认每条都有完整的标签和栏位，供 index.html 正确解析。
//   node tools/verify.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TAG = /<!--\s*成本标签:\s*(.*?)\s*-->/;
const FIELDS = ['成本','说人话','收益','风险','可逆性','证据等级','利益冲突','来源','备注','数据截至','自查路径'];
const TAGS = ['钱','时间','毅力','收益','风险','可逆','口径'];
// 与 index.html 的 parseEntry 保持同一套正则
const fieldRe = f => new RegExp('(?:^|\\n)- ' + f + '：([\\s\\S]*?)(?=\\n- (?:' + FIELDS.join('|') + ')：|\\n### |$)');

const files = readdirSync(resolve(ROOT, 'book')).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
let total = 0;
const problems = [];
const tally = { grade:{}, scope:{}, risk:{}, rev:{} };

for (const file of files) {
  const md = readFileSync(resolve(ROOT, 'book', file), 'utf8');
  const parts = md.split(/^###\s+(\d+)\.\s+/m);
  for (let i = 1; i < parts.length; i += 2) {
    total++;
    const num = parts[i];
    const block = '### ' + num + '. ' + parts[i + 1];
    const where = file.replace(/\.md$/, '') + ' #' + num;

    const t = TAG.exec(block);
    if (!t) { problems.push(where + '：缺成本标签'); continue; }
    const keys = t[1].split(/\s+/).map(kv => kv.split('=')[0]);
    if (keys.join(',') !== TAGS.join(',')) problems.push(where + '：标签字段或顺序不对 → ' + keys.join(' '));
    const tags = {};
    for (const kv of t[1].split(/\s+/)) { const j = kv.indexOf('='); if (j > 0) tags[kv.slice(0, j)] = kv.slice(j + 1); }

    const vals = {};
    for (const f of FIELDS) {
      const m = fieldRe(f).exec(block);
      if (!m || !m[1].trim()) problems.push(where + '：缺栏 ' + f);
      else vals[f] = m[1].trim();
    }
    if (vals['说人话'] && vals['说人话'].length > 130) problems.push(where + '：说人话超过 130 字（' + vals['说人话'].length + '）');
    if (/HR|RR|OR|95% CI|荟萃|队列/.test(vals['说人话'] || '')) problems.push(where + '：说人话里出现统计行话');

    const g = (vals['证据等级'] || '?').charAt(0);
    tally.grade[g] = (tally.grade[g] || 0) + 1;
    tally.scope[tags['口径']] = (tally.scope[tags['口径']] || 0) + 1;
    tally.risk[tags['风险']] = (tally.risk[tags['风险']] || 0) + 1;
    tally.rev[tags['可逆']] = (tally.rev[tags['可逆']] || 0) + 1;
  }
}

const show = o => Object.entries(o).sort().map(([k, v]) => k + ' ' + v).join(' · ');
console.log('节数 ' + files.length + ' ｜ 条目 ' + total);
console.log('证据 ' + show(tally.grade));
console.log('口径 ' + show(tally.scope));
console.log('风险 ' + show(tally.risk));
console.log('可逆 ' + show(tally.rev));
// 口径与 README 一致：含「TODO」或「待核实」的行数，不是出现次数
const todo = files.reduce((n, f) =>
  n + readFileSync(resolve(ROOT, 'book', f), 'utf8').split(/\r?\n/).filter(l => /TODO|待核实/.test(l)).length, 0);
console.log('待核实 ' + todo + ' 处');

if (problems.length) {
  console.log('\n问题 ' + problems.length + ' 项：');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('\n结构校验通过。');
