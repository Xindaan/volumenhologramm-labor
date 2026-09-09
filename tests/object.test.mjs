import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gateGeometry,transformGeometry,sampleVisible,GROUPS } from '../src/object/geometry.mjs';
import { pointSpectrum,directPointField,at,spatial,emptySpectrum,TAU,freq,overlap,addSpectra } from '../src/object/waves.mjs';
import { expose,readHologram,diffract,imageMetrics } from '../src/object/reconstruction.mjs';
import { defaults,record,diffraction } from '../src/model.mjs';

const ref={horizontal:12,vertical:0,phase:0,amplitude:1},read={...ref,wavelength:532};
const settings={n:256,L:128,na:.28};
const point=(x=0,z=-110)=>({x,y:0,z,amplitude:1,phase:0});
const close=(a,b,tol,message='')=>assert.ok(Math.abs(a-b)<tol,`${message}: ${a} vs ${b}`);
const peak=a=>a.reduce((v,w)=>Math.max(v,w),0);

test('O1 Einzelpunkt: Weyl-Spektrum stimmt mit analytischer Kugelwelle überein (endliches Winkelband)',()=>{
  const p=[point()],f=pointSpectrum(p,settings);
  for(const r of [[0,0,0],[5,3,0],[12,-8,10]]){
    const a=at(f,r),b=directPointField(p,r);
    assert.ok(Math.hypot(a.re-b.re,a.im-b.im)/Math.hypot(b.re,b.im)<.02);
  }
  const rec=expose(f,ref),focus=[90,100,110,120,130].map(z=>peak(readHologram(rec,read,{focus:z}).power));
  assert.equal(focus.indexOf(Math.max(...focus)),2);
});

test('O2 Zwei Punkte: komplexe Summe ist linear, Intensität enthält gegenseitigen Kreuzterm',()=>{
  const a=pointSpectrum([point(-5)],settings),b=pointSpectrum([point(5,-125)],settings);
  const sum=pointSpectrum([point(-5),point(5,-125)],settings),added=addSpectra(a,b);
  close(overlap(sum,added),1,1e-12);
  const x=at(a,[0,0,0]),y=at(b,[0,0,0]),z=at(sum,[0,0,0]);
  close(z.re,x.re+y.re,1e-12);close(z.im,x.im+y.im,1e-12);
  const incoherent=x.re*x.re+x.im*x.im+y.re*y.re+y.im*y.im;
  assert.ok(Math.abs(z.re*z.re+z.im*z.im-incoherent)>incoherent*.1);
});

test('O3 Planwellenregression: neuer spektraler Born-Kern erreicht schwache Zweiwellenlösung',()=>{
  const f=emptySpectrum(settings),ix=7,q=freq(ix,f.n,f.L),theta=Math.asin(q/f.k)*180/Math.PI;
  f.re[ix]=1;
  const d=40,beta=.00001,rec=expose(f,ref,beta);
  for(const detune of [0,.5,1]){
    const out=diffract(rec,{...read,horizontal:ref.horizontal+detune},{thickness:d,spectralOnly:true});
    const state=defaults();state.obj.theta=theta;state.ref.theta=ref.horizontal;state.ref.amplitude=state.obj.amplitude=1;
    const result=diffraction(record(state),{theta:ref.horizontal+detune,wavelength:532},d,2*beta);
    close(out.etaPeriodic,result.eta,2e-8,'Born gegenüber schwacher Kopplung');
  }
});

test('O4 Tiefeninformation: gleiche Querposition, zwei z-Werte, zwei korrekte Fokusmaxima',()=>{
  for(const depth of [100,145]){
    const rec=expose(pointSpectrum([point(0,-depth)],settings),ref);
    const zs=[90,100,110,135,145,155],values=zs.map(focus=>peak(readHologram(rec,read,{focus,aperture:64}).power));
    assert.equal(zs[values.indexOf(Math.max(...values))],depth);
  }
  const both=expose(pointSpectrum([point(0,-100),point(0,-145)],settings),ref);
  const near=readHologram(both,read,{focus:100,aperture:64}),middle=readHologram(both,read,{focus:122.5,aperture:64}),far=readHologram(both,read,{focus:145,aperture:64});
  assert.ok(peak(near.power)>peak(middle.power)*2);assert.ok(peak(far.power)>peak(middle.power)*2);
});

