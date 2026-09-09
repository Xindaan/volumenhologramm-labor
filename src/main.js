import { defaults, record, grating, diffraction, temporalContrast, optimalDeltaN, setViewMode, rad, norm } from './model.mjs';
import { VolumeView } from './volume.js';
import { drawSlice, drawScan, drawBorn, drawKVectors, fmt } from './charts.js';
import { documentation } from './documentation.js';

const $=selector=>document.querySelector(selector);
let state=defaults(),volume,born=null,bornWorker,bornTimer,bornId=0,bornKey='',toastTimer;
const storageKey='volumenhologramm-labor-recording-v1';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
state.animate=!reducedMotion;
try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  const r=saved?.recorded;
  const waveValid=w=>w&&['theta','wavelength','phase','amplitude'].every(k=>Number.isFinite(w[k]))&&Math.abs(w.theta)<=45&&w.wavelength>=400&&w.wavelength<=700&&w.amplitude>=0&&w.amplitude<=2;
  if(saved?.version===1&&['plane','sphere'].includes(r?.objectMode)&&r.n>=1.2&&r.n<=1.8&&waveValid(r.ref)&&waveValid(r.obj)&&r.point?.length===3&&r.point.every(Number.isFinite)&&r.point[2]<0&&r.dose>=0&&r.dose<=2&&r.exposure>0&&Number.isFinite(r.exposure)&&saved.thickness>=4&&saved.thickness<=120&&saved.deltaN>=0&&saved.deltaN<=.02){
    state.recorded=r;state.thickness=saved.thickness;state.deltaN=saved.deltaN;
    Object.assign(state,{n:r.n,ref:{...r.ref},obj:{...r.obj},point:[...r.point],exposure:r.exposure,dose:r.dose,objectMode:r.objectMode});
    state.read={theta:r.ref.theta,wavelength:r.ref.wavelength};state.stage='stored';
  }
}catch{/* An unavailable or corrupt browser store never blocks the experiment. */}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function persist(){if(!state.recorded)return;try{localStorage.setItem(storageKey,JSON.stringify({version:1,recorded:state.recorded,thickness:state.thickness,deltaN:state.deltaN}));}catch{toast('Aufzeichnung in dieser Sitzung gespeichert. Browserablage ist nicht verfügbar.');}}
function recording(){state.recorded=record(state);state.read={theta:state.ref.theta,wavelength:state.ref.wavelength};state.stage='stored';persist();renderControls();update();toast('Räumliche Indexstruktur aufgezeichnet. Bereit für die Rekonstruktion.');}
function goStage(stage){if(stage!=='recording'&&!state.recorded){state.recorded=record(state);state.read={theta:state.ref.theta,wavelength:state.ref.wavelength};persist();}state.stage=stage;renderControls();update();}

