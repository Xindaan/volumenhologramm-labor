import { fieldsAt, temporalContrast, diffraction, record, scan, centralFwhm, grating, wavevector, norm } from './model.mjs';
export const fmt=(value,digits=2)=>Number.isFinite(value)?value.toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
const svgNS='http://www.w3.org/2000/svg';
function element(tag,attributes={},parent){const e=document.createElementNS(svgNS,tag);Object.entries(attributes).forEach(([k,v])=>e.setAttribute(k,v));parent?.append(e);return e;}
function label(svg,text,x,y,attrs={}){const e=element('text',{x,y,...attrs},svg);e.textContent=text;return e;}

export function drawSlice(canvas,state){
  const config=state.stage==='recording'?state:state.recorded??state,axis=state.sliceAxis;
  const width=480,height=240;canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height),stored=state.stage!=='recording';
  const factor=temporalContrast(config),point=config.point;
  // Color transfer for presentation only. Physical values always use fieldsAt().
  const sphereMax=config.objectMode==='sphere'?norm(point)/Math.max(.1,-point[2]):1;
  const maxCross=Math.max(1e-12,config.ref.amplitude*config.obj.amplitude*sphereMax*Math.abs(factor));
  const peak=state.deltaN*config.dose*maxCross;
  let maxI=0,maxPhaseStep=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const a=(x+.5)/width-.5,b=(y+.5)/height;
    const r=axis==='y'?[a*6,state.slice*2.25,b*state.thickness]:axis==='z'?[a*6,(.5-b)*4.5,(state.slice+1)/2*state.thickness]:[state.slice*3,a*4.5,b*state.thickness];
    const f=fieldsAt(r,config);let v=stored?(peak>1e-14?.5+f.cross*factor/(4*maxCross):.5):f.intensity/4;
    v=Math.max(0,Math.min(1,v));maxI=Math.max(maxI,f.intensity);
    const i=(y*width+x)*4;
    data.data[i]=9+Math.pow(v,1.5)*171;data.data[i+1]=24+v*213;data.data[i+2]=30+v*176;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);
  const physicalPosition=axis==='z'?(state.slice+1)/2*state.thickness:state.slice*(axis==='x'?3:2.25);
  document.querySelector('#slice-value').textContent=`${axis} = ${fmt(physicalPosition)} µm`;
  document.querySelector('#slice-scale').textContent=axis==='x'?'1 µm':'1 µm';
  document.querySelector('#slice-scale').style.width=`${100/(axis==='x'?4.5:6)}%`;
  document.querySelector('#slice-axis-label').textContent=axis==='z'?'y ↑':'z ↓';
  document.querySelector('#color-min').textContent=stored?`−${fmt(peak,4)}`:'0';
  document.querySelector('#color-max').textContent=stored?`+${fmt(peak,4)} δn`:'4 |E₀|²';
  canvas.setAttribute('aria-label',stored?'Schnitt der gespeicherten Indexmodulation, Kontrast automatisch skaliert':'Schnitt der momentanen Interferenzintensität bei t = 0, Intensitäten über 4 sind farbgesättigt');
  // Estimate phase variation between adjacent pixels; disclose undersampling.
  const g=grating(config);
  maxPhaseStep=axis==='z'?Math.abs(g.K[0])*6/width:Math.max(Math.abs(g.K[0])*(axis==='x'?4.5:6)/width,Math.abs(g.K[2])*state.thickness/height);
  canvas.title=stored?'δn-Farbskala automatisch auf den Modulationsbereich normiert.':`I(r,t=0); feste Farbskala 0…4. ${maxI>4.05?'Spitzen oberhalb 4 sind farbgesättigt.':''}`;
  if(maxPhaseStep>Math.PI/2)canvas.title+=' Sehr feine Fringen nähern sich der Rasterauflösung; xy-Schnitt verwenden.';
}

