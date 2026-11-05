import {parameterProblems} from './fields.mjs';

const gravity=9.80665;
export const massOf=p=>p.frame+p.gear+p.battery+p.payload+p.avionics+p.n*(p.motor+p.escMass+p.propMass);
export const propellerGap=p=>p.span/1000*Math.sin(Math.PI/p.n)-p.diam*.0254;

const climbRate=2, descentRate=1.5;
const airDensity=(alt,temp)=>1.225*(1-2.25577e-5*alt)**5.25588*288.15/(273.15+temp);

export function assess(p){
  const warnings=[];
  const errors=Object.values(p).every(value=>value===0||value===null)
    ? [{field:'n',message:'Konfiguracija je prazna. Unesi parametre, opiši dron ili odaberi predložak.'}]
    : parameterProblems(p);
  if(errors.length)return {errors,warnings};

  const mass=massOf(p), V=p.cells*3.7, Wh=V*p.capacity/1000, usable=Wh*(1-p.reserve/100);
  const rho=airDensity(p.alt+p.agl,p.temp);
  const area=p.n*Math.PI*(p.diam*.0254/2)**2;
  const weight=mass*gravity, drag=.5*rho*p.cd*p.area*p.speed**2;
  const induced=force=>Math.sqrt(force/(2*rho*area));
  const power=force=>force*induced(force)/p.eff;
  const requiredThrust=Math.hypot(weight,drag);
  const hover=power(weight)+p.aux;
  const climb=weight*(climbRate/2+Math.hypot(climbRate/2,induced(weight)))/p.eff+p.aux;
  const cruise=power(requiredThrust)+drag*p.speed/.75+p.aux;
  const total=p.target*60, takeoffTime=p.agl/climbRate, landingTime=p.agl/descentRate;
  const cruiseTime=Math.max(0,total-takeoffTime-landingTime);
  const verticalEnergy=(climb*takeoffTime+hover*landingTime)/3600;
  const need=verticalEnergy+cruise*cruiseTime/3600;
  const outboundSpeed=p.speed+p.wind, returnSpeed=Math.max(0,p.speed-p.wind);
  const roundTripSecondsPerMeter=1/outboundSpeed+1/returnSpeed;
  const energyCruiseSeconds=Math.max(0,usable-verticalEnergy)*3600/cruise;
  const radiusKm=Math.min(p.link,Math.min(cruiseTime,energyCruiseSeconds)/roundTripSecondsPerMeter/1000);
  const gap=propellerGap(p), ratio=p.n*p.thrust/mass;
  const available=p.n*p.maxW+p.aux, peak=p.maxW/V, packPeak=available/V;
  const packLimit=p.capacity/1000*p.rating;
  const issue=(field,message)=>errors.push({field,message});

  if(p.agl<=0)issue('agl','Unesi visinu misije veću od 0 m iznad mjesta polijetanja.');
  if(gap<=0)issue('diam',gap===0?'Diskovi propelera se dodiruju.':'Diskovi propelera se preklapaju za '+(-gap*1000).toFixed(1)+' mm.');
  const peakIdealPower=(p.thrust*gravity)**1.5/Math.sqrt(2*rho*area/p.n);
  if(peakIdealPower>p.maxW)issue('maxW',`Uneseni potisak pri visini misije traži najmanje ${peakIdealPower.toFixed(0)} W po motoru i u idealnom modelu, a uneseno je ${p.maxW} W.`);
  if(p.n*p.thrust<=mass)issue('thrust',`Maksimalni potisak ${(p.n*p.thrust).toFixed(1)} kgf ne može podići ${mass.toFixed(2)} kg.`);
  else if(requiredThrust/gravity>p.n*p.thrust)issue('speed','Krstarenje premašuje uneseni maksimalni potisak.');
  if(hover>available)issue('maxW',`Lebdenje traži ${hover.toFixed(0)} W, a dostupno je ${available.toFixed(0)} W.`);
  else if(takeoffTime>0&&climb>available)issue('maxW',`Uspon traži ${climb.toFixed(0)} W, a dostupno je ${available.toFixed(0)} W.`);
  if(cruiseTime>0&&cruise>available)issue('speed',`Krstarenje traži ${cruise.toFixed(0)} W i premašuje snagu pogona.`);
  if(peak>p.esc)issue('esc',`Maksimalna snaga traži ${peak.toFixed(1)} A po motoru, a ESC dozvoljava ${p.esc} A.`);
  else if(peak>p.esc*.8)warnings.push('ESC ima manje od 20% strujne rezerve.');
  if(packPeak>packLimit)issue('rating','Maksimalna snaga pogona premašuje kontinuiranu struju baterije.');
  else if(packPeak>packLimit*.8)warnings.push('Baterija ima manje od 20% strujne rezerve.');
  if(cruiseTime>0&&!returnSpeed)issue('wind','Brzina kroz vazduh mora biti veća od čeonog vjetra za povratak.');
  if(total<takeoffTime+landingTime)issue('target','Misija je kraća od uspona i slijetanja.');
  if(p.radius>radiusKm+1e-8)issue('radius',`Traženi radijus ${p.radius} km prelazi raspoloživih ${radiusKm.toFixed(2)} km za zadatu misiju.`);
  if(need>usable)issue('capacity',`Misija traži ${need.toFixed(0)} Wh, a poslije rezerve je dostupno ${usable.toFixed(0)} Wh.`);
  if(ratio<2)warnings.push('Odnos maksimalnog potiska i mase je ispod 2 : 1.');
  if(gap>0&&gap<.025)warnings.push('Razmak diskova propelera je manji od 25 mm.');
  const cgOffset=Math.abs(p.cg);
  if(cgOffset>=p.span/2)issue('cg','Težište je na rubu ili izvan kruga osa motora. Sklop nema ravnotežu s rezervom potiska.');
  else if(cgOffset>p.span*.05)warnings.push('Pomak težišta prelazi projektnu preporuku modela. Provjeri ravnotežu i stabilnost stvarnog sklopa.');
  if(p.body>=p.span)issue('body','Dužina tijela mora biti manja od prečnika kruga motora.');
  return {mass,V,Wh,hover,hoverMinutes:usable/hover*60,climb,cruise,need,usable,rho,radiusKm,gap,ratio,
    errors,warnings,takeoffTime,landingTime,cruiseTime,total,outboundSpeed,returnSpeed};
}
