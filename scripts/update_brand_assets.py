#!/usr/bin/env python3
"""Generate ThreadToMD branded preview images from the real synthetic popup screenshot.

All text describes the currently bundled source. The embedded UI is the actual
extension popup rendered with a synthetic tab by update_popup_screenshots.py.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/brand'
SHOT=ROOT/'docs/screenshots/popup.png'
ICON=ROOT/'icons/128.png'
FONT='/usr/share/fonts/opentype/inter/'
def face(size,bold=False):
    f=FONT+('InterDisplay-Bold.otf' if bold else 'Inter-Medium.otf')
    if not Path(f).exists(): f='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(f,size)

def rounded(draw,box,r,fill,outline=None,width=1):
    draw.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)

def rounded_pill(draw,x,y,label,fill,stroke,color,font,pad=14):
    bb=draw.textbbox((0,0),label,font=font)
    tw=bb[2]-bb[0]
    w=tw+pad*2; h=36
    rounded(draw,(x,y,x+w,y+h),h//2,fill,stroke)
    draw.text((x+pad,y+8),label,font=font,fill=color)
    return w

def gradient(w,h):
    im=Image.new('RGB',(w,h)); px=im.load()
    for y in range(h):
        for x in range(w):
            t=min(1,(x/w)*0.28+(y/h)*0.25)
            px[x,y]=(int(10+6*t),int(25+15*t),int(32+12*t))
    return im

logo=Image.open(ICON).convert('RGBA')
popup=Image.open(SHOT).convert('RGB')
# GitHub banner: 2:1, keeps the layout entirely consistent with the extension.
w,h=1280,640
img=gradient(w,h).convert('RGBA')
# subtle glow behind popup
halo=Image.new('RGBA',(w,h),(0,0,0,0)); hd=ImageDraw.Draw(halo)
hd.ellipse((825,-80,1430,710),fill=(38,176,148,60))
img=Image.alpha_composite(img,halo.filter(ImageFilter.GaussianBlur(65)))
d=ImageDraw.Draw(img)
rounded(d,(38,38,1242,602),30,(14,32,39,224),outline=(72,119,119,150),width=2)
logo80=logo.resize((80,80),Image.Resampling.LANCZOS)
img.alpha_composite(logo80,(70,72))
d=ImageDraw.Draw(img)
d.text((167,84),'ThreadToMD',font=face(55,True),fill='#f5faf8')
d.text((72,201),'Export conversations.',font=face(39,True),fill='#f4faf8')
d.text((72,250),'Keep your context.',font=face(39,True),fill='#96e6cf')
d.text((72,326),'Markdown + portable ZIP archives',font=face(21),fill='#b8d0cf')
d.text((72,363),'for long, virtualized ChatGPT histories',font=face(21),fill='#b8d0cf')
fontpill=face(14)
pw=rounded_pill(d,72,428,'Chrome  /  automatic',(24,70,64,255),(63,149,131,255),'#c2f6e5',fontpill)
rounded_pill(d,72+pw+12,428,'Firefox  /  manual',(25,47,55,255),(65,102,114,255),'#c8dce0',fontpill)
d.text((72,506),'LOCAL-FIRST   /   OPEN SOURCE   /   NO TELEMETRY',font=face(14),fill='#8daead')
d.text((72,561),'v0.2.4.16',font=face(13),fill='#90b7b1')
# Verified popup capture cropped to contents, not a drawn fake.
right=popup.resize((334,round(popup.height*334/popup.width)),Image.Resampling.LANCZOS)
rx,ry=869,48
rounded(d,(rx-10,ry-10,rx+right.width+10,ry+right.height+10),22,(7,20,24,255),outline=(66,152,137,200),width=2)
img.alpha_composite(right.convert('RGBA'),(rx,ry))
img.convert('RGB').save(OUT/'social-preview.png',optimize=True)

# 440 x 280 promo: same visual identity and current compact popup, legible label.
w,h=440,280
im=gradient(w,h).convert('RGBA')
d=ImageDraw.Draw(im)
rounded(d,(9,9,431,271),20,(15,35,43,240),outline=(68,139,127,255),width=2)
icon=logo.resize((53,53),Image.Resampling.LANCZOS);im.alpha_composite(icon,(22,23));d=ImageDraw.Draw(im)
d.text((84,28),'ThreadToMD',font=face(25,True),fill='#f1fbf7')
d.text((24,98),'Export long chats.',font=face(21,True),fill='#f1fbf7')
d.text((24,128),'Markdown + ZIP',font=face(18),fill='#9cebd5')
d.text((24,172),'Chrome: automatic',font=face(12),fill='#b5d4d0')
d.text((24,192),'Firefox: manual',font=face(12),fill='#b5d4d0')
d.text((24,241),'v0.2.4.16',font=face(11),fill='#8ab8b1')
# preview of actual UI in a small visual frame. Keep the left copy unobstructed.
mini=popup.resize((132,round(popup.height*132/popup.width)),Image.Resampling.LANCZOS)
rounded(d,(278,37,424,258),11,(9,24,30,255),outline=(70,154,136,220),width=2)
im.alpha_composite(mini.convert('RGBA'),(285,44))
im.convert('RGB').save(OUT/'chrome-store-promo-440x280.png',optimize=True)
for name in ['social-preview.png','chrome-store-promo-440x280.png']:
  file=OUT/name
  with Image.open(file) as asset: print(name,asset.size,file.stat().st_size)
