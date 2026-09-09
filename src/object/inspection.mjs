import { spatial,spectrumOf,freq,vector,TAU } from './waves.mjs';
import { diffract } from './reconstruction.mjs';

export function makeVolume(f,thickness,{size=64,n=128,nz}={}){
  const longitudinalBand=f.k-Math.sqrt(Math.max(0,f.k*f.k-(f.cut??f.na*f.k)**2));
  nz??=Math.max(17,Math.ceil(2*longitudinalBand*thickness/Math.PI)+1);
  const re=new Float32Array(n*n*nz),im=new Float32Array(n*n*nz);
  for(let z=0;z<nz;z++){
    const plane=spatial(f,thickness*z/(nz-1),true);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const px=(x/(n-1)-.5)*size,py=(y/(n-1)-.5)*size,v=samplePlane(plane,px,py),i=z*n*n+y*n+x;
      re[i]=v.re;im[i]=v.im;
    }
  }
  return {re,im,n,nz,size,thickness,k:f.k};
}

export function samplePlane(f,x,y){
  const u=x*f.n/f.L+f.n/2,v=y*f.n/f.L+f.n/2,ix=Math.floor(u),iy=Math.floor(v),tx=u-ix,ty=v-iy;
  if(ix<0||iy<0||ix>=f.n-1||iy>=f.n-1)return {re:0,im:0};
  let re=0,im=0;
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){const a=(i?tx:1-tx)*(j?ty:1-ty),idx=(iy+j)*f.n+ix+i;re+=a*f.re[idx];im+=a*f.im[idx];}
  return {re,im};
}
export function sampleVolume(v,r){
  const u=(r[0]/v.size+.5)*(v.n-1),w=(r[1]/v.size+.5)*(v.n-1),t=r[2]/v.thickness*(v.nz-1);
  if(u<0||w<0||t<0||u>v.n-1||w>v.n-1||t>v.nz-1)return {re:0,im:0,outside:true};
  const ix=Math.min(v.n-2,Math.floor(u)),iy=Math.min(v.n-2,Math.floor(w)),iz=Math.min(v.nz-2,Math.floor(t)),tx=u-ix,ty=w-iy,tz=t-iz;
  let re=0,im=0;
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
    const a=(x?tx:1-tx)*(y?ty:1-ty)*(z?tz:1-tz),i=(iz+z)*v.n*v.n+(iy+y)*v.n+ix+x;re+=a*v.re[i];im+=a*v.im[i];
  }
  return {re,im};
}

export function sliceCoordinates(u,v,{position=.5,tilt=0,rotation=0,span=16,centerX=0,centerY=0},thickness){
  const a=tilt*Math.PI/180,b=rotation*Math.PI/180,x=(u-.5)*span,y=(v-.5)*span;
  const xx=x*Math.cos(b)-y*Math.sin(b),yy=x*Math.sin(b)+y*Math.cos(b);
  return [centerX+xx*Math.cos(a),centerY+yy,position*thickness-xx*Math.sin(a)];
}

export function sliceImage(volume,config,{reference,wavelength,index,beta,stored=false,strength=1},n=256){
  const k=vector(wavelength,index,reference.horizontal,reference.vertical),values=new Float64Array(n*n),valid=new Uint8Array(n*n);
  let min=Infinity,max=-Infinity;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const r=sliceCoordinates(x/(n-1),1-y/(n-1),config,volume.thickness),o=sampleVolume(volume,r),i=y*n+x;
    if(o.outside)continue;
    const p=k[0]*r[0]+k[1]*r[1]+(k[2]-volume.k)*r[2]+(stored?0:reference.phase*Math.PI/180);
    const rr=Math.cos(p),ri=Math.sin(p);
    const cross=2*(o.re*rr+o.im*ri);
    const value=stored?strength*cross:config.quantity==='intensity'?(o.re**2+o.im**2+reference.amplitude**2+reference.amplitude*cross):beta*reference.amplitude*cross;
    values[i]=value;valid[i]=1;min=Math.min(min,value);max=Math.max(max,value);
  }
  return {values,valid,n,min:Number.isFinite(min)?min:0,max:Number.isFinite(max)?max:0,span:config.span};
}

