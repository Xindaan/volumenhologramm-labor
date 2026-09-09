import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, record, fieldsAt, grating, diffraction, rad, temporalContrast, exposureAt, indexAt, scan, centralFwhm, optimalDeltaN, setViewMode } from '../src/model.mjs';
import { fft, fft2 } from '../src/fft.mjs';
import { bornReconstruct } from '../src/born.mjs';
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b} (tol ${tolerance})`);

test('A1: parallele identische ebene Wellen haben räumlich konstante Intensität und keine Beugungsordnung',()=>{
  const s=defaults();s.obj.theta=s.ref.theta;s.obj.phase=67;
  const expected=2+2*Math.cos(rad(67));
  for(const r of [[0,0,0],[0.312,2,9],[-3,-2,40]]) close(fieldsAt(r,s).intensity,expected);
  assert.equal(grating(s).period,Infinity);
  close(diffraction(record(s),s.read,40,s.deltaN).eta,0);
});
test('A2: Fringenabstand Λ = λ₀ / (2 n sin(α/2)) und Intensitätsperiode',()=>{
  for(const angle of [4,12,24,40]) {
    const s=defaults();s.ref.theta=-angle;s.obj.theta=angle;
    const expected=0.532/(2*s.n*Math.sin(rad(angle)));
    close(grating(s).period,expected);
    close(fieldsAt([0,0,7],s).intensity,fieldsAt([expected,0,7],s).intensity);
    close(fieldsAt([expected/2,0,7],s).intensity,0);
  }
});
test('A3: passende Geometrie, ν=π/2 → η=1 und k_d = k_obj',()=>{
  const s=defaults(),r=record(s),result=diffraction(r,s.read,s.thickness,s.deltaN);
  close(result.delta,0);close(result.nu,Math.PI/2);close(result.eta,1);
  grating(s).ko.forEach((x,i)=>close(result.kd[i],x));
  assert.equal(result.valid,true);
  for(const theta of [-18,-12,2]) {
    s.ref.theta=theta;s.obj.theta=31;s.read.theta=theta;
    const dn=optimalDeltaN(s,s.thickness);
    close(diffraction(record(s),s.read,s.thickness,dn).eta,1);
  }
});
test('A4/A5: Winkel- und Wellenlängendetuning unterdrücken den Bragg-Peak',()=>{
  const s=defaults(),r=record(s);
  for(const theta of [-25,-23]) assert.ok(diffraction(r,{...s.read,theta},40,s.deltaN).eta<0.15);
  for(const wavelength of [517,547]) assert.ok(diffraction(r,{...s.read,wavelength},40,s.deltaN).eta<0.2);
});
test('A6: bei konstantem ν halbiert doppelte Dicke nahezu die Winkel- und Spektralbreite',()=>{
  const s=defaults(),r=record(s);
  for(const axis of ['angle','wavelength']) {
    const center=axis==='angle'?s.read.theta:s.read.wavelength;
    const w40=centralFwhm(scan(r,s.read,40,s.deltaN,axis,4001),center);
    const w80=centralFwhm(scan(r,s.read,80,s.deltaN/2,axis,4001),center);
    assert.ok(w80/w40>0.49 && w80/w40<0.51,`${axis}: ${w40}, ${w80}`);
  }
});
test('A7: Ansichtswechsel verändert nur mode, keine Modellparameter oder Aufzeichnung',()=>{
  const s=defaults();s.recorded=record(s);s.stage='reconstruction';
  const p=setViewMode(s,'physicist');
  assert.deepEqual({...p,mode:s.mode},s);assert.equal(p.recorded,s.recorded);
  close(diffraction(s.recorded,s.read,40,s.deltaN).eta,diffraction(p.recorded,p.read,40,p.deltaN).eta);
});
test('Belichtung: ungleiche Frequenzen mitteln aus; komplexe Amplituden werden richtig addiert',()=>{
  const s=defaults();s.obj.wavelength=533;
  assert.ok(Math.abs(temporalContrast(s))<1e-3);
  close(exposureAt([1,2,4],s),2,0.002);
  s.obj.wavelength=532;s.obj.amplitude=0.5;s.ref.phase=90;
  const f=fieldsAt([0.2,0,1],s);
  const re=f.ampR*Math.cos(f.phaseR)+f.ampO*Math.cos(f.phaseO);
  const im=f.ampR*Math.sin(f.phaseR)+f.ampO*Math.sin(f.phaseO);
  close(f.intensity,re*re+im*im);
});
test('Aufzeichnung ist unabhängiger Snapshot, δn skaliert linear mit Belichtung und Amplituden',()=>{
  const s=defaults();s.dose=0.7;s.obj.amplitude=0.5;
  const r=record(s);s.obj.theta=0;s.ref.phase=170;
  assert.equal(r.obj.theta,24);assert.equal(r.ref.phase,0);
  close(indexAt([0,0,0],r,0.002)-r.n,0.002*0.7*0.5);
  close(diffraction(r,s.read,40,0).eta,0);
});
test('Kugelwelle: 1/R-Amplitude und lokale Phasensteigung k(r-r₀)/R',()=>{
  const s=defaults();s.objectMode='sphere';const p=[1,0.3,3],h=1e-5;
  const f=fieldsAt(p,s);const dist=Math.hypot(...p.map((x,i)=>x-s.point[i]));
  close(f.ampO,Math.hypot(...s.point)/dist);
  const gradient=(fieldsAt([p[0]+h,p[1],p[2]],s).phaseO-fieldsAt([p[0]-h,p[1],p[2]],s).phaseO)/(2*h);
  close(gradient,2*Math.PI*s.n/0.532*(p[0]-s.point[0])/dist,1e-7);
});
test('Unabhängige RK4-Lösung des hermiteschen Zweiwellen-ODE bestätigt η und Energieerhaltung',()=>{
  const s=defaults(),r=record(s);
  for(const angle of [-24,-23.7,-23]) {
    const d=diffraction(r,{...s.read,theta:angle},s.thickness,s.deltaN);
    const deriv=y=>[-d.delta/2*y[1]-d.kappa*y[3],d.delta/2*y[0]+d.kappa*y[2],-d.kappa*y[1]+d.delta/2*y[3],d.kappa*y[0]-d.delta/2*y[2]];
    let y=[1,0,0,0];const h=40/4000;
    for(let j=0;j<4000;j++) {
      const a=deriv(y),b=deriv(y.map((v,i)=>v+h*a[i]/2)),c=deriv(y.map((v,i)=>v+h*b[i]/2)),e=deriv(y.map((v,i)=>v+h*c[i]));
      y=y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+e[i])/6);
    }
    close(y[2]**2+y[3]**2,d.eta,1e-9);close(y.reduce((a,b)=>a+b*b,0),1,1e-9);
  }
});
test('Keine erzwungene Monotonie: Überkopplung ν=π führt zu Rückkopplung',()=>{
  const s=defaults();close(diffraction(record(s),s.read,40,2*s.deltaN).eta,0);
  assert.equal(diffraction(record(s),{theta:60,wavelength:700},40,s.deltaN).eta,null);
  s.ref.theta=-0.1;s.obj.theta=0.1;
  assert.equal(diffraction(record(s),{...s.read,theta:-0.1},40,s.deltaN).valid,false);
});
test('FFT: bekannte Fouriermode, Parseval und 2D-Rücktransformation',()=>{
  const r=Float64Array.from({length:16},(_,i)=>Math.cos(2*Math.PI*3*i/16)),im=new Float64Array(16);
  fft(r,im);close(r[3],8);close(r[13],8);
  const real=Float64Array.from({length:64},(_,i)=>Math.sin(i*1.3)),imag=Float64Array.from({length:64},(_,i)=>Math.cos(i*.7));
  const re0=real.slice(),im0=imag.slice(),power=real.reduce((a,v,i)=>a+v*v+imag[i]**2,0);
  fft2(real,imag,8);close(real.reduce((a,v,i)=>a+v*v+imag[i]**2,0)/64,power);
  fft2(real,imag,8,true);real.forEach((v,i)=>close(v,re0[i]));imag.forEach((v,i)=>close(v,im0[i]));
});
test('Born: keine Modulation → kein Streufeld; η ∝ Δn²',()=>{
  const s=defaults();s.objectMode='sphere';const r=record(s),o={n:32,nz:32,size:12};
  close(bornReconstruct(r,s.read,8,0,o).eta,0);
  const a=bornReconstruct(r,s.read,8,0.0002,o),b=bornReconstruct(r,s.read,8,0.0004,o);
  close(b.eta/a.eta,4);assert.ok(a.eta>0);assert.equal(a.transmission,null);
});
test('Born: ebener periodischer Kontrollfall stimmt mit analytischer schwacher Kopplung überein',()=>{
  const s=defaults(),size=12,n=64,theta=Math.asin(4*.532/(1.5*size))*180/Math.PI;
  s.ref.theta=-theta;s.obj.theta=theta;s.read.theta=-theta;
  const r=record(s),dn=0.0001,d=6;
  const numerical=bornReconstruct(r,s.read,d,dn,{n,nz:128,size,width:size*2,height:size*2});
  const c=diffraction(r,s.read,d,dn);
  close(numerical.eta,c.nu*c.nu,1e-12);
});
test('Born: Tiefenverfeinerung des Kugelwellenfalls konvergiert',()=>{
  const s=defaults();s.objectMode='sphere';const r=record(s),dn=0.0003;
  const a=bornReconstruct(r,s.read,12,dn,{n:64,nz:64});
  const b=bornReconstruct(r,s.read,12,dn,{n:64,nz:128});
  assert.ok(Math.abs(a.eta/b.eta-1)<0.01,`η64=${a.eta}, η128=${b.eta}`);
});
test('Born: Demo-Geometrie konvergiert bei Quer-, Tiefen- und Fensterverfeinerung',()=>{
  const s=defaults();s.objectMode='sphere';const r=record(s);
  const standard=bornReconstruct(r,s.read,40,.0003);
  const coarse=bornReconstruct(r,s.read,40,.0003,{n:128});
  const padded=bornReconstruct(r,s.read,40,.0003,{n:256,size:48});
  const depth=bornReconstruct(r,s.read,40,.0003,{nz:standard.nz*2});
  assert.ok(standard.valid);
  for(const other of [coarse,padded,depth])assert.ok(Math.abs(other.eta/standard.eta-1)<0.001,`${other.eta} vs ${standard.eta}`);
});
test('Born: Detuning passt das Querraster an, um aliasierte Quellphasen zu vermeiden',()=>{
  const s=defaults();s.objectMode='sphere';
  const result=bornReconstruct(record(s),{theta:43,wavelength:532},4,.0001,{nz:16});
  assert.equal(result.n,512);
  assert.ok(result.eta<1e-5);
});
