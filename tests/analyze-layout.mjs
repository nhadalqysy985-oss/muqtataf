import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const data = new Uint8Array(fs.readFileSync(process.argv[2]))
const doc = await getDocument({ data }).promise
const p = await doc.getPage(1)
const tc = await p.getTextContent()
const items = tc.items.filter(i=>i.str && i.str.trim())
const rows = new Map()
for (const it of items) {
  const y = Math.round(it.transform[5])
  const x = it.transform[4]
  const w = it.width
  if (!rows.has(y)) rows.set(y, [])
  rows.get(y).push({x, w, s:it.str})
}
for (const [y, row] of [...rows.entries()].sort((a,b)=>b[0]-a[0])) {
  row.sort((a,b)=>a.x-b.x)
  const text = row.map(i=>i.s).join('|')
  const min = Math.min(...row.map(i=>i.x)).toFixed(0)
  const max = Math.max(...row.map(i=>i.x+i.w)).toFixed(0)
  console.log(y, `x=${min}..${max}`, text.slice(0,160))
}
