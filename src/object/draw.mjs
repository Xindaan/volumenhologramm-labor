const clamp=x=>Math.max(0,Math.min(1,x));
function hsv(h,s,v){const a=h*6,i=Math.floor(a),f=a-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][((i%6)+6)%6].map(x=>255*x);}
export function raster(canvas,values,n,{kind='intensity',scale=1,valid=null,phase=null,crop=null,gain=1}={}){
  const side=crop?Math.round(n*crop.width/crop.L):n,start=crop?Math.floor((n-side)/2):0;
  canvas.width=side;canvas.height=side;const ctx=canvas.getContext('2d'),image=ctx.createImageData(side,side);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const i=(y+start)*n+x+start,j=4*(y*side+x);let c;
    if(valid&&!valid[i])c=[8,15,21];
    else if(kind==='phase')c=hsv((phase[i]+Math.PI)/(2*Math.PI),.8,clamp(Math.sqrt(Math.max(0,values[i])*gain/(scale||1))));
    else if(kind==='signed'){
      const a=clamp(Math.abs(values[i])*gain/(scale||1))**.65;
      c=values[i]>=0?[14+239*a,21+158*a,27+59*a]:[14+52*a,21+161*a,27+218*a];
    }else if(kind==='spectrum'){const a=clamp((values[i]-scale+6)/6);c=[6+240*a**2,15+202*a**1.4,25+172*a];}
    else {const a=clamp(values[i]*gain/(scale||1))**(kind==='amplitude'?.8:.45);c=[5+239*a,13+232*a,22+190*a];}
    image.data[j]=c[0];image.data[j+1]=c[1];image.data[j+2]=c[2];image.data[j+3]=255;
  }
  ctx.putImageData(image,0,0);
}
export function drawField(canvas,field,mode='amplitude',scale=1,span=64){
  const values=new Float64Array(field.n**2),phase=new Float64Array(field.n**2);
  // Canvas y points downward; invert the physical y coordinate exactly once.
  for(let y=0;y<field.n;y++)for(let x=0;x<field.n;x++){
    const i=y*field.n+x,j=(field.n-1-y)*field.n+x,r=field.re[j],im=field.im[j];
    values[i]=mode==='real'?r:mode==='imag'?im:mode==='amplitude'?Math.hypot(r,im):r*r+im*im;phase[i]=Math.atan2(im,r);
  }
  raster(canvas,values,field.n,{kind:mode==='phase'?'phase':mode==='real'||mode==='imag'?'signed':'amplitude',scale:mode==='phase'?scale:Math.sqrt(scale),phase,crop:{L:field.L,width:span}});
}
export function drawObservation(canvas,power,n,L,scale,gain=1){
  const values=new Float64Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++)values[y*n+x]=power[(n-1-y)*n+x];
  raster(canvas,values,n,{scale,gain,crop:{L,width:48}});
}
export function plotScan(canvas,scan,current){
  const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||500,h=180;canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle='#09121b';ctx.fillRect(0,0,w,h);
  const pad=35,W=w-2*pad,H=h-55,x0=scan.points[0].x,x1=scan.points.at(-1).x;
  ctx.font='11px system-ui';ctx.lineWidth=1;
  for(const y of [0,.5,1]){const py=15+(1-y)*H;ctx.strokeStyle='#24313d';ctx.beginPath();ctx.moveTo(pad,py);ctx.lineTo(w-pad,py);ctx.stroke();ctx.fillStyle='#8ca1ac';ctx.fillText(`${y*100}%`,2,py+4);}
  for(const [key,color,dashed] of [['thin','#647887',true],['thick','#63eddf',false]]){
    ctx.strokeStyle=color;ctx.setLineDash(dashed?[4,4]:[]);ctx.lineWidth=dashed?1.5:2;ctx.beginPath();scan.points.forEach((p,i)=>{const x=pad+(p.x-x0)/(x1-x0)*W,y=15+(1-Math.min(1.05,p[key]))*H;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  }
  ctx.setLineDash([]);const cx=pad+(current-x0)/(x1-x0)*W;ctx.strokeStyle='#ffbf79';ctx.beginPath();ctx.moveTo(cx,10);ctx.lineTo(cx,H+15);ctx.stroke();
  ctx.fillStyle='#99abb8';ctx.textAlign='center';for(const x of [x0,scan.center,x1])ctx.fillText(`${x.toFixed(scan.axis==='angle'?1:0)} ${scan.axis==='angle'?'°':'nm'}`,pad+(x-x0)/(x1-x0)*W,h-14);
}
export function drawVectors(canvas,probe){
  canvas.width=580;canvas.height=240;const c=canvas.getContext('2d');c.fillStyle='#09121b';c.fillRect(0,0,580,240);
  const ox=78,oy=193,scale=8,colors=['#ffbe7e','#b09cfc','#d7e69d'];
  const arrow=(a,b,color,label)=>{c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2;const x=ox+a[0]*scale,y=oy-a[2]*scale,u=ox+b[0]*scale,v=oy-b[2]*scale;c.beginPath();c.moveTo(x,y);c.lineTo(u,v);c.stroke();const angle=Math.atan2(v-y,u-x);c.beginPath();c.moveTo(u,v);c.lineTo(u-8*Math.cos(angle-.4),v-8*Math.sin(angle-.4));c.lineTo(u-8*Math.cos(angle+.4),v-8*Math.sin(angle+.4));c.fill();c.font='12px system-ui';c.fillText(label,u+9,v+8);};
  arrow([0,0,0],probe.kr,'#64e8dc','kᵣ');probe.peaks.forEach((p,i)=>{arrow([0,0,0],p.q,colors[i],`kₒ,${i+1}`);arrow(probe.kr,p.q,colors[i],`K${i+1}`);});
  c.fillStyle='#a1b3c0';c.font='12px system-ui';c.fillText('Projektion x–z · rad/µm',270,34);probe.peaks.forEach((p,i)=>{c.fillStyle=colors[i];c.fillText(`${i+1}   Λ = ${p.period.toFixed(3)} µm`,270,75+40*i);c.fillText(`|K|/2π = ${p.frequency.toFixed(3)} µm⁻¹`,270,91+40*i);});
}
