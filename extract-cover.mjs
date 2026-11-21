import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const data = new Uint8Array(fs.readFileSync('demo/رسالة_تجريبية.pdf'));
const doc = await getDocument({data}).promise;
const p = await doc.getPage(1);
const tc = await p.getTextContent();
for (const it of tc.items) {
  if (!('str' in it)) continue;
  console.log(JSON.stringify({str:it.str, x:+it.transform[4].toFixed(1), y:+it.transform[5].toFixed(1), w:+it.width.toFixed(1), h:+it.height.toFixed(1), font:it.fontName}));
}
const p2 = await doc.getPage(10); const t2=await p2.getTextContent(); console.log('--- page10'); console.log(t2.items.map(i=>i.str).join('|').slice(0,1200));
