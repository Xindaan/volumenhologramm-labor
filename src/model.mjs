// Units: µm, femtoseconds, radians, vacuum wavelength in nm at the API boundary.
export const TAU = 2 * Math.PI;
export const C = 0.299792458; // µm / fs
export const rad = degrees => degrees * Math.PI / 180;
export const deg = radians => radians * 180 / Math.PI;
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const norm = a => Math.hypot(...a);
export const sinc = x => Math.abs(x) < 1e-5 ? 1 - x*x/6 + x**4/120 : Math.sin(x)/x;
export const wavevector = (theta, wavelength, n) => {
  const k = TAU * n / (wavelength / 1000);
  return [k * Math.sin(rad(theta)), 0, k * Math.cos(rad(theta))];
};

export function defaults() {
  const thickness = 40, wavelength = 532, theta = -24;
  return {
    mode: 'intuitive', stage: 'recording', objectMode: 'plane', n: 1.5,
    ref: { theta, wavelength, phase: 0, amplitude: 1 },
    obj: { theta: 24, wavelength, phase: 0, amplitude: 1 },
    point: [-8, 0, -24], exposure: 1e6, dose: 1, thickness,
    deltaN: wavelength/1000 * Math.cos(rad(theta))/(2*thickness),
    read: { theta, wavelength }, recorded: null,
    slice: 0, sliceAxis: 'y', clip: false, waves: true, animate: true,
    scan: 'angle', compare: true, locked: true,
  };
}

export function temporalContrast(config) {
  const dw = TAU*C*(1000/config.obj.wavelength - 1000/config.ref.wavelength);
  // Exposure centered on t=0; no spurious phase offset from the integration bounds.
  return sinc(dw*config.exposure/2);
}

export function fieldsAt(r, config, time = 0) {
  const kr = wavevector(config.ref.theta, config.ref.wavelength, config.n);
  const phaseR = dot(kr, r) + rad(config.ref.phase) - TAU*C*1000/config.ref.wavelength*time;
  let phaseO, ampO = config.obj.amplitude;
  if (config.objectMode === 'sphere') {
    const distance = norm(sub(r, config.point));
    const referenceDistance = norm(config.point);
    phaseO = TAU*config.n*1000/config.obj.wavelength*distance + rad(config.obj.phase);
    ampO *= referenceDistance/distance;
  } else {
    phaseO = dot(wavevector(config.obj.theta, config.obj.wavelength, config.n), r) + rad(config.obj.phase);
  }
  phaseO -= TAU*C*1000/config.obj.wavelength*time;
  const ampR = config.ref.amplitude;
  const dc = ampR*ampR + ampO*ampO;
  const cross = 2*ampR*ampO*Math.cos(phaseO-phaseR);
  return { phaseR, phaseO, ampR, ampO, dc, cross, intensity: dc+cross };
}

export function exposureAt(r, config) {
  const f = fieldsAt(r, config);
  return f.dc + f.cross*temporalContrast(config);
}

export function record(config) {
  // Persist the generating analytic field, not an aliased voxel approximation.
  return structuredClone({
    objectMode: config.objectMode, n: config.n, ref: config.ref, obj: config.obj,
    point: config.point, exposure: config.exposure, dose: config.dose,
    thicknessAtRecord: config.thickness,
  });
}

export function indexAt(r, recorded, deltaN) {
  const f = fieldsAt(r, recorded);
  // δn = Δn_slider · dose · (<I>-I_dc)/2. Δn is peak for two unit plane waves.
  return recorded.n + deltaN*recorded.dose*f.cross*temporalContrast(recorded)/2;
}

export function grating(config) {
  const kr = wavevector(config.ref.theta, config.ref.wavelength, config.n);
  const ko = config.objectMode === 'sphere'
    ? config.point.map(x => -x/norm(config.point)*TAU*config.n*1000/config.obj.wavelength)
    : wavevector(config.obj.theta, config.obj.wavelength, config.n);
  const K = sub(ko, kr), magnitude = norm(K);
  return { kr, ko, K, period: magnitude < 1e-10 ? Infinity : TAU/magnitude };
}

