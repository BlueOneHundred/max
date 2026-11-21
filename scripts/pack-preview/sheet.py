import sys,glob,os
from PIL import Image,ImageDraw
files=sys.argv[2:]; out=sys.argv[1]; H=360
ims=[]
for f in files:
    im=Image.open(f).convert('RGB'); w=int(im.width*H/im.height); ims.append((os.path.basename(f),im.resize((w,H))))
W=sum(i.width for _,i in ims)+10*len(ims); c=Image.new('RGB',(W,H+22),'white'); d=ImageDraw.Draw(c); x=0
for n,i in ims: c.paste(i,(x,22)); d.text((x+2,4),n[:40],fill='black'); x+=i.width+10
c.save(out,quality=85)