const get=path=>path.split('.').reduce((o,k)=>o[k],state);
function set(path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],state)[last]=value;}
let controls=[];
function slider(path,label,min,max,step,unit='',digits=1,extra=''){
  const id=`control-${path.replaceAll('.','-')}`;controls.push({path,id,unit,digits,min,max});
  return `<div class="control ${extra}"><div class="control-heading"><label for="${id}">${label}</label><span class="number-wrap"><input class="number-input" id="${id}-number" type="text" inputmode="decimal" aria-label="${label} Zahlenwert" value="${fmt(get(path),digits)}"/><span>${unit}</span></span></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${get(path)}" /><div class="control-endpoints"><span>${fmt(min,path==="deltaN"?5:Math.min(digits,2))} ${unit}</span><span>${fmt(max,path==="deltaN"?5:Math.min(digits,2))} ${unit}</span></div></div>`;
}
function updateControlValues(){
  for(const c of controls){const input=$(`#${c.id}`);if(!input)continue;const value=get(c.path);input.value=value;input.style.setProperty('--progress',`${(value-c.min)/(c.max-c.min)*100}%`);const numeric=$(`#${c.id}-number`);if(document.activeElement!==numeric)numeric.value=fmt(value,c.digits);}
  $('#slice-position').style.setProperty('--progress',`${(state.slice+1)*50}%`);
}
function renderControls(){
  controls=[];const isRecording=state.stage==='recording',sphere=(isRecording?state:state.recorded??state).objectMode==='sphere';
  $('#setup-state').textContent=isRecording?'LIVE':state.stage==='stored'?'GESPEICHERT':'REPLAY';
  let html='';
  if(isRecording){
    html+=`<section class="control-section"><h3>Objektwelle</h3><div class="segmented"><button id="object-plane" class="${!sphere?'active':''}" aria-pressed="${!sphere}">Ebene Welle</button><button id="object-sphere" class="${sphere?'active':''}" aria-pressed="${sphere}">Kugelwelle</button></div><p class="control-note">${sphere?'Ein virtueller Punkt erzeugt gekrümmte Wellenfronten im Raum.':'Zwei ebene Wellen schreiben parallele Fringenflächen ins Volumen.'}</p></section>`;
    html+=`<section class="control-section"><h3><i class="legend-dot cyan"></i> Referenzwelle</h3>${slider('ref.theta','Richtung θᵣ',-40,40,.1,'°',1)}${slider('ref.wavelength','Wellenlänge λ₀ᵣ',400,700,1,'nm',0)}<label class="check-row"><input type="checkbox" id="lock-wavelength" ${state.locked?'checked':''}> Gemeinsame Wellenlänge</label></section>`;
    html+=`<section class="control-section"><h3><i class="legend-dot orange"></i> ${sphere?'Virtueller Objektpunkt':'Objektwelle'}</h3>${sphere?slider('point.0','Punkt x₀',-15,15,.1,'µm',1,'orange')+slider('point.1','Punkt y₀',-10,10,.1,'µm',1,'orange')+slider('point.2','Punkt z₀',-60,-8,.1,'µm',1,'orange'):slider('obj.theta','Richtung θₒ',-40,40,.1,'°',1,'orange')}${!state.locked?slider('obj.wavelength','Wellenlänge λ₀ₒ',400,700,1,'nm',0,'orange'):''}<div class="status-line" id="geometry-note"></div></section>`;
    html+=`<details class="disclosure"><summary>Phase, Amplitude & Belichtung</summary><div>${slider('ref.phase','Phase φᵣ',0,360,1,'°',0)}${slider('obj.phase','Phase φₒ',0,360,1,'°',0,'orange')}${slider('ref.amplitude','Amplitude Aᵣ',0,2,.05,'',2)}${slider('obj.amplitude','Amplitude Aₒ',0,2,.05,'',2,'orange')}${slider('dose','Relative Dosis D',0,2,.05,'',2)}<div class="control"><label for="exposure">Belichtungszeit T <output id="exposure-value"></output></label><input id="exposure" type="range" min="2" max="7" step=".1" value="${Math.log10(state.exposure)}"/><small>100 fs bis 10 ns · logarithmische Skala. T steuert die Mittelung, D die relative Dosis.</small></div></div></details>`;
  }else if(state.stage==='reconstruction'){
    html+=`<section class="control-section"><h3><i class="legend-dot cyan"></i> Rekonstruktionswelle</h3>${slider('read.theta','Interner Winkel θ',-43,43,.01,'°',2)}${slider('read.wavelength','Wellenlänge λ₀',400,700,.1,'nm',1)}<button id="match" class="secondary-button">↶ Aufzeichnungsgeometrie treffen</button><p class="status-line">Objektwelle aus. Nur die gespeicherte Struktur koppelt Licht in die Objektordnung.</p></section>`;
  }else{
    const r=state.recorded;
    html+=`<section class="control-section"><h3><i class="legend-dot"></i> Analytischer Snapshot</h3><p class="control-note"><strong>${r.objectMode==='plane'?'Ebenes Transmissionsgitter':'Gekrümmtes Volumenmuster'}</strong><br>Referenz: ${fmt(r.ref.theta,1)}° · ${fmt(r.ref.wavelength,0)} nm<br>n = ${fmt(r.n,2)} · D = ${fmt(r.dose,2)}<br><br>Die räumliche Phasenbeziehung ist jetzt als δn(r) gespeichert.</p><button id="export" class="secondary-button">↓ Aufzeichnung als JSON</button><p class="status-line">Lokal im Browser gespeichert. Änderungen an den Aufzeichnungswellen verändern diesen Snapshot nicht.</p></section>`;
  }
  html+=`<section class="control-section"><h3>Aufzeichnungsmedium</h3>${slider('thickness','Dicke d',4,120,1,'µm',0)}${isRecording?slider('n','Brechungsindex n',1.2,1.8,.01,'',2):`<p class="status-line">Gespeicherter Brechungsindex: n = ${fmt(state.recorded.n,2)}</p>`}${slider('deltaN','Modulationsfaktor Δn',0,sphere?.002:.02,.00001,'',5)}${!sphere?'<button class="secondary-button" id="optimal">ν = π/2 einstellen</button>':'<p class="status-line">Born-Modell: kleine Modulation verwenden. Keine berechnete transmittierte Restleistung.</p>'}<div id="validity-note"></div></section>`;
  $('#control-content').innerHTML=html;
  for(const c of controls)$(`#${c.id}`).addEventListener('input',e=>{
    set(c.path,Number(e.target.value));
    if(c.path==='ref.wavelength'&&state.locked)state.obj.wavelength=state.ref.wavelength;
    if(c.path==='thickness'||c.path==='deltaN')persist();update();
  });
  for(const c of controls){const input=$(`#${c.id}-number`);const applyNumber=(final=false)=>{
    const text=input.value.trim();const value=Number(text.replace(',','.'));
    if(!text||!Number.isFinite(value)||value<c.min||value>c.max){if(final){input.value=fmt(get(c.path),c.digits);toast(`Zulässiger Bereich: ${fmt(c.min,2)} bis ${fmt(c.max,2)} ${c.unit}`);}return;}
    if(value===get(c.path))return;
    set(c.path,value);if(c.path==='ref.wavelength'&&state.locked)state.obj.wavelength=value;
    if(c.path==='thickness'||c.path==='deltaN')persist();update();
  };input.addEventListener('input',()=>applyNumber());input.addEventListener('blur',()=>applyNumber(true));input.addEventListener('keydown',e=>{if(e.key==='Enter'){applyNumber(true);input.blur();}});}
  $('#object-plane')?.addEventListener('click',()=>{state.objectMode='plane';state.deltaN=optimalDeltaN(state,state.thickness)??.006;renderControls();update();});
  $('#object-sphere')?.addEventListener('click',()=>{state.objectMode='sphere';state.deltaN=.0003;renderControls();update();toast('Kugelwelle: schwache Modulation Δn = 0,00030 für das Born-Modell.');});
  $('#lock-wavelength')?.addEventListener('change',e=>{state.locked=e.target.checked;if(state.locked)state.obj.wavelength=state.ref.wavelength;renderControls();update();});
  $('#exposure')?.addEventListener('input',e=>{state.exposure=10**Number(e.target.value);update();});
  $('#match')?.addEventListener('click',()=>{state.read={theta:state.recorded.ref.theta,wavelength:state.recorded.ref.wavelength};update();});
  $('#optimal')?.addEventListener('click',()=>{const c=state.stage==='recording'?state:state.recorded;const value=optimalDeltaN(c,state.thickness);if(value!==null&&value<=.02){state.deltaN=value;persist();update();toast('Kopplung für die Aufzeichnungsgeometrie auf ν = π/2 gesetzt.');}else toast('ν = π/2 ist mit dieser Belichtung im Reglerbereich nicht erreichbar.');});
  $('#export')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,recorded:state.recorded,thickness:state.thickness,deltaN:state.deltaN,units:'µm; nm for vacuum wavelengths; fs; degrees for UI angles'},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='volumenhologramm-aufzeichnung.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#record').innerHTML=state.stage==='recording'?'<span>◉</span> Struktur aufzeichnen <span>→</span>':state.stage==='stored'?'<span>↗</span> Hologramm lesen <span>→</span>':'<span>↶</span> Zur Aufzeichnung <span>→</span>';
  $('#record-note').textContent=state.stage==='recording'?'Speichert die analytische 3D-Struktur als unabhängigen Zustand.':state.stage==='stored'?'Die Objektwelle wird abgeschaltet. Die Referenzgeometrie ist voreingestellt.':'Der gespeicherte Zustand bleibt erhalten, bis du neu aufzeichnest.';
}

