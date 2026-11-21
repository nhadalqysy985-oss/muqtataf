import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const file = process.argv[2]
const data = new Uint8Array(fs.readFileSync(file))
const doc = await getDocument({data}).promise
console.log('pages:', doc.numPages)
for (const n of [1,2,3,7,10]) {
  if (n > doc.numPages) continue
  const page = await doc.getPage(n)
  const tc = await page.getTextContent()
  console.log(`--- page ${n} ---`)
  console.log(tc.items.filter(i=>i.str).map(i=>i.str).join(' | ').slice(0,800))
}
