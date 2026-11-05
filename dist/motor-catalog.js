import {applyConfiguration,config} from './configuration.js';
export const motors = [
  {id:'xing2207',name:'iFlight XING2 2207 · 1855 KV',type:'FPV / manji multirotor',kv:1855,mass:.0316, mount:{x:16/Math.SQRT2,y:16/Math.SQRT2,d:3.2},source:'https://bbs.iflight.com/hack.php?gid=79&id=shop&mod=view'},
  {id:'xing2506',name:'iFlight XING2 2506 · 1500 KV',type:'FPV / srednji multirotor',kv:1500,mass:.0382,mount:{x:16/Math.SQRT2,y:16/Math.SQRT2,d:3.2},source:'https://bbs.iflight.com/hack.php?gid=80&id=shop&mod=view&show=replys'},
  {id:'mn5008',name:'T-MOTOR MN5008 · 340 KV',type:'6S / 17–18″',kv:340,mass:.135,source:'https://store.tmotor.com/product/mn5008-kv340-motor-antigravity-type.html'}
];
export const selectedMotor=()=>motors.find(motor=>motor.id===document.querySelector('#motor-catalog')?.value);

const select=document.querySelector('#motor-catalog'), note=document.querySelector('#motor-catalog-note');
document.querySelector('#g-motor .fields').append(select.closest('label'),note);
select.append(...motors.map(motor=>new Option(motor.name+' — '+motor.type,motor.id)));

function refreshNote(){
  const motor=selectedMotor();
  if(!motor){note.textContent='';return;}
  const link=document.createElement('a');
  link.href=motor.source;link.target='_blank';link.rel='noopener';link.textContent='Podaci proizvođača';
  note.replaceChildren(motor.mount?'4 × M3 na krugu Ø16 mm. ':'Montažne mjere potrebno potvrditi. ',
    'Potisak i snagu unesi za konkretan propeler i bateriju. ',link);
}
select.addEventListener('change',()=>{
  const motor=selectedMotor();
  applyConfiguration(motor?{kv:motor.kv,motor:motor.mass}:{},{source:'motor'});
});
window.addEventListener('drone-config-change',()=>{
  const motor=selectedMotor();
  if(motor&&(config.kv!==motor.kv||config.motor!==motor.mass))select.value='';
  refreshNote();
});

export function rankMotorTests(tests, {cells,diam,pitch,n,esc,rating,capacity,aux}, massWithoutMotors) {
  const packLimit=rating*capacity/1000, auxiliaryCurrent=aux/(cells*3.7);
  return tests.map(test=>{
    const reasons=[];
    const ratio=test.thrust*n/(massWithoutMotors+n*test.mass);
    if(![test.thrust,test.amps,test.mass,ratio,packLimit,esc,cells,diam,pitch].every(v=>Number.isFinite(v)&&v>0)||![4,6,8].includes(n))
      reasons.push('Nedostaju valjane izmjerene vrijednosti ili podaci o napajanju.');
    if(test.cells!==cells||Math.abs(test.diam-diam)>.01||Math.abs(test.pitch-pitch)>.01)
      reasons.push('Test koristi drugi propeler ili napon.');
    if(ratio<2)reasons.push('Potisak je ispod ciljanog odnosa 2 : 1.');
    if(test.amps>esc||test.amps*n+auxiliaryCurrent>packLimit)reasons.push('Struja prelazi uneseni limit ESC-a ili baterije.');
    return {...test,ratio,reasons};
  }).sort((a,b)=>a.reasons.length-b.reasons.length||(Number.isFinite(b.ratio)?b.ratio:0)-(Number.isFinite(a.ratio)?a.ratio:0));
}
