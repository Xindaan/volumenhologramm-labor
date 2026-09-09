import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { grating, temporalContrast, rad, norm } from './model.mjs';

const shared = `
uniform vec3 kRef, kObj, source, physical;
uniform float sphereMode, ampRef, ampObj, phaseRef, phaseObj, timeContrast, stored, indexScale;
vec3 physicalPoint(vec3 p) { return vec3(p.x/4.0*physical.x,p.y/3.0*physical.y,(p.z/2.4+0.5)*physical.z); }
vec2 signal(vec3 p) {
  vec3 r=physicalPoint(p);
  float po=dot(kObj,r)+phaseObj, ao=ampObj;
  if(sphereMode>0.5) {float distance=length(r-source); po=length(kObj)*distance+phaseObj;ao*=length(source)/distance;}
  float phase=po-dot(kRef,r)-phaseRef;
  float crossTerm=2.0*ampRef*ao*cos(phase);
  return vec2(ampRef*ampRef+ao*ao+crossTerm, crossTerm*timeContrast*0.5);
}
vec3 palette(float v) { return mix(vec3(0.025,0.08,0.105),mix(vec3(0.10,0.44,0.42),vec3(0.78,1.0,0.79),smoothstep(0.25,1.0,v)),sqrt(clamp(v,0.0,1.0))); }
`;
const vertex = `varying vec3 pLocal;void main(){pLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

export class VolumeView {
  constructor(container) {
    this.container=container;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(36,1,.1,100);
    this.camera.position.set(6.3,4.5,6.8);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    this.renderer.setClearColor(0x000000,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','3D-Volumen: mit der Maus drehen, mit dem Mausrad zoomen');
    this.renderer.domElement.setAttribute('tabindex','0');
    this.orbit=new OrbitControls(this.camera,this.renderer.domElement);
    this.orbit.enableDamping=true;this.orbit.dampingFactor=.08;this.orbit.enablePan=false;
    this.orbit.minDistance=7;this.orbit.maxDistance=21;this.orbit.target.set(0,0,0);
    this.renderer.domElement.addEventListener('keydown',e=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();const p=this.camera.position;
        if(e.key==='ArrowLeft'||e.key==='ArrowRight') p.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?-.12:.12);
        else p.y+=e.key==='ArrowUp'?.5:-.5;
      }
    });
    this.uniforms={
      kRef:{value:new THREE.Vector3()},kObj:{value:new THREE.Vector3()},source:{value:new THREE.Vector3()},physical:{value:new THREE.Vector3(6,4.5,40)},
      sphereMode:{value:0},ampRef:{value:1},ampObj:{value:1},phaseRef:{value:0},phaseObj:{value:0},
      timeContrast:{value:1},stored:{value:0},indexScale:{value:1},cameraLocal:{value:this.camera.position},
      cut:{value:0},cutAxis:{value:1},cutPosition:{value:0},
    };
    this.material=new THREE.ShaderMaterial({
      uniforms:this.uniforms,vertexShader:vertex,transparent:true,side:THREE.BackSide,depthWrite:false,
      fragmentShader:shared+`
        varying vec3 pLocal;uniform vec3 cameraLocal;uniform float cut,cutAxis,cutPosition;
        void main(){
          vec3 ro=cameraLocal,rd=normalize(pLocal-ro),b=vec3(2.,1.5,1.2);
          vec3 t0=(-b-ro)/rd,t1=(b-ro)/rd;
          vec3 lo=min(t0,t1),hi=max(t0,t1);
          float start=max(max(lo.x,lo.y),lo.z),finish=min(min(hi.x,hi.y),hi.z);
          start=max(start,0.); if(finish<start) discard;
          float stepSize=(finish-start)/256.;vec4 sum=vec4(0.);
          for(int i=0;i<256;i++) {
            vec3 p=ro+rd*(start+(float(i)+0.5)*stepSize);
            float axisValue=cutAxis<0.5?p.x:(cutAxis<1.5?p.y:p.z);
            if(cut>0.5 && axisValue>cutPosition) continue;
            vec2 field=signal(p);
            float v=stored>0.5?clamp(0.5+field.y*indexScale*0.5,0.,1.):clamp(field.x/4.,0.,1.);
            float density=stored>0.5?pow(abs(field.y)*min(indexScale,1.),3.):pow(v,3.);
            float opacity=1.-exp(-(0.016+density*0.64)*stepSize);
            vec3 color=stored>0.5?mix(vec3(.3,.51,.57),vec3(.61,1.,.76),v):palette(v);
            sum.rgb+=(1.-sum.a)*color*opacity;sum.a+=(1.-sum.a)*opacity;
          }
          gl_FragColor=sum;
        }`});
    this.box=new THREE.Mesh(new THREE.BoxGeometry(4,3,2.4),this.material);this.box.renderOrder=2;this.scene.add(this.box);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(this.box.geometry),new THREE.LineBasicMaterial({color:0x72b7ae,transparent:true,opacity:.42}));
    edges.renderOrder=4;this.scene.add(edges);
    this.sliceMaterial=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,transparent:true,side:THREE.DoubleSide,depthWrite:false,
      fragmentShader:shared+`varying vec3 pLocal;void main(){vec2 field=signal(pLocal);float v=stored>0.5?clamp(.5+.5*field.y*indexScale,0.,1.):clamp(field.x/4.,0.,1.);gl_FragColor=vec4(palette(v),.3);}`});
    this.slice=new THREE.Mesh(new THREE.BufferGeometry(),this.sliceMaterial);this.slice.renderOrder=3;this.scene.add(this.slice);
    this.sliceBorder=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xb0d6a0,transparent:true,opacity:.6}));this.scene.add(this.sliceBorder);
    const grid=new THREE.GridHelper(12,24,0x223d41,0x13282f);grid.position.y=-2.05;grid.material.transparent=true;grid.material.opacity=.26;this.scene.add(grid);
    this.beams=new THREE.Group();this.scene.add(this.beams);this.wavePlanes=[];
    this.fringes=new THREE.Group();this.scene.add(this.fringes);
    this.clock=new THREE.Clock();this.elapsed=0;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    this.renderer.setAnimationLoop(()=>this.frame());
  }
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  resetCamera(){this.camera.position.set(6.3,4.5,6.8);this.orbit.target.set(0,0,0);this.orbit.update();}
  updateFringeSurfaces(config,state){
    // Exact intersections of constant relative phase planes with the displayed box.
    const key=JSON.stringify([config.ref,config.obj,config.n,config.objectMode,state.thickness,state.clip,state.slice,state.sliceAxis,state.stage,state.deltaN,config.exposure,config.dose]);
    if(key===this.fringeKey)return;this.fringeKey=key;
    this.fringes.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.fringes.clear();
    if(config.objectMode!=='plane')return;
    const g=grating(config),K=new THREE.Vector3(g.K[0]*6/4,g.K[1]*4.5/3,g.K[2]*state.thickness/2.4);
    if(K.length()<1e-8)return;
    const contrast=config.ref.amplitude*config.obj.amplitude*(state.stage==='recording'?1:Math.abs(temporalContrast(config))*Math.min(1,state.deltaN/.006075)*config.dose);
    if(contrast<1e-5)return;
    const phase=rad(config.obj.phase-config.ref.phase)+g.K[2]*state.thickness/2+(state.stage!=='recording'&&temporalContrast(config)<0?Math.PI:0);
    const lower=[-2,-1.5,-1.2],upper=[2,1.5,1.2];
    if(state.clip){const a=['x','y','z'].indexOf(state.sliceAxis);upper[a]=state.slice*[2,1.5,1.2][a];}
    const corners=[];for(let i=0;i<8;i++)corners.push(new THREE.Vector3(...lower.map((v,j)=>(i&(1<<j))?upper[j]:v)));
    const values=corners.map(p=>K.dot(p)+phase),min=Math.ceil(Math.min(...values)/(2*Math.PI)),max=Math.floor(Math.max(...values)/(2*Math.PI));
    // Omit subpixel isosurfaces rather than showing a wrong, decimated fringe period.
    if(max-min>100)return;
    const normal=K.clone().normalize(),u=new THREE.Vector3(0,1,0).cross(normal).normalize(),v=normal.clone().cross(u);
    for(let m=min;m<=max;m++){
      const points=[];
      for(let i=0;i<8;i++)for(let j=0;j<3;j++)if(!(i&(1<<j))){
        const a=corners[i],b=corners[i|(1<<j)],fa=K.dot(a)+phase-m*2*Math.PI,fb=K.dot(b)+phase-m*2*Math.PI;
        if((fa<=0&&fb>=0||fa>=0&&fb<=0)&&Math.abs(fa-fb)>1e-10){const p=a.clone().lerp(b,fa/(fa-fb));if(!points.some(q=>q.distanceToSquared(p)<1e-10))points.push(p);}
      }
      if(points.length<3)continue;
      const center=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
      points.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));
      const geometry=new THREE.BufferGeometry().setFromPoints(points),indices=[];for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);geometry.setIndex(indices);
      const sheet=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x80dcb4,transparent:true,opacity:.065*Math.min(contrast,1.5),side:THREE.DoubleSide,depthWrite:false}));this.fringes.add(sheet);
      const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8be6bc,transparent:true,opacity:.27*Math.min(contrast,1.5),depthWrite:false}));this.fringes.add(edge);
    }
  }
  disposeBeams(){this.beams.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});this.beams.clear();this.wavePlanes=[];}
  addBeam(theta,color,start,end,weight=1,phase=0){
    if(weight<.00001)return;
    const direction=new THREE.Vector3(Math.sin(rad(theta)),0,Math.cos(rad(theta)));
    const length=end-start;
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,length,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:Math.max(.03,Math.sqrt(weight)*.85),depthWrite:false,blending:THREE.AdditiveBlending}));
    tube.position.copy(direction).multiplyScalar((end+start)/2);tube.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);this.beams.add(tube);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([direction.clone().multiplyScalar(start),direction.clone().multiplyScalar(end)]),new THREE.LineBasicMaterial({color,transparent:true,opacity:Math.sqrt(weight)}));this.beams.add(line);
    for(let i=0;i<8;i++){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.75,.75),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.07*Math.sqrt(weight),side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);this.beams.add(mesh);
      const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.375,-.375,0),new THREE.Vector3(.375,-.375,0),new THREE.Vector3(.375,.375,0),new THREE.Vector3(-.375,.375,0)]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.3*Math.sqrt(weight),depthWrite:false}));mesh.add(outline);
      this.wavePlanes.push({mesh,direction,start,end,i,phase});
    }
  }
  update(state,result,born){
    this.state=state;this.result=result;
    const config=state.stage==='recording'?state:state.recorded??state;
    this.updateFringeSurfaces(config,state);
    const g=grating(config),u=this.uniforms;
    u.kRef.value.fromArray(g.kr);u.kObj.value.fromArray(g.ko);u.source.value.fromArray(config.point);
    u.physical.value.z=state.thickness;u.sphereMode.value=config.objectMode==='sphere'?1:0;
    u.ampRef.value=config.ref.amplitude;u.ampObj.value=config.obj.amplitude;
    u.phaseRef.value=rad(config.ref.phase);u.phaseObj.value=rad(config.obj.phase);
    u.timeContrast.value=temporalContrast(config);u.stored.value=state.stage==='recording'?0:1;
    u.indexScale.value=state.deltaN/.006075*config.dose;
    const axis=['x','y','z'].indexOf(state.sliceAxis),extent=[2,1.5,1.2][axis],cutPosition=state.slice*extent;
    u.cut.value=state.clip?1:0;u.cutAxis.value=axis;u.cutPosition.value=cutPosition;
    const vertices=axis===1?[[-2,cutPosition,-1.2],[2,cutPosition,-1.2],[2,cutPosition,1.2],[-2,cutPosition,1.2]]:
      axis===2?[[-2,-1.5,cutPosition],[2,-1.5,cutPosition],[2,1.5,cutPosition],[-2,1.5,cutPosition]]:
      [[cutPosition,-1.5,-1.2],[cutPosition,1.5,-1.2],[cutPosition,1.5,1.2],[cutPosition,-1.5,1.2]];
    this.slice.geometry.dispose();this.sliceBorder.geometry.dispose();
    this.slice.geometry=new THREE.BufferGeometry();this.slice.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));this.slice.geometry.setIndex([0,1,2,0,2,3]);this.slice.geometry.computeBoundingSphere();
    this.sliceBorder.geometry=new THREE.BufferGeometry().setFromPoints(vertices.map(v=>new THREE.Vector3(...v)));
    const key=JSON.stringify([state.stage,state.waves,config.ref,config.obj,config.objectMode,state.read,result?.eta,born?.eta]);
    if(key!==this.beamKey){
      this.beamKey=key;this.disposeBeams();
      if(state.waves && state.stage==='recording'){
        this.addBeam(config.ref.theta,0x69cde8,-5.2,-1.5,config.ref.amplitude**2,rad(config.ref.phase));
        if(config.objectMode==='plane')this.addBeam(config.obj.theta,0xefb18a,-5.2,-1.5,config.obj.amplitude**2,rad(config.obj.phase));
        else {
          const source=new THREE.Vector3(Math.max(-3,Math.min(3,config.point[0]/4)),config.point[1]/5,-3.7);
          const marker=new THREE.Mesh(new THREE.SphereGeometry(.045,12,12),new THREE.MeshBasicMaterial({color:0xefb18a}));marker.position.copy(source);this.beams.add(marker);
          for(let r=.4;r<2.4;r+=.35){
            const sphere=new THREE.Mesh(new THREE.SphereGeometry(r,32,16,Math.PI*.75,Math.PI*.5,Math.PI*.25,Math.PI*.5),new THREE.MeshBasicMaterial({color:0xefb18a,wireframe:true,transparent:true,opacity:.10,depthWrite:false}));sphere.position.copy(source);this.beams.add(sphere);
          }
        }
      }else if(state.waves && state.stage==='reconstruction'){
        this.addBeam(state.read.theta,0x69cde8,-5.2,-1.5,1);
        if(config.objectMode==='plane' && result?.valid){
          this.addBeam(state.read.theta,0x7b919e,1.5,5.2,result.transmission);
          if(result.kd)this.addBeam(Math.atan2(result.kd[0],result.kd[2])*180/Math.PI,0x94ebcf,1.5,5.2,result.eta);
        }else if(config.objectMode==='sphere'){
          // Incident undepleted field is the only analytic ray in the Born model.
          this.addBeam(state.read.theta,0x7b919e,1.5,5.2,1);
        }
      }
    }
  }
  frame(){
    const dt=Math.min(this.clock.getDelta(),.06);
    if(this.state?.animate&&!document.hidden)this.elapsed+=dt;
    for(const p of this.wavePlanes){
      const t=((p.i/8+this.elapsed*.12+p.phase/(2*Math.PI)/8)%1+1)%1;
      p.mesh.position.copy(p.direction).multiplyScalar(p.start+t*(p.end-p.start));
    }
    this.orbit.update();
    if(this.state){
      const s=this.state,c=s.stage==='recording'?s:s.recorded??s;
      const place=(id,point,dx,dy)=>{const p=point.project(this.camera),el=document.getElementById(id),w=this.container.clientWidth,h=this.container.clientHeight;el.style.left=`${Math.max(12,Math.min(w-162,(p.x+1)*w/2+dx))}px`;el.style.top=`${Math.max(100,Math.min(h-70,(1-p.y)*h/2+dy))}px`;el.style.right='auto';};
      const theta=s.stage==='reconstruction'?s.read.theta:c.ref.theta;
      place('label-ref',new THREE.Vector3(Math.sin(rad(theta))*-5,0,Math.cos(rad(theta))*-5),10,-25);
      const otheta=this.result?.kd?Math.atan2(this.result.kd[0],this.result.kd[2])*180/Math.PI:c.obj.theta;
      if(s.stage==='reconstruction')place('label-obj',new THREE.Vector3(Math.sin(rad(otheta))*4,0,Math.cos(rad(otheta))*4),8,-20);
      else place('label-obj',c.objectMode==='sphere'?new THREE.Vector3(Math.max(-3,Math.min(3,c.point[0]/4)),c.point[1]/5,-3.7):new THREE.Vector3(Math.sin(rad(otheta))*-5,0,Math.cos(rad(otheta))*-5),-145,-30);
    }
    this.renderer.render(this.scene,this.camera);
  }
}
