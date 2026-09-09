import { gateGeometry,transformGeometry,normalizeImported,GROUPS } from './geometry.mjs';
import { QUALITY,vector } from './waves.mjs';
import { sliceImage,fourierSlice,sliceCoordinates,samplePlane } from './inspection.mjs';
import { raster,drawField,drawObservation,plotScan,drawVectors } from './draw.mjs';
import { ObjectScene } from './scene.js';
import { modelDocumentation } from './documentation.js';

const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],fmt=(v,d=2)=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:d,minimumFractionDigits:d});
function defaults(){return {stage:3,quality:'live',wavelength:532,index:1.5,beta:.0003,groups:[...GROUPS],yaw:0,pitch:0,scale:1,x:0,y:0,depth:130,
  reference:{horizontal:12,vertical:0,phase:0,amplitude:1},read:{horizontal:12,vertical:0,phase:0,amplitude:1,wavelength:532},
  optics:{thickness:40,strength:1,focus:130,aperture:64,mask:'full',window:20,maskX:0,maskY:0,observer:0,observerWidth:0},
  objectSlice:-50,fieldMode:'amplitude',slice:{position:.5,span:16,tilt:0,rotation:0,centerX:0,centerY:0,quantity:'index'},
  fourier:false,scanAxis:'angle',expert:false,compare:false,cut:false,gain:0};}