function computeBornIfNeeded(config){
  if(state.stage!=='reconstruction'||config.objectMode!=='sphere'){
    clearTimeout(bornTimer);bornWorker?.terminate();bornWorker=null;born=null;bornKey='';return;
  }
  const key=JSON.stringify([config,state.read,state.thickness,state.deltaN]);
  if(key===bornKey)return;
  bornKey=key;born=null;clearTimeout(bornTimer);bornWorker?.terminate();bornWorker=null;
  const request={id:++bornId,recorded:structuredClone(config),read:{...state.read},thickness:state.thickness,deltaN:state.deltaN};
  bornTimer=setTimeout(()=>{
    bornWorker=new Worker(new URL('./born-worker.js',import.meta.url),{type:'module'});
    bornWorker.onmessage=({data})=>{
      if(data.id!==bornId)return;
      born=data.error?{error:data.error}:data;bornWorker?.terminate();bornWorker=null;update();
    };
    bornWorker.onerror=()=>{born={error:'Numerische Rekonstruktion konnte nicht ausgeführt werden.'};bornWorker?.terminate();bornWorker=null;update();};
    bornWorker.postMessage(request);
  },200);
}

function update(){
  const config=state.stage==='recording'?state:state.recorded??state,r=state.stage==='recording'?record(state):state.recorded??record(state);
  const read=state.stage==='recording'?{theta:config.ref.theta,wavelength:config.ref.wavelength}:state.read;
  const result=diffraction(r,read,state.thickness,state.deltaN),g=grating(config),sphere=config.objectMode==='sphere';
  computeBornIfNeeded(config);updateControlValues();
  $('#exposure-value')&&($('#exposure-value').textContent=state.exposure>=1e6?`${fmt(state.exposure/1e6,2)} ns`:state.exposure>=1000?`${fmt(state.exposure/1000,2)} ps`:`${fmt(state.exposure,1)} fs`);
  if($('#geometry-note'))$('#geometry-note').textContent=sphere?`Lokale Objektrichtung am Ursprung: ${fmt(Math.atan2(-state.point[0],-state.point[2])*180/Math.PI,1)}° (xz-Projektion).`:`Winkel zwischen den Wellen: ${fmt(Math.abs(state.obj.theta-state.ref.theta),1)}°`;
  const contrast=temporalContrast(config);
  let warning='';
  if(state.stage==='recording'&&config.ref.wavelength!==config.obj.wavelength)warning=`Verschiedene Frequenzen: Livebild bei t = 0. Die Belichtung erhält ${fmt(Math.abs(contrast)*100,3)} % des Kreuzterms.`;
  else if(!sphere&&!result.valid)warning=result.reason;
  else if(sphere&&born?.reason)warning=born.reason;
  else if(sphere&&born?.error)warning=born.error;
  $('#validity-note').innerHTML=warning?`<p class="notice">${warning}</p>`:'';
  ['recording','stored','reconstruction'].forEach(stage=>{const b=$(`#stage-${stage}`);b.classList.toggle('active',state.stage===stage);b.setAttribute('aria-pressed',state.stage===stage);});
  ['intuitive','physicist'].forEach(mode=>{const b=$(`#${mode}`);b.classList.toggle('active',state.mode===mode);b.setAttribute('aria-pressed',state.mode===mode);});
  $('#expert-panel').hidden=state.mode!=='physicist';
  $('#toggle-waves').setAttribute('aria-pressed',state.waves);$('#toggle-clip').setAttribute('aria-pressed',state.clip);
  $('#pause').textContent=state.animate?'Ⅱ':'▷';$('#pause').setAttribute('aria-label',state.animate?'Animation pausieren':'Animation fortsetzen');
  const stageData={recording:['01 / AUFZEICHNUNG','Wo sich Licht begegnet','Intensität im Volumen · t = 0'],stored:['02 / GESPEICHERTES VOLUMEN','Eine Erinnerung an Licht','Gespeicherte Indexmodulation δn(r)'],reconstruction:['03 / REKONSTRUKTION','Die richtige Welle findet den Weg','Gespeichertes Gitter · Objektwelle aus']}[state.stage];
  $('#volume-kicker').textContent=stageData[0];$('#volume-title').textContent=stageData[1];$('#volume-caption').textContent=stageData[2];
  $('#label-ref').innerHTML=state.stage==='reconstruction'?`REKONSTRUKTIONSWELLE<span>${fmt(read.theta,2)}° · ${fmt(read.wavelength,1)} nm</span>`:`REFERENZWELLE<span>${fmt(config.ref.theta,1)}° · ${fmt(config.ref.wavelength,0)} nm</span>`;
  $('#label-obj').innerHTML=state.stage==='reconstruction'?(sphere?'BORN-AUSTRITTSFELD<span>Phase und Betrag im Fenster unten</span>':`REKONSTRUIERTE WELLE<span>${result.valid?fmt(result.eta*100,1)+' % gebeugt':'Modellgrenze'}</span>`):`OBJEKTWELLE<span>${sphere?'Kugelwelle aus virtuellem Punkt':fmt(config.obj.theta,1)+'° · '+fmt(config.obj.wavelength,0)+' nm'}</span>`;
  $('#label-obj').style.color=state.stage==='reconstruction'?'var(--mint)':'var(--orange)';$('#label-obj').style.borderColor=state.stage==='reconstruction'?'var(--mint)':'var(--orange)';
  $('#label-ref').hidden=!state.waves||state.stage==='stored';$('#label-obj').hidden=!state.waves||state.stage==='stored';
  function metric(label,value,unit='',featured=false){return `<div class="metric${featured?' featured':''}"><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`;}
  if(state.stage==='reconstruction'){
    const efficiency=sphere?born?.valid?born.eta:null:result.valid?result.eta:null;
    $('#metrics').innerHTML=metric(sphere?'Beugung · Born':'Beugungseffizienz',efficiency!==null?fmt(efficiency*100,sphere?3:1):sphere&&!born?'…':'—','%',true)+metric(sphere?'Transmission':'Transmittiert',!sphere&&result.valid?fmt(result.transmission*100,1):'—',sphere?'nicht berechnet':'%')+metric('Winkelabweichung',fmt(read.theta-config.ref.theta,2),'°')+metric('Wellenlängenabweichung',fmt(read.wavelength-config.ref.wavelength,1),'nm');
  }else{
    $('#metrics').innerHTML=metric(sphere?'Lokale Periode Λ(0)':'Fringenabstand Λ',Number.isFinite(g.period)?fmt(g.period,3):'∞','µm',true)+metric('Gitterdicke',fmt(state.thickness,0),'µm')+metric('Indexmodulationsfaktor',fmt(state.deltaN,5))+metric('Gespeicherter Kreuzterm',fmt(Math.abs(contrast)*100,1),'%');
  }
  volume?.update(state,result,born);
  drawSlice($('#slice-canvas'),state);
  $('#scan-chart').toggleAttribute('hidden',sphere);$('.scan-control').hidden=sphere;$('#born-canvas').hidden=!sphere||!born?.real;
  $('#compare-label').hidden=sphere;$('#scan-width').hidden=sphere;
  if(sphere){
    $('#scan-kicker').textContent='KUGELWELLE / VORWÄRTS-BORN';$('#scan-title').textContent='Die rekonstruierte Wellenfront';
    $('#scan-current').textContent=born?.real?`Austrittsfeld · ${born.n}² × ${born.nz} Schichten`:state.stage==='reconstruction'?'Volumenintegral wird berechnet …':'Zum Rekonstruieren aufzeichnen & lesen';
    $('#scan-note').textContent=born?.real?`Phase: zyklische Farbe · Betrag: Helligkeit · Fenster ${born.size} × ${born.size} µm. ${born.valid?'Ungeschwächte Beleuchtung; keine Transmission berechnet.':born.reason}`:'Die gekrümmte Struktur wird numerisch rekonstruiert. Ein ebener Kogelnik-Scan ist hier nicht definiert.';
    if(born?.real)drawBorn($('#born-canvas'),born);
  }else{
    $('#scan-kicker').textContent='BRAGG-SELEKTIVITÄT';$('#scan-title').textContent='Ein schmales Fenster für Licht';
    drawScan($('#scan-chart'),state);
    $('#scan-note').textContent=!result.valid?result.reason:state.stage==='recording'?'Vorschau der aktuellen Struktur. Zum Lesen zuerst aufzeichnen.':state.stage==='stored'?'Rekonstruktionsvorschau für den gespeicherten Zustand.':`Klicke in die Kurve oder verstimme die Beleuchtung. ${state.compare?'Vergleich: Δn × 4 hält ν konstant.':''}`;
  }
  ['angle','wavelength'].forEach(axis=>{const b=$(`#scan-${axis}`);b.classList.toggle('active',state.scan===axis);b.setAttribute('aria-pressed',state.scan===axis);});
  const insight=state.stage==='recording'?['01','Das Hologramm speichert eine Beziehung.','Hell und dunkel entstehen aus der Phasendifferenz beider Wellen. Die Fringen sind Flächen im ganzen Volumen – keine aufgedruckten Linien.','Weiter: aufzeichnen']:state.stage==='stored'?['02','Die Wellen sind weg. Die Struktur bleibt.','Eine idealisierte lineare Belichtung übersetzt die Interferenz in eine Indexmodulation. Sie enthält die räumliche Phasenbeziehung zur Referenz.','Weiter: lesen']:sphere?['03','Eine Punktwelle entsteht aus vielen Tiefen.','Die Born-Rechnung summiert komplexe Beiträge aus dem Volumen. Das Austrittsfeld zeigt Phase und Betrag; die Näherung enthält keine Rückwirkung auf die Beleuchtung.','Neue Aufzeichnung']:['03','Viele Schichten müssen im Takt beitragen.',`Bei passender Beleuchtung addieren sich die gebeugten Beiträge kohärent. Winkel- oder Farbabweichungen bauen einen Phasenfehler über die Dicke auf. ${result.nu>Math.PI/2+.1?'Bei starker Kopplung sind Rückkopplung und Nebenmaxima möglich.':'Teste eine kleine Abweichung von 0,5°.'}`,'Neue Aufzeichnung'];
  $('#insight-number').textContent=insight[0];$('#insight-title').textContent=insight[1];$('#insight-copy').textContent=insight[2];$('#next-step').innerHTML=insight[3]+' <span>→</span>';
  if(state.mode==='physicist'){
    drawKVectors($('#k-diagram'),state,result);
    $('#expert-data').innerHTML=sphere?`<div class="math">E_d = G_forward ∗ [δn₊ E_i]<br>K(r) = ∇Φₒ(r) − kᵣ</div><p>Keine globale Gitterperiode bei der Kugelwelle. Das Diagramm zeigt K am Ursprung, nicht einen globalen Bragg-Vektor.</p><dl><dt>Numerisches Feld</dt><dd>${born?.real?`${born.n} × ${born.n} × ${born.nz}`:'noch nicht berechnet'}</dd><dt>Born-η (diagnostisch)</dt><dd>${born?.real?fmt(born.eta*100,4)+' %':'—'}</dd><dt>Unterdrücktes Quellspektrum</dt><dd>${born?.real?fmt(born.discardedFraction*100,3)+' %':'—'}</dd></dl><p>Nur objekttragende +Ordnung; ungebeugte Beleuchtung ohne Depletion. Details und Schranken unter „Modell & Grenzen“.</p>`:
      `<div class="math">K = kₒ − kᵣ &nbsp; · &nbsp; |k_d| = |k_i|<br>Δ = k_i,z + K_z − k_d,z<br>η = ν² sinc²(√(ν² + ξ²))</div><dl><dt>kᵣ / µm⁻¹</dt><dd>(${g.kr.map(x=>fmt(x,3)).join('; ')})</dd><dt>kₒ / µm⁻¹</dt><dd>(${g.ko.map(x=>fmt(x,3)).join('; ')})</dd><dt>K / µm⁻¹</dt><dd>(${g.K.map(x=>fmt(x,3)).join('; ')})</dd><dt>Δ / µm⁻¹</dt><dd>${fmt(result.delta,6)}</dd><dt>Kopplung ν · Fehlanpassung ξ</dt><dd>${fmt(result.nu,4)} · ${fmt(result.xi,4)}</dd><dt>Q · ρ</dt><dd>${fmt(result.Q,1)} · ${Number.isFinite(result.rho)?fmt(result.rho,1):'∞'}</dd><dt>Δn_eff</dt><dd>${fmt(result.effectiveN,6)}</dd></dl><p>${result.valid?'Verlustfreies, fluxnormiertes Zweiwellenmodell. SVEA; feste s-Polarisation; interne Winkel; keine Fresnel-Grenzflächen.':result.reason} <a href="#" id="expert-method">Herleitung & Gültigkeit ↗</a></p>`;
    $('#expert-method')?.addEventListener('click',e=>{e.preventDefault();$('#model-dialog').showModal();});
  }
}

