import { createWorker } from 'tesseract.js'
const worker = await createWorker('ara', 1)
const { data } = await worker.recognize('muqtataf/tests/outputs/fahem-page1.png')
console.log('keys', Object.keys(data))
console.log('lines', Array.isArray(data.lines) ? data.lines.length : 'none')
if (data.lines) for (const line of data.lines.slice(0, 6)) console.log(JSON.stringify({ text: line.text, bbox: line.bbox, confidence: line.confidence }))
console.log('blocks', data.blocks?.length)
if (data.blocks) {
  const lines = data.blocks.flatMap(b => b.paragraphs.flatMap(p => p.lines))
  console.log('block lines', lines.length)
  for (const line of lines.slice(0, 6)) console.log(JSON.stringify({ text: line.text, bbox: line.bbox, confidence: line.confidence }))
}
await worker.terminate()