let state=defaults(),geometry=gateGeometry(),imported=false,worker=null,serial=0,timer=null,toastTimer=null;
let draft=null,saved=null,volume=null,volumeStored=false,plane=null,result=null,scan=null,counts=null,points=[],scene=null;
let imageScale=.04,fieldScale=.3,busy=false,dirty=true,recordedCounts=null,recordedFocuses=[130,142],probePoint=[0,0,20];
const stageNames=['Das räumliche Objekt','Die kohärente Objektwelle','Referenzwelle zuschalten','Interferenz im Volumen','Hologramm belichtet','Rekonstruktion aus gespeicherter Wellenfront'];
const get=path=>path.split('.').reduce((a,k)=>a[k],state);
function set(path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((a,k)=>a[k],state)[last]=value;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function control(path,label,min,max,step,unit='',digits=1){return `<div class="control"><div><label for="${path}">${label}</label><span><input id="${path}-number" type="number" aria-label="${label} Zahlenwert" data-path="${path}" data-number min="${min}" max="${max}" step="${step}" value="${get(path)}"><span class="unit">${unit}</span></span></div><input id="${path}" type="range" aria-label="${label}" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${get(path)}" data-digits="${digits}"></div>`;}
function controls(){
  $('#controls').innerHTML=`<fieldset class="control-section source-control"><legend>Diskretisierung</legend><select id="quality" class="quality-select" aria-label="Qualitätsstufe"><option value="live">LIVE · 256² / Quadratur 64²</option><option value="high">HIGH QUALITY · 512² / 112²</option><option value="final">FINAL · 512² / 176²</option></select><p>Ein festes Winkelband. Mehr Streuelemente verfeinern die Oberflächenquadratur. FINAL rechnet einige Sekunden.</p></fieldset>
  <fieldset class="control-section source-control"><legend id="object-name">Brandenburger Tor</legend><div class="group-toggles">${[['columns','Säulen'],['beam','Gebälk & Aufbau'],['quadriga','Quadriga']].map(([g,l])=>`<label class="check"><input type="checkbox" data-group="${g}" checked>${l}</label>`).join('')}</div>${control('yaw','Objekt drehen',-55,55,1,'°')}${control('pitch','Objekt neigen',-20,20,1,'°')}${control('scale','Maßstab',.65,1.35,.05,'×',2)}${control('x','Objekt seitlich',-10,10,.5,'µm')}${control('y','Objekt vertikal',-7,7,.5,'µm')}${control('depth','Abstand zum Medium',105,165,1,'µm',0)}<label class="local-upload">Lokales OBJ / GLTF / GLB laden<input id="model-file" type="file" multiple accept=".obj,.gltf,.glb,.bin,.png,.jpg,.jpeg,.webp"></label><p id="import-note">Skaliertes Lehrmodell in µm. Statische Modelle; mitgehörige lokale Dateien gemeinsam auswählen.</p></fieldset>
  <fieldset class="control-section source-control"><legend>Referenz & Aufzeichnung</legend>${control('reference.horizontal','Referenz horizontal',5,22,.1,'°')}${control('reference.vertical','Referenz vertikal',-12,12,.1,'°')}${control('wavelength','Aufzeichnungswellenlänge',480,630,1,'nm',0)}${control('reference.phase','Referenzphase',0,360,1,'°',0)}${control('reference.amplitude','Referenzamplitude',0,2,.05,'',2)}${control('index','Brechungsindex n',1.3,1.7,.01,'',2)}${control('beta','Indexfaktor β',0,.0008,.00001,'',5)}<p>δn = β [I − |O|² − |R|²]. Ideale Hintergrund-/Selbsttermkompensation; keine Photochemie.</p></fieldset>
  <section class="control-section"><h3>Volumen & Ansicht</h3>${control('optics.thickness','Effektive Dicke d',8,100,1,'µm',0)}<label class="check"><input type="checkbox" id="cut"> Volumen am Schnitt öffnen</label><label class="check"><input type="checkbox" id="compare"> Originalgeometrie zum Vergleich</label><button id="reset-camera">Szene ausrichten</button></section>
  <section class="control-section"><h3>Scanner verschieben</h3>${control('slice.centerX','Schnittzentrum x',-24,24,.25,'µm')}${control('slice.centerY','Schnittzentrum y',-24,24,.25,'µm')}<p>Im Schnitt klicken: lokale Richtungen, Fringenabstände und Bragg-Bedingung.</p></section>
  <section class="control-section"><h3>Aufzeichnung</h3><button id="export-record" disabled>Indexkoeffizienten exportieren</button><p>Der unabhängige Snapshot bleibt in dieser Sitzung gespeichert. Der Export enthält keine Geometrie.</p></section>`;
  $('#read-sliders').innerHTML=`${control('read.horizontal','Rekonstruktion horizontal',0,26,.05,'°')}${control('read.vertical','Rekonstruktion vertikal',-14,14,.1,'°')}${control('read.wavelength','Rekonstruktionswellenlänge',470,650,.5,'nm')}${control('optics.strength','Gespeicherte Modulation ×',0,2,.05,'',2)}<button id="match" class="secondary">Aufzeichnungsgeometrie treffen ↶</button>`;
  $('#aperture-controls').innerHTML=`${control('optics.aperture','Hologrammapertur',24,80,1,'µm')}${control('optics.window','Fensterbreite',8,40,1,'µm')}${control('optics.maskX','Fenster x',-24,24,.5,'µm')}${control('optics.maskY','Fenster y',-24,24,.5,'µm')}`;
  all('[data-path]').forEach(input=>input.addEventListener('input',()=>{
    const value=Number(input.value);if(!Number.isFinite(value)||input.value===''){sync();return;}
    const path=input.dataset.path;set(path,Math.max(Number(input.min),Math.min(Number(input.max),value)));sync();parameterChanged(path);
  }));
  all('[data-group]').forEach(input=>input.addEventListener('change',()=>{state.groups=all('[data-group]:checked').map(e=>e.dataset.group);sourceChanged();}));
  $('#quality').addEventListener('change',e=>{state.quality=e.target.value;sourceChanged();});
  $('#model-file').addEventListener('change',loadModel);
  $('#cut').addEventListener('change',e=>{state.cut=e.target.checked;updateScene();});
  $('#compare').addEventListener('change',e=>{state.compare=e.target.checked;updateScene();$('#source-label').textContent=state.compare&&state.stage>=4?'VERGLEICH · ORIGINALGEOMETRIE':'01 · KOHÄRENTE STREUER';});
  $('#reset-camera').addEventListener('click',()=>scene?.resetCamera());
  $('#export-record').addEventListener('click',()=>{if(!saved)return;const snapshot={...saved,re:Array.from(saved.re),im:Array.from(saved.im),units:'µm; wavelengths nm; angles deg',schema:1};download(new Blob([JSON.stringify(snapshot)],{type:'application/json'}),'tor-volumenhologramm-index.json');});
  $('#match').addEventListener('click',()=>{if(!saved)return;state.read={...saved.reference,wavelength:saved.wavelength};sync();scheduleRead(true);});
}

function sync(){
  all('[data-path]').forEach(input=>{if(document.activeElement!==input)input.value=get(input.dataset.path);});
  $('#quality').value=state.quality;$('#process-position').value=state.stage;$('#process-label').textContent=stageNames[state.stage];
  all('[data-stage]').forEach(b=>b.classList.toggle('active',Number(b.dataset.stage)===state.stage));
  all('.source-control').forEach(f=>{f.disabled=state.stage>=4||busy;});
  all('[data-group], [data-path="yaw"], [data-path="pitch"], [data-path="scale"], [data-path="x"], [data-path="y"], [data-path="depth"]').forEach(input=>{input.disabled=!!state.presetPoints;});
  $('#source-label').textContent=state.stage>=4?(state.compare?'VERGLEICH · ORIGINALGEOMETRIE':'01 · OBJEKTWELLE AUS'):'01 · KOHÄRENTE STREUER';
  $('#expose').disabled=busy||!draft||dirty;$('#expose').innerHTML=state.stage>=4?'↶ Zur Objektgestaltung':'◉ Hologramm belichten <span>→</span>';
  if(state.stage>=4)$('#expose').disabled=busy;
  $('#exposure-status').textContent=state.stage>=4?'Objektwelle aus. Hologramm gespeichert.':saved?'Neue Belichtung vorbereitet.':'Noch unbeschrieben.';
  $('#exposure-note').textContent=state.stage>=4?'Unabhängige Indexkoeffizienten · Rekonstruktion ohne Mesh-Zugriff.':'Idealisierter Index-Kreuzterm; vollständige Interferenz im Scanner unter I.';
  $('#field-off').hidden=state.stage<4;$('#await-exposure').hidden=!!result&&state.stage===5;
  $('#scanner-intensity').disabled=volumeStored;$('#export-record').disabled=!saved;
  $('#decompose').disabled=busy||!draft||dirty||imported||!!state.presetPoints;
  $('#object-slice').disabled=state.stage>=4;all('[data-field]').forEach(button=>{button.disabled=state.stage>=4;});
  $('#focus').value=state.optics.focus;$('#focus-output').value=`${fmt(state.optics.focus,1)} µm`;
  $('#metric-focus').textContent=`−${fmt(state.optics.focus,1)} µm`;
  $('#observer-output').value=`${fmt(state.optics.observer,1)} µm`;
  $('#scanner-position-output').value=`${fmt(state.slice.position*state.optics.thickness,1)} µm`;
  $('#scanner-position').value=state.slice.position;
  const c=state.stage>=4?recordedCounts:counts;
  if(c){$('#quality-badge').textContent=c.quality;$('#sampling-label').textContent=`${c.points.toLocaleString('de-DE')} Streuer · ${c.n} × ${c.n} Feldsamples`;$('#metric-points').textContent=c.points.toLocaleString('de-DE');}
  const pupil=state.optics.observerWidth||state.optics.aperture,diameter=Math.min(pupil,state.optics.aperture/(['left','right'].includes(state.optics.mask)?2:1),['center','move'].includes(state.optics.mask)?state.optics.window:Infinity),distance=state.optics.focus+state.optics.thickness;
  const index=saved&&state.stage>=4?saved.index:state.index,lambda=(saved&&state.stage>=4?state.read.wavelength:state.wavelength)/1000/index,angular=Math.min(.28,Math.sin(Math.atan(diameter/(2*distance))));
  $('#resolution-note').textContent=`Aperturabschätzung: NA = n sinθ ≈ ${fmt(index*angular,3)} · lateral ≈ ${fmt(.61*lambda/angular,2)} µm · axial ≈ ${fmt(2*lambda/(angular*angular),1)} µm. Richtwerte für die engere Pupillenachse mit kreisförmiger Näherung; die simulierte Maske ist rechteckig. Bildfeld 48 µm, FFT-Fenster 128 µm, Δx = ${fmt(128/(c?.n??256),3)} µm.`;
  updateScene();
}
function sceneConfig(){return {...state,hasImage:!!result,recordMeta:saved?{reference:saved.reference,wavelength:saved.wavelength,index:saved.index}:null};}
function updateScene(){scene?.update(sceneConfig());}
function transformed(forceAll=false){return transformGeometry(geometry,{...state,groups:imported?['import']:forceAll?GROUPS:state.groups});}
function displayGeometry(){return state.presetPoints?[]:transformed();}
function sourceChanged(){
  worker?.terminate();worker=null;serial++;busy=false;
  $('#decomposition-results').hidden=true;$('#metric-efficiency').textContent=$('#metric-fidelity').textContent='—';
  if(state.stage>=4)state.stage=3;dirty=true;result=null;scene?.geometry(displayGeometry(),state.depth,state.presetPoints??[]);sync();
  $('#calculation-text').textContent='Geometrie geändert · Feldanzeige wird neu berechnet …';schedule('draft',350);
}
function parameterChanged(path){
  if(path.startsWith('reference.')||path==='beta'||path.startsWith('optics.'))$('#decomposition-results').hidden=true;
  if(['yaw','pitch','scale','x','y','depth','wavelength','index'].includes(path)){sourceChanged();return;}
  if(path.startsWith('reference.')||path==='beta'){drawScanner();updateScene();return;}
  if(path.startsWith('slice.')){drawScanner();return;}
  if(path==='optics.thickness'){
    if(state.stage>=4)scheduleRead(true,true);else sourceChanged();return;
  }
  if(path.startsWith('read.')){scheduleRead(path!=='read.horizontal'&&!(path==='read.wavelength'&&state.scanAxis==='wavelength'));return;}
  if(path==='optics.strength'){drawScanner();updateScene();}
  if(path.startsWith('optics.'))scheduleRead(path==='optics.strength');
}
function schedule(kind,delay=80,extra={}){clearTimeout(timer);timer=setTimeout(()=>run(kind,extra),delay);}
function scheduleRead(wantScan=false,wantVolume=false){$('#decomposition-results').hidden=true;if(!saved||state.stage<4)return;schedule('read',100,{wantScan,wantVolume});}
function run(kind,extra={}){
  if(kind==='field'&&dirty)kind='draft';
  if((kind==='record'||kind==='field')&&!draft)return;if(kind==='read'&&!saved)return;
  worker?.terminate();worker=new Worker(new URL('./labor-worker.js',import.meta.url),{type:'module'});const id=++serial;busy=true;
  $('#calculation').className='';$('#calculation-progress').value=0;
  $('#calculation-text').textContent=kind==='draft'?`${QUALITY[state.quality].label}: kohärente Streusumme und Volumen …`:kind==='decompose'?'Vier Hologramme aus denselben sichtbaren Streuelementen …':kind==='probe'?'Lokale Fenster-FFT …':'Komplexe Wellenfront wird berechnet …';sync();
  const config=structuredClone(state);if(kind==='record')config.read={...state.reference,wavelength:state.wavelength};
  const data={id,kind,config,...extra};
  if(kind==='draft'){data.triangles=transformed();if(state.presetPoints)data.points=state.presetPoints;}
  if(kind==='decompose')data.triangles=transformed(true);
  if(['record','field'].includes(kind))data.field=draft;
  if(kind==='probe'){data.field=volumeStored?{...saved,re:saved.re.map(v=>v*state.optics.strength),im:saved.im.map(v=>v*state.optics.strength)}:draft;data.config.reference=volumeStored?saved.reference:state.reference;}
  if(kind==='read')data.record=saved;
  worker.onerror=e=>finishError(e.message||'Rechnung fehlgeschlagen.');
  worker.onmessage=({data:m})=>{
    if(m.id!==serial)return;if(m.progress!==undefined){$('#calculation-progress').value=m.progress;return;}
    if(m.error){finishError(m.error);return;}
    busy=false;worker?.terminate();worker=null;
    if(m.kind==='draft'){
      draft=m.field;volume=m.volume;plane=m.plane;counts=m.counts;points=m.points;volumeStored=false;dirty=false;
      scene?.geometry(displayGeometry(),state.depth,points);scene?.setVolume(volume,sceneConfig(),false);drawFieldView();drawScanner();
    }else if(m.kind==='record'){
      saved=m.record;volume=m.volume;volumeStored=true;state.read={...saved.reference,wavelength:saved.wavelength};result=m.result;scan=m.scan;
      recordedCounts=counts;recordedFocuses=focusDepths();imageScale=Math.max(result.baselineMax,.000001);state.stage=extra.targetStage??5;
      scene?.setVolume(volume,sceneConfig(),true);drawResult();drawScanner();toast('Belichtet. Das rekonstruierte Bild entsteht jetzt ausschließlich aus dem Index-Snapshot.');
    }else if(m.kind==='read'){
      result=m.result;if(m.volume){volume=m.volume;volumeStored=true;scene?.setVolume(volume,sceneConfig(),true);}if(m.scan)scan=m.scan;drawResult();if(m.volume)drawScanner();
    }else if(m.kind==='field'){plane=m.plane;drawFieldView();}
    else if(m.kind==='probe'){showProbe(m.probe);}
    else if(m.kind==='decompose'){showDecomposition(m);}
    $('#calculation').className='done';$('#calculation-text').textContent=`Berechnet · ${kind==='draft'?`${m.counts.points.toLocaleString('de-DE')} Streuer, ${m.counts.samples.toLocaleString('de-DE')} komplexe Feldsamples`:'Anzeige aus dem aktuellen numerischen Ergebnis'} · lokal, ohne API`;
    sync();
  };
  worker.postMessage(data);
}
function finishError(message){busy=false;worker?.terminate();worker=null;$('#calculation').className='error';$('#calculation-text').textContent=message;toast(message);sync();}
function focusDepths(){
  if(state.presetPoints)return [100,155];
  if(imported&&points.length){let near=Infinity,far=-Infinity;for(const p of points){near=Math.min(near,-p.z);far=Math.max(far,-p.z);}return [near,far].map(z=>Math.max(85,Math.min(190,z)));}
  return [state.depth,state.depth+12];
}
function drawFieldView(){if(!plane)return;drawField($('#object-field'),plane,state.fieldMode,fieldScale,64);$('#object-slice-output').value=`${state.objectSlice} µm`;$('#field-plane-label').textContent=`z = ${state.objectSlice} µm · 64 µm Bildfeld`;$('#field-legend').textContent=state.fieldMode==='phase'?'arg(E): zyklische Farbe; Helligkeit aus |E|. Globale exp(ikz)-Phase für die Anzeige entfernt.':state.fieldMode==='real'||state.fieldMode==='imag'?'Blau: negativ · Bernstein: positiv. Re/Im des Träger-enveloppenfelds E exp(−ikz); feste Skala.':'Betrag |E| in fester Skala. Alle sichtbaren Streuelemente überlagern sich kohärent.';updateScene();}
function scannerParameters(){return volumeStored?{reference:saved.reference,wavelength:saved.wavelength,index:saved.index,beta:saved.beta,stored:true,strength:state.optics.strength}:{reference:state.reference,wavelength:state.wavelength,index:state.index,beta:state.beta,stored:false};}
function drawScanner(){
  if(!volume)return;const slice=sliceImage(volume,state.slice,scannerParameters());
  if(state.fourier){const f=fourierSlice(slice),max=f.values.reduce((v,x)=>Math.max(v,x),-Infinity);raster($('#scanner'),f.values,f.n,{kind:'spectrum',scale:max});$('#scanner-scale').textContent=`FFT des Schnitts · ±${fmt(f.frequencyMax,1)} µm⁻¹`;$('#scanner-legend').textContent='Leistungsspektrum des tatsächlichen Schnitts · Mittelwert entfernt, Hann-Fenster · logarithmische Farbe (6 Dekaden).';}
  else{
    const index=volumeStored||state.slice.quantity==='index';raster($('#scanner'),slice.values,slice.n,{kind:index?'signed':'intensity',scale:index?.0007:2,valid:slice.valid});
    $('#scanner-scale').textContent=`${state.slice.span} × ${state.slice.span} µm · zₘ = ${fmt(state.slice.position*volume.thickness,1)} µm`;
    $('#scanner-legend').textContent=index?`δn ∈ [${slice.min.toExponential(1)}, ${slice.max.toExponential(1)}] · Blau − / Bernstein +. Klicken: lokale k-Komponenten.`:`I = |O + R|² ∈ [${fmt(slice.min,2)}, ${fmt(slice.max,2)}] · dimensionslose normierte Feldintensität.`;
  }
  $('#scanner-index').classList.toggle('active',!state.fourier&&(volumeStored||state.slice.quantity==='index'));$('#scanner-intensity').classList.toggle('active',!state.fourier&&!volumeStored&&state.slice.quantity==='intensity');$('#scanner-fourier').classList.toggle('active',state.fourier);sync();
}
function drawResult(){
  if(!result)return;drawObservation($('#reconstruction'),result.power,result.image.n,result.image.L,imageScale,10**state.gain);
  $('#metric-efficiency').textContent=result.valid?`${fmt(result.eta*100,3)} %`:'außerhalb Modell';$('#metric-fidelity').textContent=result.metrics.energy>1e-25&&result.baselineMax>1e-25?`${fmt(result.metrics.fidelity*100,1)} %`:'—';
  $('#image-note').textContent=`|Eᵣₑₖ|² · Schwerpunktverschiebung Δx = ${fmt(result.metrics.shift[0],2)} µm, Δy = ${fmt(result.metrics.shift[1],2)} µm. Feldtreue vergleicht mit passender Beleuchtung bei gleicher Pupille und Fokusebene.`;
  const maxFraction=result.rejected*100;
  $('#validity').classList.toggle('warning',!result.valid);$('#validity').textContent=result.valid?`Schwache +1-Born-Ordnung · η = ${fmt(result.eta*100,4)} % · RMS-Phasenfehler/µm = ${fmt(result.rmsMismatch,4)} · ${fmt(maxFraction,3)} % Gittergewicht außerhalb des zugelassenen Rasters. Keine transmittierte Leistung berechnet.`:`Gültigkeitsgrenze: η_Born = ${fmt(result.eta*100,2)} %, verworfenes spektrales Gewicht ${fmt(maxFraction,2)} %. Darstellung der formalen Rechnung; keine quantitative Effizienzprognose. Modulation/Dicke oder Detuning verkleinern.`;
  if(scan){plotScan($('#bragg-scan'),scan,state.read[scan.axis==='angle'?'horizontal':'wavelength']);$('#scan-caption').textContent=`Türkis: d = ${fmt(scan.thickness,0)} µm · gestrichelt: d/4 bei 4β. Beide relativ zum Maximum der dünnen Kurve. Gesamtleistung im FFT-Fenster vor der Austrittspupille.`;}
  updateScene();
}
function stage(value){
  if(value>=4&&(state.stage<4||!saved)){if(draft&&!dirty&&!busy)run('record',{targetStage:value});else toast('Bitte das aktuelle Objektfeld fertig berechnen lassen.');return;}
  state.stage=value;
  if(value<4&&volumeStored){volumeStored=false;sourceChanged();}
  if(value>=4&&!volumeStored){scheduleRead(true,true);}
  sync();
}
function showProbe(probe){
  state.expert=true;$('#expert').setAttribute('aria-pressed','true');$('#expert-panel').hidden=false;drawVectors($('#vector-canvas'),probe);
  const v=a=>`[${a.map(x=>fmt(x,4)).join('; ')}]`;
  $('#expert-values').textContent=`Ort r = ${v(probe.point)} µm\nkᵣ = ${v(probe.kr)} rad/µm\n\n`+probe.peaks.map((p,i)=>`${i+1}: kₒ = ${v(p.q)}\n   K = ${v(p.K)}\n   Λ = ${fmt(p.period,4)} µm;  |K|/2π = ${fmt(p.frequency,4)} µm⁻¹\n   2 kᵣ·K + |K|² = ${p.bragg.toExponential(2)} µm⁻²`).join('\n\n');
  if(!probe.peaks.length)$('#expert-values').textContent+='Kein messbares lokales Spektrum: Nullfeld oder Nullmodulation.';
  $('#expert-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function showDecomposition(data){
  $('#decomposition-results').hidden=false;$('#decomposition-results').innerHTML=`<div class="decomp-cards">${['Nur Säulen','Nur Quadriga','Gesamtes Tor','Säulen + Quadriga'].map((name,i)=>`<div class="decomp-card"><h3>${name}</h3><span>Interferenz mit Referenz · 16 µm Schnitt</span><canvas id="decomp-pattern-${i}"></canvas><span>Rekonstruktion aus Indexdaten · 48 µm</span><canvas id="decomp-image-${i}"></canvas></div>`).join('')}</div><div class="coherence-comparison"><div><canvas id="coherent-joint"></canvas><p><strong>Kohärent:</strong> |Oₛ + Oq + R|²</p></div><div><canvas id="incoherent-sum"></canvas><p><strong>Intensitäten addiert:</strong> |Oₛ + R|² + |Oq + R|² − |R|². Die Referenz wird nur einmal gezählt.</p></div><div><canvas id="coherence-difference"></canvas><p><strong>Differenz:</strong> 2 Re(Oₛ Oq*) · eigene symmetrische Farbskala.</p></div></div><p>Der Unterschied entsteht im vollständigen Belichtungsbild durch die gegenseitige Objektinterferenz. Nach der hier ausdrücklich verwendeten idealen Selbsttermkompensation ist der gespeicherte Index-Kreuzterm linear im Objektfeld: H₊,gemeinsam = H₊,Säulen + H₊,Quadriga. Vergleich mit ${data.points.toLocaleString('de-DE')} gemeinsam sichtbaren Streuelementen und 256² Feldsamples.</p>`;
  const ref=vector(state.wavelength,state.index,state.reference.horizontal,state.reference.vertical),n=192,span=16,patterns=[];
  for(let c=0;c<4;c++){
    const values=new Float64Array(n*n),f=data.cases[c].plane;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const px=(x/(n-1)-.5)*span,py=(.5-y/(n-1))*span,o=samplePlane(f,px,py),p=ref[0]*px+ref[1]*py+(ref[2]-f.k)*state.optics.thickness/2+state.reference.phase*Math.PI/180;
      values[y*n+x]=o.re**2+o.im**2+state.reference.amplitude**2+2*state.reference.amplitude*(o.re*Math.cos(p)+o.im*Math.sin(p));
    }
    patterns.push(values);raster($(`#decomp-pattern-${c}`),values,n,{scale:2});drawObservation($(`#decomp-image-${c}`),data.cases[c].reconstruction,256,128,imageScale);
  }
  const added=patterns[0].map((v,i)=>v+patterns[1][i]-state.reference.amplitude**2),difference=patterns[3].map((v,i)=>v-added[i]),maximum=difference.reduce((a,b)=>Math.max(a,Math.abs(b)),1e-12);
  raster($('#coherent-joint'),patterns[3],n,{scale:2});raster($('#incoherent-sum'),added,n,{scale:2});raster($('#coherence-difference'),difference,n,{kind:'signed',scale:maximum});
  $('#decomposition-results').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function loadModel(event){
  const files=[...event.target.files],main=files.find(f=>/\.(obj|gltf|glb)$/i.test(f.name));if(!main)return;
  if(files.reduce((s,f)=>s+f.size,0)>100e6){toast('Bitte ein Modellpaket unter 100 MB auswählen.');return;}
  const urls=new Map(files.map(f=>[f.name,URL.createObjectURL(f)]));
  try{
    const THREE=await import('three'),manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('data:')||url.startsWith('blob:'))return url;const name=decodeURIComponent(url.split('/').at(-1));if(urls.has(name))return urls.get(name);throw new Error(`Lokale Zusatzdatei fehlt: ${name}. Alle Modelldateien gemeinsam auswählen.`);});
    let root;
    if(/\.obj$/i.test(main.name)){const {OBJLoader}=await import('three/addons/loaders/OBJLoader.js');root=new OBJLoader(manager).parse(await main.text());}
    else{const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const loader=new GLTFLoader(manager);root=(await loader.parseAsync(/\.glb$/i.test(main.name)?await main.arrayBuffer():await main.text(),'' )).scene;}
    root.updateMatrixWorld(true);const triangles=[],v=new THREE.Vector3();
    root.traverse(mesh=>{if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)throw new Error('Animierte Skelett-Meshes bitte vorher als statisches Mesh exportieren.');const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,len=idx?idx.count:p.count;
      for(let i=0;i+2<len;i+=3){const t={};for(let j=0;j<3;j++){v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);t[['a','b','c'][j]]=[v.x,v.y,v.z];}triangles.push(t);if(triangles.length>120000)throw new Error('Maximal 120.000 Dreiecke; bitte das Modell vereinfachen.');}});
    geometry=normalizeImported(triangles);imported=true;state.groups=['import'];state.yaw=state.pitch=state.x=state.y=0;state.scale=1;delete state.presetPoints;
    $('.group-toggles').hidden=true;$('#object-name').textContent=main.name;$('#import-note').textContent='Lokales statisches Mesh, auf 30 µm skaliert. Materialien/Texturen werden nicht als Streumodell übernommen.';$('#focus-columns').textContent='Nahe Fläche fokussieren';$('#focus-quadriga').textContent='Ferne Fläche fokussieren';$('#decompose').disabled=true;sourceChanged();toast('Lokales Modell geladen. Sichtbare Flächen werden als kohärente Streuelemente diskretisiert.');
  }catch(error){toast(error.message);}
  finally{for(const url of urls.values())URL.revokeObjectURL(url);}
}

