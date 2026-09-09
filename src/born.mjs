import { TAU, wavevector, fieldsAt, temporalContrast } from './model.mjs';
import { fft2 } from './fft.mjs';

/** Scalar forward first Born, selected + holographic order only.
 * Uses the outgoing Helmholtz angular spectrum Green function, NOT Kogelnik.
 * Rectangular interaction aperture with cosine-tapered edges, padded FFT window.
 * Only qz/k >= 0.25 is retained; discarded near-grazing content is measured.
 * Input is an undepleted unit plane wave. No transmission prediction.
 */
export function bornReconstruct(recorded, read, thickness, deltaN, options={}) {
  const size=options.size ?? 24;
  const width=options.width ?? 6, height=options.height ?? 4.5;
  const taper=options.taper ?? 0.75; // Numerical interaction-aperture apodization, µm.
  const k0=TAU*1000/read.wavelength,k=k0*recorded.n;
  const ki=wavevector(read.theta,read.wavelength,recorded.n);
  const kr=wavevector(recorded.ref.theta,recorded.ref.wavelength,recorded.n);
  const ko=TAU*recorded.n*1000/recorded.obj.wavelength;
  const [sx,sy,sz]=recorded.point;
  const nearX=Math.max(0,Math.abs(sx)-width/2),nearY=Math.max(0,Math.abs(sy)-height/2);
  const farX=Math.abs(sx)+width/2,farY=Math.abs(sy)+height/2;
  let maxQx,maxQy,sourceMin,sourceMax;
  if(recorded.objectMode==='sphere'){
    const gx0=ko*(-width/2-sx)/Math.hypot(-width/2-sx,nearY,sz),gx1=ko*(width/2-sx)/Math.hypot(width/2-sx,nearY,sz);
    maxQx=Math.max(Math.abs(ki[0]-kr[0]+Math.min(0,gx0)),Math.abs(ki[0]-kr[0]+Math.max(0,gx1)));
    maxQy=ko*farY/Math.hypot(nearX,farY,sz);
    sourceMin=ko*(-sz)/Math.hypot(farX,farY,sz)+ki[2]-kr[2];
    sourceMax=ko*(thickness-sz)/Math.hypot(nearX,nearY,thickness-sz)+ki[2]-kr[2];
  }else{
    const kv=wavevector(recorded.obj.theta,recorded.obj.wavelength,recorded.n);
    maxQx=Math.abs(kv[0]-kr[0]+ki[0]);maxQy=0;sourceMin=sourceMax=kv[2]-kr[2]+ki[2];
  }
  const requestedN=2**Math.ceil(Math.log2(Math.max(128,(Math.max(maxQx,maxQy)+(taper?3/taper:0))*size/(.9*Math.PI))));
  const n=options.n ?? Math.max(256,requestedN);
  if(n>512)throw new Error('Quellphase außerhalb der Rastergrenze. Kleinere Winkelabweichung oder weiter entfernten Objektpunkt wählen.');
  const phaseMismatchBound=Math.max(Math.abs(sourceMin-k),Math.abs(sourceMax-.25*k));
  const nz=options.nz ?? Math.max(64,Math.ceil(thickness/.3),Math.ceil(2*phaseMismatchBound*thickness/Math.PI));
  const length=n*n, dx=size/n, dz=thickness/nz;
  const real=new Float64Array(length),imag=new Float64Array(length);
  const sr=new Float64Array(length),si=new Float64Array(length),qz=new Float64Array(length);
  const factor=deltaN*recorded.dose*temporalContrast(recorded)/2;
  let rejectedWeight=0, retainedWeight=0;
  const edgeWindow=(p,extent)=>{
    if(extent>=size)return 1; // Full periodic analytical control case.
    const edge=extent/2-Math.abs(p);
    if(edge<=0)return 0;
    return taper>0&&edge<taper?0.5-0.5*Math.cos(Math.PI*edge/taper):1;
  };
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const qx=TAU*(x<n/2?x:x-n)/size,qy=TAU*(y<n/2?y:y-n)/size;
    const z2=k*k-qx*qx-qy*qy;
    qz[y*n+x]=z2>0?Math.sqrt(z2):0;
  }
  for(let z=0;z<nz;z++) {
    const pz=(z+0.5)*dz;
    sr.fill(0);si.fill(0);
    for(let y=0;y<n;y++) {
      const py=(y-n/2)*dx;
      if(Math.abs(py)>=height/2) continue;
      for(let x=0;x<n;x++) {
        const px=(x-n/2)*dx;
        if(Math.abs(px)>=width/2) continue;
        const f=fieldsAt([px,py,pz],recorded);
        const phase=f.phaseO-f.phaseR+ki[0]*px+ki[2]*pz;
        const a=factor*f.ampR*f.ampO*edgeWindow(px,width)*edgeWindow(py,height);
        const index=y*n+x;
        sr[index]=a*Math.cos(phase);si[index]=a*Math.sin(phase);
      }
    }
    fft2(sr,si,n);
    for(let i=0;i<length;i++) {
      const weight=sr[i]**2+si[i]**2;
      if(qz[i]<k*0.25) {rejectedWeight+=weight;continue;}
      retainedWeight+=weight;
      const phase=qz[i]*(thickness-pz),c=Math.cos(phase),s=Math.sin(phase);
      const a=k0*k0*recorded.n/qz[i]*dz;
      real[i]+=(-sr[i]*s-si[i]*c)*a;
      imag[i]+=(sr[i]*c-si[i]*s)*a;
    }
  }
  let power=0;
  for(let i=0;i<length;i++) power+=(real[i]**2+imag[i]**2)*qz[i]/ki[2];
  const referenceArea=Math.min(width,size)*Math.min(height,size);
  const eta=power*dx*dx/(length*referenceArea);
  fft2(real,imag,n,true);
  const discardedFraction=rejectedWeight/(retainedWeight+rejectedWeight || 1);
  return { real,imag,n,size,nz,width,height,taper,eta,discardedFraction,valid:eta<=0.1 && discardedFraction<0.01,
    reason:eta>0.1?'Born-Grenze überschritten: η > 10 %. Keine quantitative Leistungsprognose.':discardedFraction>=0.01?'Mehr als 1 % Quellspektrum außerhalb des zugelassenen Vorwärtsbereichs.':'',
    transmission:null };
}
