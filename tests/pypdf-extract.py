import sys
sys.path.insert(0, 'libs')
from pypdf import PdfReader
path = sys.argv[1]
r = PdfReader(path)
print('pages', len(r.pages))
for i, p in enumerate(r.pages[:1]):
    txt = p.extract_text()
    print('--- page', i+1, '---')
    print(txt[:2000])