controls();$('#model-content').innerHTML=modelDocumentation;
try{scene=new ObjectScene($('#scene'),$('#object-field'),$('#reconstruction'));scene.geometry(transformed(),state.depth);}catch(error){$('#scene').insertAdjacentHTML('beforeend','<p class="small" style="padding:80px 30px">WebGL 2 ist nicht verfügbar. Alle Feld-, Scanner- und Rekonstruktionsrechnungen bleiben in den numerischen Ansichten nutzbar.</p>');console.warn('3D-Ansicht nicht verfügbar:',error.message);}
$('#collapse-controls').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('open');$('#collapse-controls').setAttribute('aria-expanded',String(open));});
all('[data-stage]').forEach(button=>button.addEventListener('click',()=>stage(Number(button.dataset.stage))));
$('#process-position').addEventListener('input',e=>stage(Number(e.target.value)));
$('#expose').addEventListener('click',()=>state.stage>=4?stage(3):run('record'));
$('#expert').addEventListener('click',()=>{state.expert=!state.expert;$('#expert').setAttribute('aria-pressed',String(state.expert));$('#expert-panel').hidden=!state.expert;if(state.expert&&!busy&&!dirty&&draft)run('probe',{point:probePoint});});
for(const id of ['open-docs','footer-docs'])$(`#${id}`).addEventListener('click',()=>$('#model-dialog').showModal());$('#close-docs').addEventListener('click',()=>$('#model-dialog').close());
$('#reset').addEventListener('click',()=>{
  clearTimeout(timer);worker?.terminate();serial++;state=defaults();geometry=gateGeometry();imported=false;draft=saved=result=scan=volume=plane=null;counts=recordedCounts=null;points=[];dirty=true;busy=false;volumeStored=false;
  controls();$('#observer-active').checked=false;$('#observer').value=0;$('#object-slice').value=-50;$('#scanner-span').value=16;$('#scanner-tilt').value=$('#scanner-rotation').value=0;$('#image-gain').value=0;$('#decompose').disabled=false;$('#decomposition-results').hidden=true;$('#expert-panel').hidden=true;$('#expert').setAttribute('aria-pressed','false');all('[data-mask]').forEach(b=>b.classList.toggle('active',b.dataset.mask==='full'));
  $('#metric-efficiency').textContent=$('#metric-fidelity').textContent='—';$('#probe-marker').hidden=true;scene?.geometry(transformed(),130);scene?.resetCamera();sync();run('draft');
  $('#focus-columns').textContent='Säulen fokussieren';$('#focus-quadriga').textContent='Quadriga fokussieren';all('[data-field]').forEach(b=>b.classList.toggle('active',b.dataset.field==='amplitude'));$('#scan-angle').classList.add('active');$('#scan-wavelength').classList.remove('active');
});
all('[data-field]').forEach(button=>button.addEventListener('click',()=>{state.fieldMode=button.dataset.field;all('[data-field]').forEach(b=>b.classList.toggle('active',b===button));drawFieldView();}));
$('#object-slice').addEventListener('input',e=>{state.objectSlice=Number(e.target.value);schedule('field');});
$('#scanner-position').addEventListener('input',e=>{state.slice.position=Number(e.target.value);drawScanner();});
$('#scanner-span').addEventListener('change',e=>{state.slice.span=Number(e.target.value);drawScanner();});
$('#scanner-tilt').addEventListener('input',e=>{state.slice.tilt=Number(e.target.value);drawScanner();});
$('#scanner-rotation').addEventListener('input',e=>{state.slice.rotation=Number(e.target.value);drawScanner();});
$('#scanner-index').addEventListener('click',()=>{state.slice.quantity='index';state.fourier=false;drawScanner();});$('#scanner-intensity').addEventListener('click',()=>{state.slice.quantity='intensity';state.fourier=false;drawScanner();});$('#scanner-fourier').addEventListener('click',()=>{state.fourier=!state.fourier;drawScanner();});
$('#scanner').addEventListener('click',e=>{if(state.fourier){toast('Für eine lokale Raumprobe zuerst zur Indexansicht wechseln.');return;}if(busy||dirty)return;const rect=e.currentTarget.getBoundingClientRect(),u=(e.clientX-rect.left)/rect.width,v=1-(e.clientY-rect.top)/rect.height;probePoint=sliceCoordinates(u,v,state.slice,volume.thickness);if(probePoint[2]<0||probePoint[2]>volume.thickness){toast('Bitte einen Bereich innerhalb des Mediums anklicken.');return;}$('#probe-marker').hidden=false;$('#probe-marker').style.left=`${u*100}%`;$('#probe-marker').style.top=`${(1-v)*100}%`;run('probe',{point:probePoint});});
$('#focus').addEventListener('input',e=>{state.optics.focus=Number(e.target.value);sync();scheduleRead();});
$('#focus-columns').addEventListener('click',()=>{state.optics.focus=saved&&state.stage>=4?recordedFocuses[0]:focusDepths()[0];sync();scheduleRead();});$('#focus-quadriga').addEventListener('click',()=>{state.optics.focus=saved&&state.stage>=4?recordedFocuses[1]:focusDepths()[1];sync();scheduleRead();});
$('#image-gain').addEventListener('input',e=>{state.gain=Number(e.target.value);drawResult();});$('#save-image').addEventListener('click',()=>{if(!result){toast('Zuerst ein Hologramm belichten.');return;}$('#reconstruction').toBlob(blob=>download(blob,'tor-rekonstruktion.png'));});
for(const [id,axis] of [['scan-angle','angle'],['scan-wavelength','wavelength']])$(`#${id}`).addEventListener('click',()=>{state.scanAxis=axis;$('#scan-angle').classList.toggle('active',axis==='angle');$('#scan-wavelength').classList.toggle('active',axis==='wavelength');scheduleRead(true);});
$('#bragg-scan').addEventListener('click',e=>{if(!scan)return;const rect=e.currentTarget.getBoundingClientRect(),t=Math.max(0,Math.min(1,(e.clientX-rect.left-35)/(rect.width-70))),x=scan.points[0].x+t*(scan.points.at(-1).x-scan.points[0].x);state.read[scan.axis==='angle'?'horizontal':'wavelength']=x;sync();scheduleRead();});
all('[data-mask]').forEach(button=>button.addEventListener('click',()=>{state.optics.mask=button.dataset.mask;all('[data-mask]').forEach(b=>b.classList.toggle('active',b===button));scheduleRead();}));
$('#observer-active').addEventListener('change',e=>{state.optics.observerWidth=e.target.checked?20:0;sync();scheduleRead();});$('#observer').addEventListener('input',e=>{state.optics.observer=Number(e.target.value);sync();scheduleRead();});
$('#parallax-demo').addEventListener('click',()=>{state.stage=3;state.presetPoints=[{x:-3,y:0,z:-100,amplitude:12,phase:0},{x:3,y:0,z:-155,amplitude:12,phase:0}];state.optics.focus=125;state.optics.observerWidth=20;state.optics.observer=0;$('#observer-active').checked=true;$('#object-name').textContent='Kontrollversuch: zwei Tiefen';$('#focus-columns').textContent='Vorderen Punkt fokussieren';$('#focus-quadriga').textContent='Hinteren Punkt fokussieren';state.depth=125;sourceChanged();toast('Zwei Punktstreuer bei z = −100 und −155 µm. Belichten, dann Beobachter seitlich verschieben. Reset holt das Tor zurück.');});
$('#decompose').addEventListener('click',()=>run('decompose'));
window.addEventListener('resize',()=>{if(scan&&result)plotScan($('#bragg-scan'),scan,state.read[scan.axis==='angle'?'horizontal':'wavelength']);});
sync();run('draft');
