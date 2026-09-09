// Geometry is used only before exposure and in the explicitly labelled comparison.
export const GROUPS = ['columns', 'beam', 'quadriga'];

export function gateGeometry() {
  const triangles=[];
  const tri=(a,b,c,group)=>triangles.push({a,b,c,group});
  function box(x,y,z,w,h,d,group) {
    const p=[];
    for(const zz of [-1,1])for(const yy of [-1,1])for(const xx of [-1,1])p.push([x+xx*w/2,y+yy*h/2,z+zz*d/2]);
    for(const [a,b,c,e] of [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]]){tri(p[a],p[b],p[c],group);tri(p[a],p[c],p[e],group);}
  }
  function column(x,z){
    const m=16, y0=-8.5,y1=1.1;
    for(let j=0;j<m;j++){
      const a=j*2*Math.PI/m,b=(j+1)*2*Math.PI/m;
      const p=[x+.66*Math.cos(a),y0,z+.66*Math.sin(a)],q=[x+.66*Math.cos(b),y0,z+.66*Math.sin(b)];
      const r=[x+.54*Math.cos(a),y1,z+.54*Math.sin(a)],s=[x+.54*Math.cos(b),y1,z+.54*Math.sin(b)];
      tri(p,q,r,'columns');tri(q,s,r,'columns');
    }
    box(x,-8.5,z,1.7,.45,1.7,'columns');box(x,1.2,z,1.8,.6,1.8,'columns');
  }
  for(const z of [0,-6])for(const x of [-12.5,-7.5,-2.5,2.5,7.5,12.5])column(x,z);
  box(0,-9,-3,30,.5,9,'columns');
  box(0,2.4,-3,30,1.7,9,'beam');box(0,3.45,-3,31,.5,9.6,'beam');
  box(0,4.45,-4,20,1.5,7,'beam');box(0,5.4,-4,21,.45,7.5,'beam');
  box(0,5.95,-10,9,.65,6,'quadriga');
  for(const x of [-2.7,-.9,.9,2.7]){
    box(x,7.1,-10,1,1,2.8,'quadriga'); // body
    box(x,7.85,-8.85,.55,1.45,.7,'quadriga');box(x,8.5,-8.55,.7,.6,1,'quadriga');
    for(const xx of [-.32,.32])for(const z of [-10.95,-9.15])box(x+xx,6.2,z,.24,1.25,.3,'quadriga');
    box(x,7.15,-11.55,.2,.7,.9,'quadriga');
  }
  box(0,7.0,-13.2,3.2,1.6,1.8,'quadriga');box(0,8.1,-13.2,.7,1.9,.6,'quadriga');
  box(0,9.3,-13.2,.8,.8,.7,'quadriga');box(1.2,9.1,-13.2,.15,3.5,.15,'quadriga');
  box(1.2,10.8,-13.2,1.8,.18,.2,'quadriga');
  return triangles;
}

export function transformGeometry(triangles,{yaw=0,pitch=0,scale=1,x=0,y=0,depth=130,groups=GROUPS}={}){
  const a=yaw*Math.PI/180,b=pitch*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
  const apply=p=>{const xx=ca*p[0]+sa*p[2],zz=-sa*p[0]+ca*p[2];return [x+scale*xx,y+scale*(cb*p[1]-sb*zz),-depth+scale*(sb*p[1]+cb*zz)];};
  return triangles.filter(t=>groups.includes(t.group)).map(t=>({a:apply(t.a),b:apply(t.b),c:apply(t.c),group:t.group}));
}

/** Orthographic z-buffer quadrature of the surfaces visible from +z.
 * A pixel contributes its projected area. All elements have a coherent +z
 * plane-wave drive exp(ik z_j); no random phase resampling between qualities.
 */
export function sampleVisible(triangles,resolution=64,gain=3){
  if(!triangles.length)return [];
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(const t of triangles)for(const p of [t.a,t.b,t.c]){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);ymin=Math.min(ymin,p[1]);ymax=Math.max(ymax,p[1]);}
  if(xmax-xmin<1e-9||ymax-ymin<1e-9)return [];
  const dx=(xmax-xmin)/resolution,dy=(ymax-ymin)/resolution;
  const zbuf=new Float64Array(resolution**2).fill(-Infinity), tags=new Array(resolution**2), normals=new Array(resolution**2);
  for(const {a,b,c,group} of triangles){
    const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(det)<1e-12)continue;
    const u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...normal);for(let j=0;j<3;j++)normal[j]/=length;
    const ix0=Math.max(0,Math.floor((Math.min(a[0],b[0],c[0])-xmin)/dx)),ix1=Math.min(resolution-1,Math.floor((Math.max(a[0],b[0],c[0])-xmin)/dx));
    const iy0=Math.max(0,Math.floor((Math.min(a[1],b[1],c[1])-ymin)/dy)),iy1=Math.min(resolution-1,Math.floor((Math.max(a[1],b[1],c[1])-ymin)/dy));
    for(let iy=iy0;iy<=iy1;iy++)for(let ix=ix0;ix<=ix1;ix++){
      const x=xmin+(ix+.5)*dx,y=ymin+(iy+.5)*dy;
      const wa=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det;
      const wb=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det,wc=1-wa-wb;
      if(Math.min(wa,wb,wc)<-1e-9)continue;
      const z=wa*a[2]+wb*b[2]+wc*c[2],i=iy*resolution+ix;
      if(z>zbuf[i]){zbuf[i]=z;tags[i]=group;normals[i]=normal;}
    }
  }
  const points=[];
  for(let iy=0;iy<resolution;iy++)for(let ix=0;ix<resolution;ix++){
    const i=iy*resolution+ix;if(!Number.isFinite(zbuf[i]))continue;
    points.push({x:xmin+(ix+.5)*dx,y:ymin+(iy+.5)*dy,z:zbuf[i],amplitude:gain*dx*dy,phase:0,group:tags[i],normal:normals[i]});
  }
  return points;
}

export function normalizeImported(triangles){
  if(!triangles.length)throw new Error('Das Modell enthält keine Dreiecke.');
  if(triangles.length>120000)throw new Error('Bitte ein Modell mit höchstens 120.000 Dreiecken laden.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const t of triangles)for(const p of [t.a,t.b,t.c])for(let i=0;i<3;i++){
    if(!Number.isFinite(p[i]))throw new Error('Das Modell enthält ungültige Koordinaten.');min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);
  }
  const scale=30/Math.max(...max.map((v,i)=>v-min[i]));
  if(!Number.isFinite(scale))throw new Error('Das Modell hat keine räumliche Ausdehnung.');
  return triangles.map(t=>({group:'import',...Object.fromEntries(['a','b','c'].map(key=>[key,t[key].map((v,i)=>(v-(max[i]+min[i])/2)*scale)]))}));
}
