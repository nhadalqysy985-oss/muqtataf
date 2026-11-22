import { chromium } from 'playwright-core'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
const jobs = [
  ['arif.pdf', 8, 'arif-page8.png'],
  
  
]
for (const [file, n, out] of jobs) {
  await page.goto(`http://127.0.0.1:4178/tests/render-page.html?file=${file}&page=${n}&scale=2.4`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__png, null, { timeout: 60000 })
  const data = await page.evaluate(() => window.__png)
  fs.writeFileSync('muqtataf/tests/outputs/' + out, Buffer.from(data.split(',')[1], 'base64'))
  console.log(out, fs.statSync('muqtataf/tests/outputs/' + out).size)
}
await browser.close()