export function diffraction(recorded, read, thickness, deltaN) {
  if (!recorded || recorded.objectMode !== 'plane') return { eta: null, transmission: null, valid: false, reason: 'Kugelwelle: numerische Born-Rekonstruktion erforderlich.' };
  const { K, period } = grating(recorded);
  const ki = wavevector(read.theta, read.wavelength, recorded.n), k = norm(ki);
  const qx = ki[0] + K[0], qy = K[1], qz2 = k*k-qx*qx-qy*qy;
  const effectiveN = Math.abs(deltaN*recorded.dose*recorded.ref.amplitude*recorded.obj.amplitude*temporalContrast(recorded));
  const Q = Number.isFinite(period) ? TAU*(read.wavelength/1000)*thickness/(recorded.n*period*period) : 0;
  const rho = effectiveN > 0 ? (read.wavelength/1000)**2/(recorded.n*effectiveN*period**2) : Infinity;
  const base = { K, ki, k, period, Q, rho, effectiveN };
  if (!Number.isFinite(period) || effectiveN < 1e-14 || thickness === 0) {
    return { ...base, eta: 0, transmission: 1, delta: 0, nu: 0, xi: 0, kd: null, valid: true, reason: 'Keine wirksame räumliche Gittermodulation.' };
  }
  if (qz2 <= 0 || ki[2] <= 0) return { ...base, eta: null, transmission: null, kd: null, valid: false, reason: 'Keine propagierende Vorwärtsordnung im Modell.' };
  const kd = [qx, qy, Math.sqrt(qz2)];
  const ci = ki[2]/k, cd = kd[2]/k;
  const delta = ki[2] + K[2] - kd[2];
  const kappa = Math.PI*effectiveN/(read.wavelength/1000*Math.sqrt(ci*cd));
  const nu = kappa*thickness, xi = delta*thickness/2;
  const eta = (nu*sinc(Math.hypot(nu, xi)))**2;
  let reason = '';
  if (Q < 10) reason = 'Q < 10: Übergang zum Mehrordnungsregime; Zweiwellenformel nur formal.';
  else if (rho < 10) reason = 'ρ < 10: andere Beugungsordnungen sind nicht sicher vernachlässigbar.';
  else if (Math.abs(delta)/k > 0.1 || Math.min(ci, cd) < 0.25) reason = 'Außerhalb des hier zugelassenen bragg-nahen Vorwärtsregimes.';
  return { ...base, eta, transmission: 1-eta, delta, kappa, nu, xi, kd, ci, cd, valid: !reason, reason };
}

export function optimalDeltaN(config, thickness) {
  const r = record(config), read = { theta: r.ref.theta, wavelength: r.ref.wavelength };
  const d = diffraction(r, read, thickness, 0.001);
  const exposureFactor = Math.abs(r.dose*r.ref.amplitude*r.obj.amplitude*temporalContrast(r));
  if (!d.cd || exposureFactor < 1e-12) return null;
  return (read.wavelength/1000)*Math.sqrt(d.ci*d.cd)/(2*thickness*exposureFactor);
}

export function scan(recorded, read, thickness, deltaN, axis, count = 401) {
  const center = axis === 'angle' ? recorded.ref.theta : recorded.ref.wavelength;
  const span = axis === 'angle' ? 3 : 35;
  return Array.from({ length: count }, (_, i) => {
    const x = center-span+2*span*i/(count-1);
    const parameters = { ...read, [axis === 'angle' ? 'theta' : 'wavelength']: x };
    return { x, ...diffraction(recorded, parameters, thickness, deltaN) };
  });
}

export function centralFwhm(samples, center) {
  const at = samples.reduce((best, s, i) => Math.abs(s.x-center)<Math.abs(samples[best].x-center) ? i : best, 0);
  const peak = samples[at].eta;
  if (peak == null || peak < 1e-10) return null;
  const half = peak/2;
  const crossing = (a,b) => a.x+(b.x-a.x)*(half-a.eta)/(b.eta-a.eta);
  let left = null, right = null;
  for (let i=at; i>0; i--) if(samples[i-1].eta<=half) { left=crossing(samples[i-1],samples[i]); break; }
  for (let i=at; i<samples.length-1; i++) if(samples[i+1].eta<=half) { right=crossing(samples[i],samples[i+1]); break; }
  return left==null || right==null ? null : right-left;
}

export function setViewMode(state, mode) {
  if (!['intuitive', 'physicist'].includes(mode)) throw new Error('Unbekannter Ansichtsmodus');
  return { ...state, mode };
}
