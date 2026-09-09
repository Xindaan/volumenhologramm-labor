// Deliberate boundary: this module imports wave algebra only. No geometry,
// scatterer list, image of the object, Three.js mesh or UI is available here.
import { spatial, spectrumOf, freq, vector, sinc, TAU, intensity, overlap } from './waves.mjs';

/** Store the + Fourier sideband of the real index modulation.
 * δn = H+ + conjugate(H+), H+ = beta * O * conjugate(R).
 * Reference/background and object-self intensity are ideally compensated.
 * The carrier (q_ref,k_ref,z) is kept analytically, not undersampled in voxels.
 */
export function expose(object,reference,beta=.0003){
  const phase=-reference.phase*Math.PI/180,a=beta*reference.amplitude,c=Math.cos(phase),s=Math.sin(phase);
  return {kind:'index-sideband-v1',n:object.n,L:object.L,k:object.k,index:object.index,wavelength:object.wavelength,na:object.na,cut:object.cut,
    reference:{...reference},beta,
    re:object.re.map((v,i)=>a*(v*c-object.im[i]*s)),im:object.im.map((v,i)=>a*(v*c+object.re[i]*s))};
}

/** Spectral first Born solution of the selected + order, 0 <= z <= d.
 * Every recorded transverse component has its own exact longitudinal mismatch.
 * Real field amplitudes, outgoing Helmholtz 1/k_dz, un-depleted read wave.
 */
export function diffract(record,read,{thickness=40,strength=1,spectralOnly=false}={}){
  const {n,L}=record,k0=TAU*1000/read.wavelength,k=k0*record.index;
  const kr=vector(record.wavelength,record.index,record.reference.horizontal,record.reference.vertical);
  const ki=vector(read.wavelength,record.index,read.horizontal,read.vertical),shift=[ki[0]-kr[0],ki[1]-kr[1]];
  const re=new Float64Array(n*n),im=new Float64Array(n*n);
  let flux=0,total=0,lost=0,mismatch2=0,matchedFlux=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,w=record.re[i]**2+record.im[i]**2;if(!w)continue;total+=w;
    const qx=freq(x,n,L),qy=freq(y,n,L),oz2=record.k**2-qx*qx-qy*qy;
    const dx=qx+shift[0],dy=qy+shift[1],dz2=k*k-dx*dx-dy*dy;
    if(oz2<=0||dz2<=0||Math.max(Math.abs(dx),Math.abs(dy))>.92*Math.PI*n/L){lost+=w;continue;}
    const dz=Math.sqrt(dz2),delta=ki[2]+Math.sqrt(oz2)-kr[2]-dz;
    const a=k0*k0*record.index*thickness*strength/dz*(read.amplitude??1);
    const p=dz*thickness+delta*thickness/2+(read.phase??0)*Math.PI/180;
    const c=Math.cos(p),s=Math.sin(p),b=a*sinc(delta*thickness/2);
    re[i]=b*(-record.re[i]*s-record.im[i]*c);im[i]=b*(record.re[i]*c-record.im[i]*s);
    flux+=(re[i]**2+im[i]**2)*dz/ki[2];matchedFlux+=a*a*w*dz/ki[2];mismatch2+=w*delta*delta;
  }
  const metrics={etaPeriodic:flux/(read.amplitude??1)**2,relativeBragg:matchedFlux?flux/matchedFlux:0,
    rejected:total?lost/total:0,rmsMismatch:Math.sqrt(mismatch2/(total||1)),k,ki,shift};
  if(spectralOnly)return metrics;
  // Coefficients above live on shifted transverse frequencies. Represent them
  // on a real-space grid before the physical exit pupil is applied.
  const field=spatial({n,L,k:record.k,re,im},0);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,p=shift[0]*(x-n/2)*L/n+shift[1]*(y-n/2)*L/n,c=Math.cos(p),s=Math.sin(p),r=field.re[i];
    field.re[i]=r*c-field.im[i]*s;field.im[i]=r*s+field.im[i]*c;
  }
  field.k=k;
  return {field,...metrics};
}

const edge=(x,half,taper)=>{const distance=half-Math.abs(x);return distance<=0?0:distance<taper?.5-.5*Math.cos(Math.PI*distance/taper):1;};
export function applyPupil(field,{aperture=48,mask='full',window=16,maskX=0,maskY=0,observer=0,observerWidth=0,taper=1}={}){
  const {n,L}=field,re=new Float64Array(n*n),im=new Float64Array(n*n);let area=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const px=(x-n/2)*L/n,py=(y-n/2)*L/n,i=y*n+x;
    let a=edge(px,aperture/2,taper)*edge(py,aperture/2,taper);
    if(mask==='left')a*=edge(px+aperture/4,aperture/4,taper);
    if(mask==='right')a*=edge(px-aperture/4,aperture/4,taper);
    if(mask==='center'||mask==='move')a*=edge(px-(mask==='move'?maskX:0),window/2,taper)*edge(py-(mask==='move'?maskY:0),window/2,taper);
    if(observerWidth>0)a*=edge(px-observer,observerWidth/2,taper)*edge(py,observerWidth/2,taper);
    re[i]=field.re[i]*a;im[i]=field.im[i]*a;area+=a*a*(L/n)**2;
  }
  return {re,im,n,L,k:field.k,area};
}

export function readHologram(record,read,options={}){
  const d=options.thickness??40,out=diffract(record,read,options),pupil=applyPupil(out.field,options);
  const exit=spectrumOf(pupil,{k:out.k}),z=-(options.focus??130)-d;
  const image=spatial(exit,z),power=intensity(image);
  let flux=0,evanescent=0,total=0;
  for(let y=0;y<exit.n;y++)for(let x=0;x<exit.n;x++){
    const i=y*exit.n+x,q2=freq(x,exit.n,exit.L)**2+freq(y,exit.n,exit.L)**2,w=exit.re[i]**2+exit.im[i]**2;total+=w;
    if(q2<out.k*out.k)flux+=w*Math.sqrt(out.k*out.k-q2)/out.ki[2];else evanescent+=w;
  }
  const eta=flux*record.L**2/((options.aperture??48)**2*(read.amplitude??1)**2);
  return {...out,exit,image,power,eta,pupilArea:pupil.area,evanescent:evanescent/(total||1),
    valid:eta<.05&&out.rejected<.005,transmission:null};
}

export function imageMetrics(image,reference,roi=40){
  const {n,L}=image;let sum=0,xsum=0,ysum=0,sharp=0,refsum=0,refx=0,refy=0;
  const a={re:[],im:[]},b={re:[],im:[]};
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
    const px=(x-n/2)*L/n,py=(y-n/2)*L/n;if(Math.max(Math.abs(px),Math.abs(py))>roi/2)continue;
    const i=y*n+x,I=image.re[i]**2+image.im[i]**2,J=reference.re[i]**2+reference.im[i]**2;
    sum+=I;xsum+=I*px;ysum+=I*py;refsum+=J;refx+=J*px;refy+=J*py;
    sharp+=I*I;a.re.push(image.re[i]);a.im.push(image.im[i]);b.re.push(reference.re[i]);b.im.push(reference.im[i]);
  }
  return {fidelity:overlap(a,b),centroid:[xsum/(sum||1),ysum/(sum||1)],shift:[xsum/(sum||1)-refx/(refsum||1),ysum/(sum||1)-refy/(refsum||1)],concentration:sharp/(sum*sum||1),energy:sum*(L/n)**2};
}
