import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const data = new Uint8Array(fs.readFileSync(process.argv[2]))
const doc = await getDocument({ data }).promise
const norm = s => s.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()
for (let n=1;n<=doc.numPages;n++){
  const p=await doc.getPage(n); const tc=await p.getTextContent(); const raw=tc.items.filter(i=>i.str).map(i=>i.str).join(' ')
  const t=norm(raw)
  const hit = t.includes(norm('تقدير الذات')) || (t.includes('تقدير') && t.includes('الذات'))
  if (hit) console.log('PAGE',n,'|',raw.slice(0,300))
}