export function drawScan(svg,state){
  const r=state.stage==='recording'?record(state):state.recorded??record(state);
  svg.replaceChildren();
  if(r.objectMode==='sphere')return;
  const read=state.stage==='recording'?{theta:r.ref.theta,wavelength:r.ref.wavelength}:state.read;
  const samples=scan(r,read,state.thickness,state.deltaN,state.scan);
  const compare=scan(r,read,state.thickness/4,state.deltaN*4,state.scan);
  const x0=samples[0].x,x1=samples.at(-1).x,px=x=>52+(x-x0)/(x1-x0)*548,py=y=>168-140*y;
  const defs=element('defs',{},svg),gradient=element('linearGradient',{id:'scan-fill',x1:0,y1:0,x2:0,y2:1},defs);
  element('stop',{offset:'0%','stop-color':'#86e6b9','stop-opacity':'.22'},gradient);element('stop',{offset:'100%','stop-color':'#86e6b9','stop-opacity':'0'},gradient);
  [0,.25,.5,.75,1].forEach(y=>{element('line',{x1:52,x2:600,y1:py(y),y2:py(y),stroke:'#24373e','stroke-width':.6,'stroke-dasharray':y?'3 5':'0'},svg);label(svg,`${y*100}`,40,py(y)+3,{'text-anchor':'end'});});
  label(svg,'η / %',22,14,{'class':'axis-title'});
  for(let i=0;i<=6;i++){const x=x0+(x1-x0)*i/6;label(svg,fmt(x,state.scan==='angle'?0:0),px(x),185,{'text-anchor':'middle'});}
  label(svg,state.scan==='angle'?'Interner Rekonstruktionswinkel θ / °':'Vakuumwellenlänge λ₀ / nm',330,202,{'text-anchor':'middle','class':'axis-title'});
  function pathFor(data){let path='',previousValid=false;for(const p of data){if(!p.valid||p.eta===null){previousValid=false;continue;}path+=`${previousValid?'L':'M'}${px(p.x).toFixed(2)},${py(p.eta).toFixed(2)} `;previousValid=true;}return path;}
  if(state.compare)element('path',{d:pathFor(compare),fill:'none',stroke:'#677f8b','stroke-width':'1.2','stroke-dasharray':'5 5'},svg);
  const path=pathFor(samples);
  if(samples.every(p=>p.valid&&p.eta!==null))element('path',{d:`M52,168 ${path.replace(/^M/,'L')} L600,168 Z`,fill:'url(#scan-fill)'},svg);
  element('path',{d:path,fill:'none',stroke:'#94ebcf','stroke-width':'2'},svg);
  const current=state.scan==='angle'?read.theta:read.wavelength,d=diffraction(r,read,state.thickness,state.deltaN);
  if(current>=x0&&current<=x1){element('line',{x1:px(current),x2:px(current),y1:22,y2:168,stroke:'#8ce3c6','stroke-width':.75,'stroke-dasharray':'2 5',opacity:.6},svg);if(d.valid&&d.eta!==null){element('circle',{cx:px(current),cy:py(d.eta),r:5,fill:'#163c31',stroke:'#bafadc','stroke-width':1.8},svg);label(svg,`${fmt(d.eta*100,1)} %`,Math.max(83,Math.min(558,px(current)+32)),Math.max(19,py(d.eta)-11),{fill:'#b4f4db','text-anchor':'middle'});}}
  document.querySelector('#scan-current').textContent=`${fmt(state.thickness,0)} µm`;
  document.querySelector('#scan-compare').textContent=`${fmt(state.thickness/4,1)} µm · gleiches ν`;
  const center=state.scan==='angle'?r.ref.theta:r.ref.wavelength;
  const fwhm=centralFwhm(samples,center);
  document.querySelector('#scan-width').textContent=fwhm && d.valid && Math.abs(d.nu-Math.PI/2)<.15 && Math.abs(d.delta)<1e-6?`FWHM ${fmt(fwhm,2)} ${state.scan==='angle'?'°':'nm'}`:'';
  svg.setAttribute('aria-label',`Beugungseffizienz über ${state.scan==='angle'?'internem Rekonstruktionswinkel':'Vakuumwellenlänge'}. Aktuell ${d.valid?fmt(d.eta*100,2)+' Prozent':'außerhalb des Modellbereichs'}.`);
  const chartX=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()).x;
  svg.onpointermove=e=>{const vx=chartX(e);const index=Math.max(0,Math.min(samples.length-1,Math.round((vx-52)/548*(samples.length-1))));const p=samples[index],tip=document.querySelector('#chart-tooltip');tip.hidden=false;tip.textContent=`${fmt(p.x,2)} ${state.scan==='angle'?'°':'nm'} · ${p.valid?fmt(p.eta*100,2)+' %':'Modellgrenze'}`;};
  svg.onpointerleave=()=>document.querySelector('#chart-tooltip').hidden=true;
  svg.onclick=e=>{if(state.stage==='recording')return;const vx=chartX(e);const value=x0+Math.max(0,Math.min(1,(vx-52)/548))*(x1-x0);svg.dispatchEvent(new CustomEvent('scan-pick',{detail:{axis:state.scan,value}}));};
}

