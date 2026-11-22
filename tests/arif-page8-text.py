import sys
sys.path.insert(0,'libs')
from pypdf import PdfReader
r=PdfReader(sys.argv[1])
print(r.pages[7].extract_text()[:2500])
