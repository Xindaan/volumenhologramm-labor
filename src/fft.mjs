// Radix-2 complex FFT. Forward unnormalized; inverse normalized by N per axis.
export function fft(real, imag, inverse = false) {
  const n = real.length;
  if(n !== imag.length || n < 2 || (n & (n-1))) throw new Error('FFT length must be a power of two');
  for(let i=1,j=0;i<n;i++) {
    let bit=n>>1;
    for(;j&bit;bit>>=1) j^=bit;
    j^=bit;
    if(i<j) { [real[i],real[j]]=[real[j],real[i]]; [imag[i],imag[j]]=[imag[j],imag[i]]; }
  }
  for(let size=2;size<=n;size*=2) {
    const a=(inverse?2:-2)*Math.PI/size, c=Math.cos(a), s=Math.sin(a);
    for(let start=0;start<n;start+=size) {
      let wr=1,wi=0;
      for(let j=0;j<size/2;j++) {
        const p=start+j,q=p+size/2,tr=wr*real[q]-wi*imag[q],ti=wr*imag[q]+wi*real[q];
        real[q]=real[p]-tr; imag[q]=imag[p]-ti; real[p]+=tr; imag[p]+=ti;
        const w=wr; wr=w*c-wi*s; wi=w*s+wi*c;
      }
    }
  }
  if(inverse) for(let i=0;i<n;i++) {real[i]/=n;imag[i]/=n;}
}

export function fft2(real, imag, n, inverse=false) {
  const rr=new Float64Array(n),ii=new Float64Array(n);
  for(let y=0;y<n;y++) fft(real.subarray(y*n,(y+1)*n),imag.subarray(y*n,(y+1)*n),inverse);
  for(let x=0;x<n;x++) {
    for(let y=0;y<n;y++) {rr[y]=real[y*n+x];ii[y]=imag[y*n+x];}
    fft(rr,ii,inverse);
    for(let y=0;y<n;y++) {real[y*n+x]=rr[y];imag[y*n+x]=ii[y];}
  }
}
