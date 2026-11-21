from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (1240, 1754), 'white')
d = ImageDraw.Draw(img)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 54)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 30)
d.text((620, 250), 'SCANNED THESIS COVER', font=font, fill='black', anchor='mm')
d.text((620, 340), 'This page is an image with no text layer', font=small, fill='#333', anchor='mm')
for i in range(14):
    y = 480 + i * 70
    d.line((200, y, 1040, y), fill='#777', width=6)
img.save('muqtataf/tests/fixtures/scanned.pdf', 'PDF', resolution=150)
print('scanned created')
