import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { vector } from './waves.mjs';

const fragment=`precision highp float; precision highp sampler3D;
uniform sampler3D volume; uniform vec3 eye; uniform vec3 kr; uniform float carrier; uniform float depth; uniform float size;
uniform float phase; uniform float amplitude; uniform float beta; uniform float gain; uniform int mode; uniform vec3 cutCenter; uniform vec3 cutNormal; uniform float cutOn;
in vec3 positionLocal; out vec4 fragColor;
void main(){
 vec3 rd=normalize(positionLocal-eye),inv=1.0/rd;vec3 ta=(-vec3(.5)-eye)*inv,tb=(vec3(.5)-eye)*inv;
 vec3 lo=min(ta,tb),hi=max(ta,tb);float a=max(max(lo.x,lo.y),lo.z),b=min(min(hi.x,hi.y),hi.z);a=max(a,0.0);if(b<=a)discard;
 vec4 col=vec4(0.0);float stepSize=(b-a)/64.0;
 for(int j=0;j<64;j++){
  vec3 p=eye+rd*(a+(float(j)+.5)*stepSize),uv=p+.5;vec3 r=vec3(p.xy*size,uv.z*depth);if(cutOn>.5&&dot(cutNormal,r-cutCenter)>0.0)continue;
  vec2 E=texture(volume,uv).rg;float ph=dot(kr,r)-carrier*r.z+phase;
  float cross=2.0*(E.x*cos(ph)+E.y*sin(ph));float val=mode==2?cross:mode==1?(dot(E,E)+amplitude*amplitude+amplitude*cross):length(E);
  float signedValue=mode==2?val*gain:mode==1?(val-amplitude*amplitude)*1.2:val*2.0;
  float density=clamp(abs(signedValue),0.0,1.0);density=pow(density,1.2)*.045;
  vec3 hue=mix(vec3(.22,.73,1.0),vec3(1.0,.68,.33),step(0.0,signedValue));
  col.rgb+=(1.0-col.a)*density*hue;col.a+=(1.0-col.a)*density;
 }fragColor=col;
}`;
export class ObjectScene {
  constructor(container,fieldCanvas,imageCanvas){
    this.container=container;this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(34,1,.1,400);this.camera.position.set(5,12,74);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.setClearColor(0x080f17,0);
    container.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Räumliche Szene: Objekt, Objektfeld, Hologramm und numerische Rekonstruktion');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.minDistance=55;this.controls.maxDistance=155;this.controls.maxPolarAngle=Math.PI*.8;
    this.scene.add(new THREE.AmbientLight(0xabc7da,1.6));const light=new THREE.DirectionalLight(0xffd6a8,4);light.position.set(-20,30,45);this.scene.add(light);
    this.object=new THREE.Group();this.scene.add(this.object);
    this.fieldCanvas=fieldCanvas;this.imageCanvas=imageCanvas;
    this.fieldTexture=new THREE.DataTexture(new Uint8Array(4),1,1);this.imageTexture=new THREE.DataTexture(new Uint8Array(4),1,1);
    this.fieldPlane=new THREE.Mesh(new THREE.PlaneGeometry(19,22),new THREE.MeshBasicMaterial({map:this.fieldTexture,side:THREE.DoubleSide,transparent:true,opacity:.85}));this.fieldPlane.position.set(-13,0,-3);this.fieldPlane.rotation.y=-.23;this.scene.add(this.fieldPlane);
    this.imagePlane=new THREE.Mesh(new THREE.PlaneGeometry(23,23),new THREE.MeshBasicMaterial({map:this.imageTexture,side:THREE.DoubleSide}));this.imagePlane.position.set(36,0,1);this.imagePlane.rotation.y=-.12;this.scene.add(this.imagePlane);
    const cube=new THREE.BoxGeometry(1,1,1),uniforms={volume:{value:null},eye:{value:new THREE.Vector3()},kr:{value:new THREE.Vector3()},carrier:{value:1},depth:{value:40},size:{value:64},phase:{value:0},amplitude:{value:1},beta:{value:.0003},gain:{value:1800},mode:{value:1},cutCenter:{value:new THREE.Vector3(0,0,20)},cutNormal:{value:new THREE.Vector3(0,0,1)},cutOn:{value:0}};
    this.volumeMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms,vertexShader:'out vec3 positionLocal; void main(){positionLocal=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:fragment,side:THREE.BackSide,transparent:true,depthWrite:false});
    this.block=new THREE.Mesh(cube,this.volumeMaterial);this.block.position.set(11,0,0);this.block.scale.set(19,23,10);this.scene.add(this.block);
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(cube),new THREE.LineBasicMaterial({color:0x4fabb8,transparent:true,opacity:.65}));outline.scale.copy(this.block.scale);outline.position.copy(this.block.position);this.scene.add(outline);this.outline=outline;
    this.slice=new THREE.Mesh(new THREE.PlaneGeometry(19,23),new THREE.MeshBasicMaterial({color:0x89ffec,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false}));this.scene.add(this.slice);
    this.reference=new THREE.Group();for(let i=0;i<4;i++){const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8,-7,0),new THREE.Vector3(8,-7,0),new THREE.Vector3(8,7,0),new THREE.Vector3(-8,7,0)]),new THREE.LineBasicMaterial({color:0x5be0dd,transparent:true,opacity:.12+.05*i}));ring.position.set(6,-2,-18+i*4);ring.rotation.y=.2;this.reference.add(ring);}this.scene.add(this.reference);
    this.state={stage:3};this.needsRender=true;this.resize=new ResizeObserver(()=>this.fit());this.resize.observe(container);this.fit();this.frame=()=>{const changed=this.controls.update();if(this.needsRender||changed){this.block.updateMatrixWorld();this.volumeMaterial.uniforms.eye.value.copy(this.camera.position);this.block.worldToLocal(this.volumeMaterial.uniforms.eye.value);this.renderer.render(this.scene,this.camera);this.needsRender=false;}this.raf=requestAnimationFrame(this.frame);};this.frame();
  }
  fit(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.zoom=Math.min(1.25,this.camera.aspect/2.45);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.needsRender=true;}
  geometry(triangles,depth=130,points=[]){
    for(const child of [...this.object.children]){child.geometry?.dispose();child.material?.dispose();this.object.remove(child);}
    const positions=[];for(const t of triangles)for(const p of [t.a,t.b,t.c])positions.push(p[0]*.82,p[1]*.82,(p[2]+depth)*.82);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xe8c794,metalness:.28,roughness:.44,emissive:0x4c2b12,emissiveIntensity:.27,side:THREE.DoubleSide}));this.object.add(mesh);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),new THREE.LineBasicMaterial({color:0xffe0a1,transparent:true,opacity:.28}));this.object.add(edges);
    if(points.length){const p=points.flatMap(p=>[p.x*.82,p.y*.82,(p.z+depth)*.82]);const dots=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3)),new THREE.PointsMaterial({color:0xffdf9c,size:points.length<10?.7:.1,transparent:true,opacity:.65}));this.object.add(dots);}
    this.object.position.set(-35,0,0);this.needsRender=true;
  }
  setVolume(v,config,stored=false){
    this.texture?.dispose();const data=new Float32Array(v.re.length*4);for(let i=0;i<v.re.length;i++){data[4*i]=v.re[i];data[4*i+1]=v.im[i];data[4*i+3]=1;}
    const texture=new THREE.Data3DTexture(data,v.n,v.n,v.nz);texture.format=THREE.RGBAFormat;texture.type=THREE.FloatType;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;this.texture=texture;
    const u=this.volumeMaterial.uniforms;u.volume.value=texture;u.depth.value=v.thickness;u.size.value=v.size;u.carrier.value=v.k;this.stored=stored;this.update(config);
  }
  update(config){
    this.state=config;const stage=config.stage,u=this.volumeMaterial.uniforms,record=config.recordMeta;
    const ref=this.stored&&record?record.reference:config.reference,wavelength=this.stored&&record?record.wavelength:config.wavelength,index=this.stored&&record?record.index:config.index;
    u.kr.value.set(...vector(wavelength,index,ref.horizontal,ref.vertical));u.phase.value=this.stored?0:ref.phase*Math.PI/180;u.amplitude.value=ref.amplitude;u.mode.value=this.stored?2:stage<2?0:1;u.cutCenter.value.set(config.slice.centerX,config.slice.centerY,config.slice.position*u.depth.value);u.cutNormal.value.set(Math.sin(config.slice.tilt*Math.PI/180),0,Math.cos(config.slice.tilt*Math.PI/180));u.cutOn.value=config.cut?1:0;
    this.object.visible=stage<4||config.compare;this.fieldPlane.visible=stage>=1&&stage<4;this.reference.visible=stage>=2;this.block.visible=stage>=3&&!!this.texture;this.outline.visible=stage>=1;this.imagePlane.visible=stage===5&&config.hasImage;
    this.slice.visible=stage>=3;this.slice.position.set(11+config.slice.centerX*19/u.size.value,config.slice.centerY*23/u.size.value,(config.slice.position-.5)*10);this.slice.rotation.set(0,Math.atan(Math.tan(config.slice.tilt*Math.PI/180)*u.size.value*10/(u.depth.value*19)),config.slice.rotation*Math.PI/180);
    u.gain.value=1800*(this.stored?config.optics.strength:1);
    const illumination=stage>=4?config.read:ref;
    this.reference.rotation.set(-illumination.vertical*Math.PI/180,illumination.horizontal*Math.PI/180,0);
    if(stage>=1&&stage<4)this.uploadCanvas(this.fieldCanvas,'fieldTexture',this.fieldPlane);
    if(stage===5&&config.hasImage)this.uploadCanvas(this.imageCanvas,'imageTexture',this.imagePlane);
    this.needsRender=true;
  }
  uploadCanvas(canvas,key,plane){
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
    let texture=this[key];
    // Reallocate when quality changes the raster. Upload actual RGBA samples
    // explicitly; no dependence on deferred canvas compositing in the browser.
    if(texture.image.width!==canvas.width||texture.image.height!==canvas.height){
      texture.dispose();texture=new THREE.DataTexture(new Uint8Array(pixels.data.length),canvas.width,canvas.height);
      texture.flipY=true;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.colorSpace=THREE.SRGBColorSpace;
      this[key]=texture;plane.material.map=texture;plane.material.needsUpdate=true;
    }
    texture.image.data.set(pixels.data);texture.needsUpdate=true;
  }
  resetCamera(){this.camera.position.set(5,12,74);this.controls.target.set(0,0,0);this.controls.update();}
  dispose(){cancelAnimationFrame(this.raf);this.controls.dispose();this.resize.disconnect();this.renderer.dispose();this.texture?.dispose();this.fieldTexture.dispose();this.imageTexture.dispose();}
}
