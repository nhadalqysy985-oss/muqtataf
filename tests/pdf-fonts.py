import sys
sys.path.insert(0, 'libs')
from pypdf import PdfReader
r=PdfReader(sys.argv[1])
p=r.pages[7]
res=p['/Resources']
fonts=res.get('/Font',{})
for name, ref in fonts.items():
    f=ref.get_object()
    print(name, 'BaseFont=', f.get('/BaseFont'), 'Subtype=', f.get('/Subtype'), 'Encoding=', f.get('/Encoding'))
    if '/ToUnicode' in f:
        data=f['/ToUnicode'].get_data()
        print('  ToUnicode bytes', len(data), data[:400])
    if '/FontDescriptor' in f:
        fd=f['/FontDescriptor'].get_object()
        print('  Descriptor', {k:fd.get(k) for k in ['/FontName','/Flags','/FontFile','/FontFile2','/FontFile3'] if k in fd})
