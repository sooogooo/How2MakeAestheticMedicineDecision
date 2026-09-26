// 把 index.html + README + book/*.md 打成一个自包含的 HTML 文件。
// 双击就能看，不用服务器、不用联网，微信里也能直接传。
//   node tools/offline.mjs [输出路径]     默认 dist/HowToAesthetic.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, process.argv[2] ?? 'dist/HowToAesthetic.html');
const read = p => readFileSync(resolve(ROOT, p), 'utf8');

const readme = read('README.md');
const files = [...new Set([...readme.matchAll(/\]\((book\/[^)]+\.md)\)/g)].map(m => m[1]))].sort();
if (!files.length) throw new Error('README.md 里没找到 book/ 文件清单，离线版会是空的');

const corpus = {
  readme,
  parts: Object.fromEntries(files.map(f => [f, read(f)])),
};

let html = read('index.html');

// </script 会提前关掉脚本标签，转义一下。\/ 在 JS 字符串里就是 /，内容不变。
const payload = JSON.stringify(corpus).replace(/<\/script/gi, '<\\/script');
const tag = `<script>window.__CORPUS__=${payload};</script>`;

// 插在主脚本之前，保证 init() 跑的时候已经存在
const anchor = '<script>\n\'use strict\';';
if (!html.includes(anchor)) throw new Error('index.html 里找不到主脚本开头，锚点需要同步');
html = html.replace(anchor, tag + '\n' + anchor);

// 离线版不需要外部请求，标题加个标记
html = html.replace('<title>', '<title>离线版 · ');
// 页脚去掉「起服务器」的提示语境
html = html.replace(
  '数据直接读本目录下的 <code>README.md</code> 和 <code>book/*.md</code>。正文改了，这一页跟着改。',
  '这是离线单文件版，正文已经内联进来。<code>src</code> 里改正文之后重新跑 <code>node tools/offline.mjs</code> 生成新的一份。'
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(`已生成 ${OUT.replace(ROOT + '\\', '').replace(ROOT + '/', '')}（${kb} KB，含 ${files.length} 节）`);
