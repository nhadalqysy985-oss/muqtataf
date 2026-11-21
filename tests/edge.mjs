import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const root = path.resolve('muqtataf')
const fixtures = path.join(root, 'tests', 'fixtures')
const out = path.join(root, 'tests', 'outputs')
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
for (let i = 1; i <= 10; i += 1) fs.copyFileSync(path.join(fixtures, 'study1.pdf'), path.join(fixtures, `copy-${i}.pdf`))
fs.writeFileSync(path.join(fixtures, 'too-large.pdf'), Buffer.alloc(16 * 1024 * 1024, 1))
fs.writeFileSync(path.join(fixtures, 'notes.txt'), 'not a pdf')

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true, locale: 'ar-IQ' })

async function newApp() {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
  return { page, errors }
}

// 1) Validation: 8 valid copies, one extra, one oversized, one wrong type.
{
  const { page } = await newApp()
  await page.setInputFiles('input[type=file]', [
    ...Array.from({ length: 9 }, (_, i) => path.join(fixtures, `copy-${i + 1}.pdf`)),
    path.join(fixtures, 'too-large.pdf'),
    path.join(fixtures, 'notes.txt'),
  ])
  await page.waitForTimeout(600)
  const rows = await page.locator('.file-row').count()
  const toast = await page.locator('.toast').textContent().catch(() => '')
  console.log('VALIDATION rows=', rows, 'toast=', toast?.replace(/\s+/g, ' ').trim())
  await page.screenshot({ path: path.join(root, 'tests', 'screenshots', '07-validation.png'), fullPage: false })
  await page.close()
}

// 2) Scanned PDF: cover-only result with warning.
{
  const { page } = await newApp()
  await page.setInputFiles('input[type=file]', path.join(fixtures, 'scanned.pdf'))
  await page.fill('#topic', 'القيادة التحويلية')
  await page.click('button.start-button')
  await page.waitForSelector('.result-card', { timeout: 60000 })
  const badge = await page.locator('.result-badge').textContent()
  const warning = await page.locator('.result-warning').textContent().catch(() => '')
  console.log('SCANNED badge=', badge?.trim(), 'warning=', warning?.replace(/\s+/g, ' ').trim())
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.result-card a[download]').click(),
  ])
  const target = path.join(out, 'scanned-result.pdf')
  await download.saveAs(target)
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(target)) }).promise
  console.log('SCANNED output pages=', doc.numPages)
  await page.close()
}

// 3) Multiple topics + ZIP download.
{
  const { page } = await newApp()
  await page.setInputFiles('input[type=file]', path.join(fixtures, 'study1.pdf'))
  await page.fill('#topic', 'الرضا الوظيفي\nالقيادة التحويلية')
  await page.click('button.start-button')
  await page.waitForSelector('.result-card', { timeout: 120000 })
  const tags = await page.$$eval('.topic-tag', (nodes) => nodes.map((n) => n.textContent?.trim()))
  const pages = await page.$$eval('.page-chip:not(.is-cover)', (nodes) => nodes.map((n) => n.textContent?.trim()))
  console.log('MULTI tags=', tags, 'pages=', pages)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("تنزيل الكل ZIP")'),
  ])
  const zipPath = path.join(out, 'results.zip')
  await download.saveAs(zipPath)
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath))
  console.log('ZIP entries=', Object.keys(zip.files))
  await page.close()
}

await browser.close()

