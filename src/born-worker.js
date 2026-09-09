import { bornReconstruct } from './born.mjs';
self.onmessage = ({data}) => {
  try {
    const result=bornReconstruct(data.recorded,data.read,data.thickness,data.deltaN);
    self.postMessage({id:data.id,...result},[result.real.buffer,result.imag.buffer]);
  } catch(error) { self.postMessage({id:data.id,error:error.message}); }
};
