import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise
for (let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n);const tc=await p.getTextContent();const raw=tc.items.filter(i=>i.str).map(i=>i.str).join(' ');console.log(n, raw.replace(/\s/g,'').length, raw.slice(0,40))}
