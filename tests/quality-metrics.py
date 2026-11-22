import sys, re
from docx import Document
for path in sys.argv[1:]:
    text = '\n'.join(p.text for p in Document(path).paragraphs)
    letters = len(re.findall(r'[\u0621-\u064A]', text))
    suspicious = len(re.findall(r'[\u063B-\u063F\u0640\uFFFD]', text))
    broken = len(re.findall(r'األ|اإل|اآل', text))
    tokens = re.findall(r'[\u0621-\u064A]+', text)
    short = sum(1 for t in tokens if len(t) <= 1)
    repeated = len(re.findall(r'(\d)\1{3,}', text))
    print(path.split('\\')[-1], 'letters', letters, 'susp', suspicious, 'broken', broken, 'short', short, 'tokens', len(tokens), 'repdigits', repeated)
    print(' per1000 susp', round(suspicious/max(1,letters)*1000,2), 'broken', round(broken/max(1,letters)*1000,2), 'shortRatio', round(short/max(1,len(tokens)),3))
