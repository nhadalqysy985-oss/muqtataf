import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.fill('#topic', 'مفهوم القيادة التحويلية')
const info = await page.evaluate(() => {
  const el = document.querySelector('#topic')
  const count = document.querySelector('.char-count')
  const fileCount = document.querySelector('.file-count')
  return {
    value: el.value,
    valueLength: el.value.length,
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
    disabled: el.disabled,
    placeholder: el.placeholder,
    countText: count?.textContent,
    countDir: count ? getComputedStyle(count).direction : null,
    fileCountText: fileCount?.textContent,
    fileCountDir: fileCount ? getComputedStyle(fileCount).direction : null,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'muqtataf/tests/screenshots/06-topic-field.png' })
await browser.close()
