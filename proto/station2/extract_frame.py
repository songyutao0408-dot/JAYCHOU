import numpy as np, cv2, glob, sys
def key(img):
    b,g,r = [img[...,i].astype(np.float32) for i in range(3)]
    d = g - np.maximum(r,b)
    a = 1-np.clip((d-18)/45,0,1)
    return a
best=None
for f in sorted(glob.glob('full/f*.png')):
    img=cv2.imread(f); a=key(img); a[:60,:140]=0
    m=a>0.5
    ys,xs=np.where(m)
    y0,y1=ys.min(),ys.max(); h=y1-y0
    low=m[int(y1-0.12*h):y1+1]
    xs2=np.where(low.any(0))[0]; w=xs2.max()-xs2.min()
    # front foot (right) should be heel-strike: prefer wide
    if best is None or w>best[0]: best=(w,f,y0,y1)
print(best)
w,f,y0,y1=best
img=cv2.imread(f); a=key(img); a[:60,:140]=0
# keep largest component
n,lab,st,_=cv2.connectedComponentsWithStats((a>0.5).astype(np.uint8))
k=1+np.argmax(st[1:,4]); keep=cv2.dilate((lab==k).astype(np.uint8),np.ones((5,5)))
a*=keep
# despill
im=img.astype(np.float32); g=im[...,1]; mx=np.maximum(im[...,0],im[...,2]); im[...,1]=np.minimum(g,mx+4)
ys,xs=np.where(a>0.5); x0,x1,y0,y1=xs.min()-6,xs.max()+7,ys.min()-6,ys.max()+7
out=np.dstack([im,a*255])[y0:y1,x0:x1].astype(np.uint8)
cv2.imwrite('fig_src.png',out); print(out.shape)
prev=out[...,:3]*(out[...,3:]/255.)+np.array([200,180,160])*(1-out[...,3:]/255.)
cv2.imwrite('fig_prev.png',prev.astype(np.uint8))
