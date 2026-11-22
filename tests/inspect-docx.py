from docx import Document
from docx.shared import Pt
import sys
path = sys.argv[1]
doc = Document(path)
print('paragraphs', len(doc.paragraphs))
print('sections', len(doc.sections))
print('first paragraphs:')
for p in doc.paragraphs[:8]:
    print(' -', p.text[:90], '| align', p.alignment, '| rtl', p.paragraph_format.right_to_left if hasattr(p.paragraph_format,'right_to_left') else '?')
for i, section in enumerate(doc.sections):
    footer = section.footer
    print('section', i+1, 'footer:', ' | '.join(p.text for p in footer.paragraphs))
