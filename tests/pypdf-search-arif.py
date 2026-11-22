import sys
sys.path.insert(0, 'libs')
from pypdf import PdfReader
import re, unicodedata
def norm(s):
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'[\u064B-\u065F\u0670\u0640]', '', s)
    s = s.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي').replace('ة','ه')
    s = re.sub(r'[^\w\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()
r=PdfReader(sys.argv[1])
for i,p in enumerate(r.pages,1):
    t=norm(p.extract_text() or '')
    if 'تقدير الذات' in t or ('تقدير' in t and 'الذات' in t):
        print('PAGE',i, (p.extract_text() or '')[:250].replace('\n',' | '))
