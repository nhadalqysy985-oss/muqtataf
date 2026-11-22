import { createWorker } from 'tesseract.js'
const file = process.argv[2]
console.log('OCR start', file)
const worker = await createWorker('ara', 1, {
  logger: (m) => { if (m.status === 'recognizing text') process.stdout.write(`\r${Math.round((m.progress||0)*100)}%`) },
})
const { data } = await worker.recognize(file)
console.log('\n--- OCR TEXT ---')
console.log(data.text.slice(0, 3000))
await worker.terminate()
