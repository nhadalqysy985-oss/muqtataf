import { createWorker } from 'tesseract.js'
const worker = await createWorker('ara', 1)
const { data } = await worker.recognize('muqtataf/tests/outputs/fahem-page1.png', {}, { blocks: true, text: true, hocr: true, tsv: true })
console.log('keys', Object.keys(data))
console.log('blocks type', typeof data.blocks, data.blocks?.length)
console.log('text sample', data.text.slice(0, 100))
console.log('tsv sample', (data.tsv||'').split('\n').slice(0, 8))
await worker.terminate()
