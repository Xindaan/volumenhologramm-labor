import { fft2 } from '../fft.mjs';
export const TAU=2*Math.PI;
export const QUALITY={live:{n:256,points:64,label:'LIVE'},high:{n:512,points:112,label:'HIGH QUALITY'},final:{n:512,points:176,label:'FINAL'}};
export const rad=d=>d*Math.PI/180;
export const sinc=x=>Math.abs(x)<1e-8?1-x*x/6:Math.sin(x)/x;
export const freq=(i,n,L)=>TAU*(i<n/2?i:i-n)/L;
export function vector(wavelength,n,horizontal=0,vertical=0){const k=TAU*n*1000/wavelength,h=rad(horizontal),v=rad(vertical);return [k*Math.sin(h)*Math.cos(v),k*Math.sin(v),k*Math.cos(h)*Math.cos(v)];}
export function emptySpectrum({n=256,L=128,wavelength=532,index=1.5,na=.28}={}){
  return {n,L,wavelength,index,na,k:TAU*index*1000/wavelength,re:new Float64Array(n*n),im:new Float64Array(n*n)};
}

/** Periodic Weyl expansion of sum A_j exp[ik(R+z_j)]/R.
 * Finite, tapered angular band; periodic images outside the padded working ROI.
 * re/im are Fourier-series coefficients, not unnormalized DFT values.
 */
export function pointSpectrum(points,options={},progress=()=>{}){
  // Keep the physical band identical in LIVE/HIGH/FINAL, including short λ.
  const f=emptySpectrum(options),{n,L,k,na}=f,cut=Math.min(k*na,.84*Math.PI*Math.min(n,256)/L);
  const packed=points.map(p=>[p.x,p.y,p.z,p.amplitude??1,p.phase??0]);
  for(let iy=0;iy<n;iy++){
    const qy=freq(iy,n,L);
    for(let ix=0;ix<n;ix++){
      const qx=freq(ix,n,L),q=Math.hypot(qx,qy);if(q>=cut)continue;
      const kz=Math.sqrt(k*k-q*q),i=iy*n+ix;
      let re=0,im=0;
      for(const [x,y,z,a,phase] of packed){const t=phase-qx*x-qy*y-(kz-k)*z;re+=a*Math.cos(t);im+=a*Math.sin(t);}
      const taper=q<.9*cut?1:.5+.5*Math.cos(Math.PI*(q/cut-.9)/.1),factor=TAU*taper/(L*L*kz);
      f.re[i]=-factor*im;f.im[i]=factor*re;
    }
    if(iy%16===0)progress(iy/n);
  }
  f.cut=cut;return f;
}

export function directPointField(points,r,wavelength=532,index=1.5){
  const k=TAU*index*1000/wavelength;let re=0,im=0;
  for(const p of points){const R=Math.hypot(r[0]-p.x,r[1]-p.y,r[2]-p.z),phase=k*(R+p.z)+(p.phase??0),a=(p.amplitude??1)/R;re+=a*Math.cos(phase);im+=a*Math.sin(phase);}
  return {re,im};
}

export function spatial(f,z=0,envelope=false){
  const {n,L,k}=f,re=new Float64Array(n*n),im=new Float64Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,qx=freq(x,n,L),qy=freq(y,n,L),z2=k*k-qx*qx-qy*qy;if(z2<=0)continue;
    const p=(Math.sqrt(z2)-(envelope?k:0))*z,c=Math.cos(p),s=Math.sin(p),a=n*n*((x+y)%2?-1:1);
    re[i]=(f.re[i]*c-f.im[i]*s)*a;im[i]=(f.re[i]*s+f.im[i]*c)*a;
  }
  fft2(re,im,n,true);return {re,im,n,L,k};
}

export function spectrumOf(field,metadata){
  const re=Float64Array.from(field.re),im=Float64Array.from(field.im),n=field.n;
  fft2(re,im,n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=((x+y)%2?-1:1)/(n*n),i=y*n+x;re[i]*=a;im[i]*=a;}
  return {...metadata,n,L:field.L,re,im};
}
export function at(f,r,envelope=false){
  const {n,L,k}=f;let re=0,im=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x;if(f.re[i]===0&&f.im[i]===0)continue;
    const qx=freq(x,n,L),qy=freq(y,n,L),kz=Math.sqrt(Math.max(0,k*k-qx*qx-qy*qy));
    const p=qx*r[0]+qy*r[1]+(kz-(envelope?k:0))*r[2],c=Math.cos(p),s=Math.sin(p);
    re+=f.re[i]*c-f.im[i]*s;im+=f.re[i]*s+f.im[i]*c;
  }
  return {re,im};
}
export function addSpectra(a,b){return {...a,re:a.re.map((v,i)=>v+b.re[i]),im:a.im.map((v,i)=>v+b.im[i])};}
export function intensity(f){return f.re.map((v,i)=>v*v+f.im[i]*f.im[i]);}
export function overlap(a,b){let re=0,im=0,aa=0,bb=0;for(let i=0;i<a.re.length;i++){re+=a.re[i]*b.re[i]+a.im[i]*b.im[i];im+=a.im[i]*b.re[i]-a.re[i]*b.im[i];aa+=a.re[i]**2+a.im[i]**2;bb+=b.re[i]**2+b.im[i]**2;}return aa&&bb?(re*re+im*im)/(aa*bb):0;}