test('O5 Parallaxe: verschobene Austrittspupille erzeugt unterschiedliche Tiefenparallaxe',()=>{
  const shifts=[];
  for(const depth of [100,155]){
    const rec=expose(pointSpectrum([point(0,-depth)],settings),ref),centers=[];
    for(const observer of [-10,10]){
      const out=readHologram(rec,read,{focus:125,observer,observerWidth:14,aperture:64});
      centers.push(imageMetrics(out.image,out.image,56).centroid[0]);
    }
    const shift=centers[1]-centers[0],expected=20*(1-165/(depth+40));
    close(shift,expected,.65,'Paraxiale Schwerpunktparallaxe');shifts.push(shift);
  }
  assert.ok(shifts[0]<-2&&shifts[1]>2);
});

test('O6 Abdeckung: halbe Pupille rekonstruiert weiterhin beide lateralen Objektpunkte',()=>{
  const rec=expose(pointSpectrum([point(-7),point(7)],settings),ref);
  const full=readHologram(rec,read,{focus:110,aperture:64}),half=readHologram(rec,read,{focus:110,aperture:64,mask:'left'});
  for(const x of [-7,7]){
    const ix=Math.round(half.image.n/2+x*half.image.n/half.image.L),i=half.image.n/2*half.image.n+ix;
    assert.ok(half.power[i]>full.power[i]*.1);
  }
  assert.ok(half.eta<full.eta*.7&&half.eta>full.eta*.3);
});

test('O7/O8 Detuning und Dicke: Wellenfront und Wirkungsgrad folgen dem Volumenintegral',()=>{
  const rec=expose(pointSpectrum([point(-5),point(5,-125)],settings),ref);
  const matched=readHologram(rec,read,{aperture:64});
  for(const changed of [{...read,horizontal:14},{...read,wavelength:557}]){
    const detuned=readHologram(rec,changed,{aperture:64});
    assert.ok(overlap(matched.image,detuned.image)<.85);
    assert.ok(detuned.eta<matched.eta);
    const thin=diffract(rec,changed,{thickness:10,spectralOnly:true}),thick=diffract(rec,changed,{thickness:80,spectralOnly:true});
    assert.ok(thick.relativeBragg<thin.relativeBragg*.6);
  }
});

test('O9 Mesh-Unabhängigkeit: gespeicherte Indexkoeffizienten allein erzeugen dasselbe Bild',()=>{
  let points=[point(-5),point(5,-125)],object=pointSpectrum(points,settings);
  const stored=expose(object,ref),before=readHologram(stored,read,{});
  points.length=0;object.re.fill(1e9);object.im.fill(-1e9);object=null;points=null;
  const after=readHologram(structuredClone(stored),read,{});
  assert.deepEqual(after.power,before.power);
  assert.equal('points' in stored,false);assert.equal('mesh' in stored,false);
  const source=readFileSync(new URL('../src/object/reconstruction.mjs',import.meta.url),'utf8');
  const imports=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  assert.deepEqual(imports,['./waves.mjs']);
  assert.equal(/gateGeometry|sampleVisible|render\(|THREE\.|geometry\.mjs/.test(source),false);
});

test('O10 Sampling: identisches Winkelband konvergiert beim Verfeinern des Hologrammrasters',()=>{
  const p=[point(-4),point(5,-125)],a=pointSpectrum(p,{...settings,n:256}),b=pointSpectrum(p,{...settings,n:512});
  const fa=spatial(a),fb=spatial(b);let error=0,norm=0;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=y*256+x,j=y*2*512+x*2;error+=(fa.re[i]-fb.re[j])**2+(fa.im[i]-fb.im[j])**2;norm+=fb.re[j]**2+fb.im[j]**2;}
  assert.ok(Math.sqrt(error/norm)<1e-10);
});

test('O10 Oberflächenquadratur: Tor konvergiert bei mehr sichtbaren Streuelementen',()=>{
  const tris=transformGeometry(gateGeometry(),{groups:GROUPS});
  const fields=[64,112,176].map(r=>pointSpectrum(sampleVisible(tris,r),settings));
  const low=1-overlap(fields[0],fields[2]),high=1-overlap(fields[1],fields[2]);
  console.log(`Tor-Konvergenz, 1−Feldtreue: LIVE ${low.toFixed(6)}, HIGH ${high.toFixed(6)} (FINAL als Referenz)`);
  assert.ok(high<low);assert.ok(high<.06);
});

test('Objektgruppen, Nullaufnahme und Snapshot-Isolation bleiben physikalisch konsistent',()=>{
  const tris=gateGeometry(),groups=GROUPS.map(group=>sampleVisible(transformGeometry(tris,{groups:[group]}),32));
  assert.ok(groups.every(p=>p.length>0));
  const f=pointSpectrum([point()],settings),zero=expose(f,ref,0);
  const out=readHologram(zero,read,{});assert.equal(out.eta,0);assert.equal(peak(out.power),0);
});