$('#model-documentation').innerHTML=documentation;
for(const id of ['method','footer-method'])$(`#${id}`).addEventListener('click',()=>$('#model-dialog').showModal());
$('#close-dialog').addEventListener('click',()=>$('#model-dialog').close());
$('#model-dialog').addEventListener('click',e=>{if(e.target===$('#model-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
for(const mode of ['intuitive','physicist'])$(`#${mode}`).addEventListener('click',()=>{state=setViewMode(state,mode);update();});
for(const stage of ['recording','stored','reconstruction'])$(`#stage-${stage}`).addEventListener('click',()=>goStage(stage));
$('#record').addEventListener('click',()=>{if(state.stage==='recording')recording();else goStage(state.stage==='stored'?'reconstruction':'recording');});
$('#next-step').addEventListener('click',()=>{if(state.stage==='recording')recording();else goStage(state.stage==='stored'?'reconstruction':'recording');});
$('#toggle-waves').addEventListener('click',()=>{state.waves=!state.waves;update();});
$('#toggle-clip').addEventListener('click',()=>{state.clip=!state.clip;update();});
$('#pause').addEventListener('click',()=>{state.animate=!state.animate;update();});
$('#camera-reset').addEventListener('click',()=>volume?.resetCamera());
$('#mobile-controls').addEventListener('click',()=>{const expanded=$('.controls').classList.toggle('expanded');$('#mobile-controls').setAttribute('aria-expanded',expanded);$('#mobile-controls').textContent=expanded?'Parameter schließen −':'Parameter öffnen +';});
$('#slice-position').addEventListener('input',e=>{state.slice=Number(e.target.value);update();});
$('#slice-axis').addEventListener('change',e=>{state.sliceAxis=e.target.value;state.slice=0;$('#slice-position').value=0;update();});
for(const axis of ['angle','wavelength'])$(`#scan-${axis}`).addEventListener('click',()=>{state.scan=axis;update();});
$('#compare').addEventListener('change',e=>{state.compare=e.target.checked;update();});
$('#scan-chart').addEventListener('scan-pick',e=>{const {axis,value}=e.detail;state.read[axis==='angle'?'theta':'wavelength']=value;update();});
$('#reset').addEventListener('click',()=>{state=defaults();state.animate=!reducedMotion;try{localStorage.removeItem(storageKey);}catch{}born=null;bornKey='';$('#slice-position').value=0;$('#slice-axis').value='y';$('#compare').checked=true;volume?.resetCamera();renderControls();update();toast('Ausgangsexperiment wiederhergestellt.');});
try{volume=new VolumeView($('#volume-view'));}catch(error){$('.webgl-fallback').hidden=false;console.error('WebGL-Ansicht nicht verfügbar:',error);}
renderControls();update();
