import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ executablePath: chrome, headless: true })
const page = await browser.newPage()

const baseCss = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #1c1c1c; direction: rtl; }
  .sheet { width: 210mm; height: 297mm; padding: 22mm 20mm; page-break-after: always; position: relative; background: #fff; }
  .sheet:last-child { page-break-after: auto; }
  .cover { text-align: center; padding: 34mm 22mm 20mm; }
  .univ { font-size: 17pt; font-weight: 700; margin-bottom: 5mm; }
  .college { font-size: 14pt; margin-bottom: 2mm; }
  .dept { font-size: 12.5pt; color: #333; }
  .rule { width: 42mm; height: 2px; background: #8a6a33; margin: 13mm auto; }
  .title { font-size: 25pt; font-weight: 700; line-height: 1.55; margin: 20mm 0 5mm; }
  .subtitle { font-size: 14pt; color: #444; margin-bottom: 18mm; }
  .degree { font-size: 14pt; font-weight: 600; margin-bottom: 9mm; }
  .author { font-size: 14pt; line-height: 1.9; }
  .author strong { font-weight: 700; }
  .supervisor { font-size: 12.5pt; color: #333; margin-top: 7mm; }
  .place { position: absolute; bottom: 22mm; left: 0; right: 0; font-size: 12.5pt; color: #333; }
  .header { display: flex; justify-content: space-between; border-bottom: 0.6pt solid #bbb; padding-bottom: 2.5mm; font-size: 8.5pt; color: #777; margin-bottom: 8mm; }
  h2 { font-size: 15pt; margin: 0 0 5mm; color: #174d3f; }
  p { font-size: 11.5pt; line-height: 2.05; text-align: justify; margin: 0 0 4mm; }
  .topic { background: #f4f0e6; border-right: 3px solid #b58a44; padding: 4mm 5mm; font-weight: 600; }
  .num { position: absolute; bottom: 12mm; left: 20mm; font-size: 9pt; color: #888; }
`

const filler = [
  'تُعدّ المتغيرات التنظيمية من الموضوعات التي حظيت باهتمام واسع في أدبيات الإدارة الحديثة، لما لها من أثر مباشر في سلوك العاملين وأداء المنظمات.',
  'وتشير الدراسات السابقة إلى أن بيئة العمل الداخلية تؤثر في اتجاهات الأفراد نحو منظماتهم، وفي مستوى جهدهم المبذول لتحقيق الأهداف.',
  'وقد اعتمد البحث المنهج الوصفي التحليلي، واستخدم الاستبانة أداة رئيسية لجمع البيانات من أفراد عينة البحث.',
  'وتكوّن مجتمع البحث من العاملين في المصارف العراقية، واختيرت عينة عشوائية طبقية بلغ حجمها ثلاثمائة وعشرين مفردة.',
  'واستخدمت الدراسة مجموعة من الأساليب الإحصائية، منها المتوسطات الحسابية والانحرافات المعيارية ومعامل الارتباط وتحليل الانحدار.',
  'وأظهرت النتائج وجود علاقة ارتباط معنوية بين المتغيرات المدروسة، كما أظهر التحليل وجود أثر ذي دلالة إحصائية عند مستوى معنوية خمسة بالمائة.',
  'وتوصي الدراسة بضرورة تبني أنماط إدارية حديثة، وتعزيز مشاركة العاملين في صناعة القرار، وتحسين نظم الحوافز والتقدير.',
  'ويُتوقع أن تسهم نتائج هذا البحث في إثراء المكتبة العربية، وفي تقديم توصيات عملية للقادة وصناع القرار في المنظمات المبحوثة.',
]

function bodyPages(count, title, topicPages, topicParagraphs) {
  const pages = []
  for (let index = 1; index <= count; index += 1) {
    const topic = topicPages.includes(index)
    const content = topic
      ? `<p class="topic">${topicParagraphs[0]}</p><p>${topicParagraphs[1]}</p>`
      : filler.slice((index - 1) % filler.length).concat(filler[(index + 2) % filler.length]).map((text) => `<p>${text}</p>`).join('')
    pages.push(`
      <section class="sheet">
        <div class="header"><span>${title}</span><span>الفصل الأول — الإطار العام</span></div>
        <h2>${topic ? 'الإطار النظري والدراسات السابقة' : 'المقدمة والمنهجية'}</h2>
        ${content}
        ${index % 3 === 0 ? `<p>${filler[index % filler.length]}</p>` : ''}
        <span class="num">${index + 1}</span>
      </section>
    `)
  }
  return pages.join('')
}

function cover({ univ, college, dept, title, subtitle, degree, author, supervisor, committee, year }) {
  return `
    <section class="sheet cover">
      <div class="univ">${univ}</div>
      <div class="college">${college}</div>
      <div class="dept">${dept}</div>
      <div class="rule"></div>
      <div class="title">${title}</div>
      <div class="subtitle">${subtitle}</div>
      <div class="degree">${degree}</div>
      <div class="author"><strong>${author}</strong></div>
      <div class="supervisor">${supervisor}</div>
      ${committee ? `<div class="supervisor">${committee}</div>` : ''}
      <div class="place">${year}</div>
    </section>
  `
}

const study1 = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
  ${cover({
    univ: 'جامعة بغداد',
    college: 'كلية الإدارة والاقتصاد',
    dept: 'قسم إدارة الأعمال',
    title: 'أثر الرضا الوظيفي على الالتزام التنظيمي',
    subtitle: 'دراسة ميدانية في المصارف العراقية',
    degree: 'رسالة ماجستير',
    author: 'إعداد الباحثة: سارة عبد الكريم الجبوري',
    supervisor: 'إشراف: أ.د. محمد صالح الجبوري',
    committee: 'لجنة المناقشة: أ.د. عبد الله كريم، د. هدى ناصر',
    year: 'بغداد — 2021م / 1443هـ',
  })}
  ${bodyPages(14, 'أثر الرضا الوظيفي على الالتزام التنظيمي', [7, 10], [
    'وتؤكد الأدبيات الحديثة أن مفهوم القيادة التحويلية يعد من أكثر المفاهيم الإدارية ارتباطًا بالالتزام التنظيمي، إذ يعمل القائد التحويلي على رفع مستوى الدافعية والانتماء لدى العاملين. وتُظهر نتائج التحليل أن أبعاد القيادة التحويلية تفسر نسبة معتبرة من التباين في الالتزام التنظيمي.',
    'وفي ضوء ذلك يمكن القول إن القيادة التحويلية تمثل متغيرًا وسيطًا مهمًا في العلاقة بين الرضا الوظيفي وسلوك المواطنة التنظيمية. وقد أكدت المقابلات أن القادة الذين يمارسون التحفيز الفكري والاعتبار الفردي ينجحون في بناء بيئة عمل أكثر التزامًا.',
  ])}
  ${`<section class="sheet"><div class="header"><span>أثر الرضا الوظيفي على الالتزام التنظيمي</span><span>الخاتمة</span></div><h2>الاستنتاجات والتوصيات</h2><p>خلصت الدراسة إلى وجود أثر معنوي للرضا الوظيفي في الالتزام التنظيمي، وأوصت بتعزيز العدالة التنظيمية والتدريب المستمر.</p><p>ويمكن للباحثين مستقبلًا توسيع النموذج بإدخال متغيرات وسيطة مثل القيادة التحويلية والثقافة التنظيمية.</p><span class="num">16</span></section>`}
</body></html>`

const study2 = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
  ${cover({
    univ: 'جامعة الموصل',
    college: 'كلية العلوم الإدارية',
    dept: 'قسم إدارة الأعمال',
    title: 'القيادة التحويلية وأثرها في جودة الخدمة',
    subtitle: 'دراسة تحليلية في الشركات الصناعية',
    degree: 'أطروحة دكتوراه',
    author: 'إعداد الطالب: علي حسن محمود',
    supervisor: 'إشراف: د. هدى ناصر',
    year: 'الموصل — 2019م',
  })}
  ${bodyPages(12, 'القيادة التحويلية وأثرها في جودة الخدمة', [3, 6, 9], [
    'يُعرّف الباحث القيادة التحويلية بأنها نمط قيادي يقوم على التأثير المثالي والتحفيز الإلهامي والاعتبار الفردي، ويعمل على تحويل قيم العاملين واتجاهاتهم نحو أهداف أعلى. وقد تباينت تعريفات القيادة التحويلية في الأدبيات، إلا أنها تلتقي عند التأكيد على التأثير العميق في المرؤوسين.',
    'وتشير نتائج الدراسة الميدانية إلى وجود أثر ذي دلالة إحصائية للقيادة التحويلية في جودة الخدمة، وأن أبعادها تسهم في تحسين سرعة الاستجابة وموثوقية الخدمة. ويوصي الباحث بتطوير برامج تدريبية للقادة تركز على ممارسات القيادة التحويلية.',
  ])}
</body></html>`

async function render(html, path) {
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.pdf({ path, format: 'A4', printBackground: true, preferCSSPageSize: true })
}

await render(study1, resolve('tests/fixtures/study1.pdf'))
await render(study2, resolve('tests/fixtures/study2.pdf'))
await browser.close()
console.log('fixtures created')