export function fourierSlice(slice){
  const {n}=slice,re=Float64Array.from(slice.values),im=new Float64Array(n*n);let mean=0,count=0;
  for(let i=0;i<re.length;i++)if(slice.valid[i]){mean+=re[i];count++;}mean/=count||1;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)re[y*n+x]=(re[y*n+x]-mean)*(.5-.5*Math.cos(TAU*x/(n-1)))*(.5-.5*Math.cos(TAU*y/(n-1)))*slice.valid[y*n+x];
  const f=spectrumOf({re,im,n,L:slice.span},{k:0}),values=new Float64Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const j=((y+n/2)%n)*n+(x+n/2)%n;values[y*n+x]=Math.log10(1e-18+f.re[j]**2+f.im[j]**2);}
  return {values,n,frequencyMax:n/(2*slice.span)};
}

export function localVectors(f,reference,point,sigma=2){
  const field=spatial(f,point[2],true),{n,L}=f;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=Math.exp(-(((x-n/2)*L/n-point[0])**2+((y-n/2)*L/n-point[1])**2)/(2*sigma*sigma)),i=y*n+x;field.re[i]*=a;field.im[i]*=a;}
  const s=spectrumOf(field,f),candidates=[],kr=vector(f.wavelength,f.index,reference.horizontal,reference.vertical),power=s.re.map((r,i)=>r*r+s.im[i]*s.im[i]);
  const maximum=power.reduce((m,v)=>Math.max(m,v),0);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const qx=freq(x,n,L),qy=freq(y,n,L);if(qx*qx+qy*qy>=f.k*f.k)continue;
    const i=y*n+x,w=power[i];if(w<=Math.max(1e-24,.03*maximum))continue;
    let localMaximum=true;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&power[((y+dy+n)%n)*n+(x+dx+n)%n]>w)localMaximum=false;
    if(localMaximum)candidates.push({q:[qx,qy,Math.sqrt(f.k*f.k-qx*qx-qy*qy)],w});
  }
  candidates.sort((a,b)=>b.w-a.w);const peaks=[];
  for(const c of candidates){if(peaks.every(p=>Math.hypot(c.q[0]-p.q[0],c.q[1]-p.q[1])>.6)){const K=c.q.map((v,i)=>v-kr[i]);peaks.push({...c,K,period:TAU/Math.hypot(...K),frequency:Math.hypot(...K)/TAU,bragg:2*kr.reduce((s,v,i)=>s+v*K[i],0)+K.reduce((s,v)=>s+v*v,0)});if(peaks.length===3)break;}}
  return {kr,peaks,point,sigma,interpretation:'Lokale Fenster-FFT; spektrale Maxima sind keine eindeutige Zerlegung in Objektpunkte.'};
}

export function braggScan(record,read,options,axis='angle'){
  const center=axis==='angle'?record.reference.horizontal:record.wavelength,range=axis==='angle'?3.5:35,points=[];
  for(let i=0;i<=60;i++){
    const x=center+range*(i/30-1),r={...read,[axis==='angle'?'horizontal':'wavelength']:x};
    const thick=diffract(record,r,{...options,spectralOnly:true}),thin=diffract(record,r,{...options,thickness:options.thickness/4,strength:4*(options.strength??1),spectralOnly:true});
    points.push({x,thick:thick.etaPeriodic,thin:thin.etaPeriodic});
  }
  const max=Math.max(...points.map(p=>p.thin),1e-30);return {axis,center,points:points.map(p=>({...p,thick:p.thick/max,thin:p.thin/max})),thickness:options.thickness};
}
