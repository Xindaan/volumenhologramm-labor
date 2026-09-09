import { sampleVisible } from './geometry.mjs';
import { pointSpectrum,spatial,QUALITY,addSpectra } from './waves.mjs';
import { expose,readHologram,imageMetrics } from './reconstruction.mjs';
import { makeVolume,localVectors,braggScan } from './inspection.mjs';

const maximum=a=>a.reduce((v,x)=>Math.max(v,x),0);
function matchedRead(record){return {...record.reference,wavelength:record.wavelength};}
function observation(record,config){
  const result=readHologram(record,config.read,config.optics),baseline=readHologram(record,matchedRead(record),config.optics);
  const metrics=imageMetrics(result.image,baseline.image,48);
  return {image:result.image,power:result.power,eta:result.eta,valid:result.valid,rejected:result.rejected,rmsMismatch:result.rmsMismatch,
    relativeBragg:result.relativeBragg,pupilArea:result.pupilArea,metrics,baselineMax:maximum(baseline.power),transmission:null};
}

self.onmessage=({data})=>{
  const {id,kind,config}=data;
  try{
    if(kind==='draft'){
      const quality=QUALITY[config.quality],points=data.points??sampleVisible(data.triangles,quality.points);
      const field=pointSpectrum(points,{n:quality.n,L:128,wavelength:config.wavelength,index:config.index,na:.28},p=>self.postMessage({id,progress:p*.7}));
      self.postMessage({id,progress:.72});
      const volume=makeVolume(field,config.optics.thickness),plane=spatial(field,config.objectSlice,true);
      self.postMessage({id,kind,field,volume,plane,points,counts:{points:points.length,samples:field.n**2,n:field.n,quality:quality.label}});
    }else if(kind==='record'){
      const record=expose(data.field,config.reference,config.beta),volume=makeVolume(record,config.optics.thickness);
      const result=observation(record,config),scan=braggScan(record,config.read,config.optics,config.scanAxis);
      self.postMessage({id,kind,record,volume,result,scan});
    }else if(kind==='read'){
      const result=observation(data.record,config),output={id,kind,result};
      if(data.wantVolume)output.volume=makeVolume(data.record,config.optics.thickness);
      if(data.wantScan)output.scan=braggScan(data.record,config.read,config.optics,config.scanAxis);
      self.postMessage(output);
    }else if(kind==='field')self.postMessage({id,kind,plane:spatial(data.field,config.objectSlice,true)});
    else if(kind==='probe')self.postMessage({id,kind,probe:localVectors(data.field,config.reference,data.point)});
    else if(kind==='decompose'){
      const points=sampleVisible(data.triangles,64),settings={n:256,L:128,wavelength:config.wavelength,index:config.index,na:.28};
      const fields=['columns','beam','quadriga'].map((g,i)=>pointSpectrum(points.filter(p=>p.group===g),settings,p=>self.postMessage({id,progress:(i+p)/3})));
      const joint=addSpectra(fields[0],fields[2]),all=addSpectra(joint,fields[1]);
      const cases=[fields[0],fields[2],all,joint].map(f=>({plane:spatial(f,config.optics.thickness/2,true),reconstruction:readHologram(expose(f,config.reference,config.beta),{...config.reference,wavelength:config.wavelength},config.optics).power}));
      self.postMessage({id,kind,cases,n:256,L:128,points:points.length});
    }else throw new Error('Unbekannter Rechenauftrag.');
  }catch(error){self.postMessage({id,error:error.message,stack:error.stack});}
};
