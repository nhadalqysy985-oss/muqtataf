import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const path = process.argv[2]
const data = new Uint8Array(fs.readFileSync(path))
const doc = await getDocument({ data }).promise
console.log('pages', doc.numPages)
for (let n = 1; n <= Math.min(8, doc.numPages); n++) {
  const page = await doc.getPage(n)
  const tc = await page.getTextContent()
  const items = tc.items.filter(i => i.str && i.str.trim())
  const raw = items.map(i => i.str).join('|')
  console.log(`--- page ${n}: items=${items.length} chars=${raw.replace(/\s/g,'').length}`)
  console.log(raw.slice(0, 500))
  if (items[0]) console.log('font', items[0].fontName, 'x', items[0].transform?.[4], 'y', items[0].transform?.[5])
}
