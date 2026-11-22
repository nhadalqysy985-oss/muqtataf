from docx import Document
import sys
doc = Document(sys.argv[1])
for i,p in enumerate(doc.paragraphs):
    if p.text.strip(): print(f'{i:02d}: {p.text[:160]}')
