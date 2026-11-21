import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const data = new Uint8Array(fs.readFileSync('demo/رسالة_تجريبية.pdf'));
const doc = await getDocument({data, useSystemFonts:true}).promise;
console.log('pages', doc.numPages);
for (let i=1;i<=Math.min(3,doc.numPages);i++){
  const p = await doc.getPage(i);
  const tc = await p.getTextContent();
  console.log('--- page', i, 'items', tc.items.length);
  console.log(tc.items.map(it=>it.str).join('|').slice(0,2500));
}

