import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const data = new Uint8Array(fs.readFileSync(process.argv[2]))
const doc = await getDocument({data}).promise
const page = await doc.getPage(1)
const tc = await page.getTextContent()
let i=0
for (const it of tc.items) {
  if (!it.str) continue
  console.log(JSON.stringify({s:it.str, x:+it.transform[4].toFixed(1), y:+it.transform[5].toFixed(1), w:+it.width.toFixed(1), h:+it.height.toFixed(1)}))
  if (++i>60) break
}
