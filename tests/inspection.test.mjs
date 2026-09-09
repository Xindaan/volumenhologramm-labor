import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySpectrum,freq,pointSpectrum } from '../src/object/waves.mjs';
import { expose } from '../src/object/reconstruction.mjs';
import { makeVolume,sliceImage,localVectors } from '../src/object/inspection.mjs';

test('Scanner: gespeicherter Index und berechneter Kreuzterm stimmen auch bei Referenzphase überein',()=>{
  const f=emptySpectrum({n:128,L:64});f.re[5]=.2;f.im[129]=.1;
  const reference={horizontal:12,vertical:3,amplitude:1.2,phase:73},beta=.0003;
  const recorded=expose(f,reference,beta),before=makeVolume(f,40,{n:32,nz:9,size:16}),after=makeVolume(recorded,40,{n:32,nz:9,size:16});
  const config={span:8,position:.5,tilt:20,rotation:35,quantity:'index'};
  const a=sliceImage(before,config,{reference,wavelength:532,index:1.5,beta},64),b=sliceImage(after,config,{reference,wavelength:532,index:1.5,beta,stored:true},64);
  for(let i=0;i<a.values.length;i++)assert.ok(Math.abs(a.values[i]-b.values[i])<1e-10);
  const zero=sliceImage(after,config,{reference,wavelength:532,index:1.5,beta,stored:true,strength:0},32);assert.ok(zero.max===0&&zero.min===0);
});

test('Lokale k-Analyse erzeugt für eine einzige ebene Welle keine künstlichen Mehrfachmaxima',()=>{
  const f=emptySpectrum({n:128,L:64});f.re[5]=1;
  const out=localVectors(f,{horizontal:12,vertical:0},[2,3,15]);
  assert.equal(out.peaks.length,1);assert.ok(Math.abs(out.peaks[0].q[0]-freq(5,128,64))<1e-12);
  assert.ok(Math.abs(out.peaks[0].bragg)<1e-10);
});

test('Qualitätsstufen behalten auch bei kurzer Wellenlänge dasselbe Winkelband',()=>{
  const options={L:128,wavelength:480,index:1.7},p=[{x:0,y:0,z:-130,amplitude:1}];
  const live=pointSpectrum(p,{...options,n:256}),high=pointSpectrum(p,{...options,n:512});
  assert.equal(live.cut,high.cut);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const j=(y<128?y:y+256)*512+(x<128?x:x+256),i=y*256+x;
    assert.equal(live.re[i],high.re[j]);assert.equal(live.im[i],high.im[j]);
  }
});

test('Volumenvorschau verfeinert z bei größerer Dicke gegen Enveloppen-Aliasing',()=>{
  const f=emptySpectrum({n:32,L:128});f.re[0]=1;f.cut=f.k*.28;
  const a=makeVolume(f,40,{n:8}),b=makeVolume(f,100,{n:8});
  assert.ok(b.nz>a.nz);
  const bandwidth=f.k-Math.sqrt(f.k*f.k-f.cut*f.cut);
  assert.ok(bandwidth*100/(b.nz-1)<=Math.PI/2);
});