export function drawBorn(canvas,result){
  if(!result)return;canvas.width=result.n;canvas.height=result.n;const ctx=canvas.getContext('2d'),img=ctx.createImageData(result.n,result.n);
  let max=0;for(let i=0;i<result.real.length;i++)max=Math.max(max,Math.hypot(result.real[i],result.imag[i]));
  for(let i=0;i<result.real.length;i++){
    const amplitude=Math.hypot(result.real[i],result.imag[i])/(max||1),phase=Math.atan2(result.imag[i],result.real[i]);
    const brightness=Math.sqrt(amplitude);
    // Cyclic phase color; lightness encodes relative field magnitude.
    img.data[i*4]=10+brightness*(128+102*Math.cos(phase));
    img.data[i*4+1]=17+brightness*(128+95*Math.cos(phase-2.094));
    img.data[i*4+2]=24+brightness*(128+85*Math.cos(phase+2.094));img.data[i*4+3]=255;
  }
  ctx.putImageData(img,0,0);
}

export function drawKVectors(svg,state,result){
  svg.replaceChildren();const config=state.stage==='recording'?state:state.recorded??state,g=grating(config);
  const read=state.stage==='recording'?{theta:config.ref.theta,wavelength:config.ref.wavelength}:state.read;
  const ki=wavevector(read.theta,read.wavelength,config.n),k=norm(ki),scale=157/k,origin=[200,219];
  const p=v=>[origin[0]+v[0]*scale,origin[1]-v[2]*scale];
  const defs=element('defs',{},svg);
  for(const [name,color]of [['cyan','#73cce6'],['mint','#94ebcf'],['orange','#eeab86']]){const marker=element('marker',{id:`arrow-${name}`,markerWidth:7,markerHeight:7,refX:6,refY:3.5,orient:'auto'},defs);element('path',{d:'M0,0 L7,3.5 L0,7 Z',fill:color},marker);}
  element('path',{d:`M43,219 A157,157 0 0,1 357,219`,fill:'none',stroke:'#3a545b','stroke-dasharray':'4 5'},svg);
  element('line',{x1:25,y1:219,x2:378,y2:219,stroke:'#283e46'},svg);element('line',{x1:200,y1:239,x2:200,y2:35,stroke:'#283e46'},svg);
  label(svg,'kₓ',370,238);label(svg,'kz',206,39);label(svg,'|k| = 2πn / λ₀',26,22);label(svg,'Vorwärts-Halbraum · interne Vektoren',27,260);
  function arrow(a,b,color,name){element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,'stroke-width':1.6,'marker-end':`url(#arrow-${name})`},svg);}
  arrow(origin,p(ki),'#73cce6','cyan');label(svg,'kᵢ',p(ki)[0]-15,p(ki)[1]-6,{fill:'#73cce6'});
  const closure=ki.map((v,i)=>v+g.K[i]);arrow(p(ki),p(closure),'#eeab86','orange');label(svg,config.objectMode==='sphere'?'K(0)':'K',(.5*(p(ki)[0]+p(closure)[0])),.5*(p(ki)[1]+p(closure)[1])-10,{fill:'#eeab86'});
  if(result?.kd){arrow(origin,p(result.kd),'#94ebcf','mint');label(svg,'k_d',p(result.kd)[0]+8,p(result.kd)[1]-3,{fill:'#94ebcf'});element('line',{x1:p(closure)[0],x2:p(result.kd)[0],y1:p(closure)[1],y2:p(result.kd)[1],stroke:'#f8cd8d','stroke-width':3},svg);}
  if(config.objectMode==='sphere')label(svg,'Nur lokaler Tangentenvektor am Ursprung',30,243,{fill:'#c6b193','font-size':8});
}
