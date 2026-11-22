from docx import Document
import sys, glob, os
for path in sys.argv[1:]:
    print('='*80)
    print(os.path.basename(path))
    doc = Document(path)
    print('paragraphs', len(doc.paragraphs), 'sections', len(doc.sections))
    for i, p in enumerate(doc.paragraphs[:18]):
        if p.text.strip():
            print(f'{i:02d}: {p.text[:220]}')
    for i, section in enumerate(doc.sections[:6]):
        print('footer', i+1, '|', ' | '.join(p.text for p in section.footer.paragraphs))
