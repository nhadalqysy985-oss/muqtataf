import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const path = process.argv[2]
const data = new Uint8Array(fs.readFileSync(path))
const doc = await getDocument({ data }).promise
console.log('pages', doc.numPages)
for (const n of [1, 2, 3, 4]) {
  if (n > doc.numPages) continue
  const page = await doc.getPage(n)
  const tc = await page.getTextContent()
  console.log(`--- page ${n} items=${tc.items.length} ---`)
  console.log('RAW JOIN:', tc.items.filter(i=>i.str).map(i=>i.str).join('|').slice(0, 1200))
  for (const item of tc.items.filter(i=>i.str).slice(0, 18)) {
    console.log(JSON.stringify({s:item.str, f:item.fontName, x:+item.transform[4].toFixed(1), y:+item.transform[5].toFixed(1), w:+item.width.toFixed(1), h:+item.height.toFixed(1), dir:item.dir}))
  }
}
