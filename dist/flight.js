import {readCurrentConfiguration,selectGroup} from './configuration.js';
import {flightMaterialCheck,structuralDesign} from './materials.js';
import {sweptRotorObstruction} from './drone-geometry.js';
import {assess} from './physics.mjs';

const button=document.querySelector('#flightplay'), stop=document.querySelector('#flightstop');
const telemetry=document.querySelector('#telemetry'), dialog=document.createElement('dialog');
dialog.style.cssText='max-width:650px;width:90%;max-height:85vh;overflow:auto;background:#101e2d;color:#dce7f3;border:1px solid #47cbb0;border-radius:12px;padding:24px';
document.body.append(dialog);
let active=false,raf;
const pose=detail=>window.dispatchEvent(new CustomEvent('drone-flight-frame',{detail}));
function reset(){
  active=false;window.droneFlightActive=false;cancelAnimationFrame(raf);
  stop.hidden=true;button.disabled=false;pose({x:0,y:0,z:0,pitch:0,roll:0});
}
function openField(key){
  dialog.close();
  const field=document.getElementById(key), group=field?.closest('details');
  if(!group)return;
  if(group.id.startsWith('g-'))selectGroup(group.id.slice(2));
  else group.open=true;
  const focus=field.matches('fieldset')?field.querySelector('select'):field;
  focus.scrollIntoView({behavior:'smooth',block:'center'});
  focus.focus();
}
function assessCurrent(){
  const p=readCurrentConfiguration();
  const report=flightMaterialCheck(p,assess(p));
  if(Number.isFinite(report.mass)){
    const obstruction=sweptRotorObstruction(p,structuralDesign());
    if(obstruction)report.errors.push({field:'span',
      message:`Disk propelera ${obstruction.rotor} ulazi u gabarit dijela „${obstruction.part}“ na 3D modelu.`});
  }
  return {p,report};
}
function showReport({report}){
  reset();telemetry.hidden=true;
  const blocked=report.errors.length>0;
  dialog.innerHTML=`<h2>${blocked?'Test leta blokiran':'Konfiguracija prolazi provjere modela'}</h2>
  <p>${blocked?'Ispravi označene parametre za pokretanje simulacije.':'Misija obuhvata uspon, odlazak, povratak i slijetanje. Prikaz je ubrzan na 40 sekundi, a putanja i visina ilustrativno skalirane.'}</p>
  <ul data-issues></ul>
  <p>Rezultat je procjena na osnovu unesene konfiguracije. Potisak, potrošnju i pad napona provjeri na stvarnom sklopu. Stabilnost, odziv na vjetar, trajanje leta i domet veze potvrdi probnim letom.</p>
  <button data-close>Zatvori</button>${blocked?'':' <button data-run>▶ Pokreni simulaciju</button>'}`;
  const append=(list,text)=>{
    const line=document.createElement('li');line.textContent=text;dialog.querySelector(list).append(line);return line;
  };
  for(const issue of report.errors){
    const line=append('[data-issues]',issue.message+' ');
    const jump=document.createElement('button');jump.textContent='Otvori parametar';
    jump.onclick=()=>openField(issue.field);line.append(jump);
  }
  for(const warning of report.warnings)append('[data-issues]',warning).className='warn';
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  if(!blocked)dialog.querySelector('[data-run]').onclick=()=>{
    const fresh=assessCurrent();
    if(fresh.report.errors.length){showReport(fresh);return;}
    dialog.close();run(fresh.p,fresh.report);
  };
  if(!dialog.open)dialog.showModal();
}
button.onclick=()=>showReport(assessCurrent());
function run(p,report){
  active=true;window.droneFlightActive=true;button.disabled=true;stop.hidden=false;telemetry.hidden=false;
  const start=performance.now(), {total,takeoffTime,landingTime,cruiseTime,outboundSpeed,returnSpeed}=report;
  const radius=(p.radius||report.radiusKm)*1000, outboundTime=radius/outboundSpeed;
  const returnTime=radius>0?radius/returnSpeed:0;
  function tick(now){
    if(!active)return;
    const fraction=Math.min(1,(now-start)/40000),t=fraction*total;
    const cruiseElapsed=t-takeoffTime, landingElapsed=t-(total-landingTime);
    let phase,alt=0,speed=0,distance=0,used=0;
    if(t<takeoffTime){
      phase='Uspon';alt=p.agl*t/takeoffTime;used=report.climb*t/3600;
    }else if(cruiseElapsed<cruiseTime){
      alt=p.agl;
      if(cruiseElapsed<outboundTime){
        phase='Odlazak';speed=outboundSpeed;distance=speed*cruiseElapsed;
      }else if(cruiseElapsed>=cruiseTime-returnTime){
        phase='Povratak';speed=returnSpeed;distance=speed*(cruiseTime-cruiseElapsed);
      }else{
        phase='Zadržavanje na radijusu misije';distance=radius;
      }
      used=(report.climb*takeoffTime+report.cruise*cruiseElapsed)/3600;
    }else{
      phase='Slijetanje';alt=landingTime>0?p.agl*Math.max(0,1-landingElapsed/landingTime):0;
      used=(report.climb*takeoffTime+report.cruise*cruiseTime+report.hover*Math.max(0,landingElapsed))/3600;
    }
    pose({x:radius?330*distance/radius:0,y:p.agl?240*alt/p.agl:0,z:0,pitch:speed?.04:0,roll:0});
    telemetry.innerHTML=`<b>${fraction===1?'Misija završena':phase}</b><br>Vrijeme ${(t/60).toFixed(1)} / ${p.target} min<br>
    Visina ${alt.toFixed(0)} m AGL<br>Napredovanje po ruti ${speed.toFixed(1)} m/s<br>
    Energija ${Math.max(0,100-used/report.Wh*100).toFixed(1)}%<br><small>Ubrzan prikaz · uslovna procjena</small>`;
    if(fraction===1)reset();
    else raf=requestAnimationFrame(tick);
  }
  tick(start);
}
stop.onclick=()=>{reset();telemetry.textContent='Test zaustavljen.';};
function invalidate(){
  if(dialog.open)dialog.close();
  if(active){reset();telemetry.textContent='Parametri izmijenjeni. Pokreni novi test.';}
}
window.addEventListener('drone-config-change',invalidate);
for(const selector of ['#forms','#material-rows','#material-target'])
  document.querySelector(selector).addEventListener('input',invalidate);
