import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const data = new Uint8Array(fs.readFileSync(process.argv[2]))
const doc = await getDocument({data}).promise
for (const n of [1,7]) {
  const page = await doc.getPage(n)
  const tc = await page.getTextContent()
  const it = tc.items.find(x=>x.str && x.str.trim())
  console.log(n, Object.keys(it), JSON.stringify({str:it.str, dir:it.dir, hasEOL:it.hasEOL}))
}
