import {groups,fields,defaults,empty,parameterProblems} from './fields.mjs';
import {assess} from './physics.mjs';

const byId=id=>document.getElementById(id);
const form=byId('forms'), preset=byId('preset');
const status=message=>{byId('status').textContent=message;};
const storageKey='noria-drone-v2';
export const config={...empty};
let materialState;
let selected='frame';
let fileRevision=0;

for(const [id,title,items] of groups){
  const details=document.createElement('details');
  details.id='g-'+id;
  details.open=id==='frame';
  details.innerHTML='<summary>'+title+'</summary><div class="fields">'+items.map(([key,label,,min,max,step])=>
    '<label>'+label+'<input type="number" id="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="0"></label>').join('')+'</div>';
  details.addEventListener('toggle',()=>{if(details.open)highlight(id);});
  form.append(details);
}
function highlight(id){
  if(!byId('g-'+id))return;
  selected=id;
  form.querySelectorAll('details').forEach(d=>d.classList.toggle('selected',d.id==='g-'+selected));
  window.dispatchEvent(new CustomEvent('drone-part-selected',{detail:id}));
}
export function selectGroup(id){
  const details=byId('g-'+id);
  if(!details)return;
  details.open=true;
  highlight(id);
  details.scrollIntoView({behavior:'smooth',block:'nearest'});
}
highlight(selected);

function renderCalculations(){
  const assessment=assess(config);
  const report=materialState?.check(config,assessment)??assessment;
  const {mass,ratio,hover,hoverMinutes,radiusKm,rho,usable,cruise,V,gap,errors,warnings}=report;
  const data=[
    ['Ukupna masa',mass?.toFixed(2)+' kg'],['Potisak / masa',ratio?.toFixed(2)+' : 1'],
    ['Lebdenje • procjena',hoverMinutes?.toFixed(1)+' min'],['Povratni radijus',radiusKm?.toFixed(2)+' km']
  ];
  byId('metrics').innerHTML=data.map(([title,value])=>'<div class="metric"><small>'+title+
    '</small><strong>'+(mass===undefined?'—':value)+'</strong></div>').join('');
  const issues=errors.map(issue=>issue.message).concat(warnings);
  byId('warnings').replaceChildren(...(issues.length?issues:['Osnovni proračun prolazi. Pokreni Test leta za provjeru geometrije i simulaciju.']).map(message=>{
    const line=document.createElement('div');line.className=issues.length?'warn':'ok';line.textContent=message;return line;
  }));
  byId('calc').innerHTML=mass===undefined?'Čekam valjane parametre za proračun.':
    `<p>Lebdenje <b>${hover.toFixed(0)} W</b> · ${(hover/V).toFixed(1)} A<br>
    Korisna energija <b>${usable.toFixed(0)} Wh</b><br>Krstarenje ${cruise.toFixed(0)} W<br>
    Gustina vazduha ${rho.toFixed(3)} kg/m³<br>Razmak diskova propelera ${(gap*1000).toFixed(0)} mm</p>
    <small>Radijus uzima u obzir vjetar u oba smjera, energiju za uspon i slijetanje, zadato trajanje i domet veze.</small>`;
}
export function readCurrentConfiguration(){
  return Object.fromEntries(fields.map(([key])=>{
    const value=byId(key).valueAsNumber;
    return [key,Number.isFinite(value)?value:null];
  }));
}
function snapshot(){
  return {schema:2,parameters:{...config},materials:materialState?.read(),motor:byId('motor-catalog').value||null};
}
function validDraft(parameters){
  return Object.keys(parameters).length>0 && fields.every(([key])=>!Object.hasOwn(parameters,key)||
    parameters[key]===0 || parameters[key]===null || !parameterProblems({[key]:parameters[key]},true).length);
}
function publish(source,changed){
  if(!['preset','restore'].includes(source))preset.value='custom';
  if(source!=='restore')fileRevision++;
  window.dispatchEvent(new CustomEvent('drone-config-change',{detail:{source,changed}}));
  renderCalculations();
  if(validDraft(config)){
    try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));}catch{}
  }
}
export function applyConfiguration(parameters,{source='automatic'}={}){
  const changed=[];
  for(const [key] of fields){
    if(!Object.hasOwn(parameters,key))continue;
    const value=parameters[key];
    if(config[key]!==value)changed.push(key);
    config[key]=value;
    byId(key).value=value??'';
  }
  publish(source,changed);
}

form.addEventListener('change',event=>{
  const input=event.target;
  if(input.type==='number'&&Object.hasOwn(config,input.id))
    applyConfiguration({[input.id]:Number.isFinite(input.valueAsNumber)?input.valueAsNumber:null},{source:'manual'});
});
const presets={
  light:{n:4,span:550,body:190,frame:.65,gear:.15,motor:.09,thrust:1.5,maxW:300,diam:10,
    propMass:.015,escMass:.025,battery:.85,capacity:6000,payload:.15,kv:920,agl:60,target:12,aux:15,area:.07},
  relay:{speed:11},
  cargo:{n:6,span:1400,body:360,frame:2.7,gear:.4,motor:.5,thrust:8,maxW:1800,diam:24,pitch:8,
    propMass:.07,escMass:.08,battery:5,capacity:30000,cells:12,payload:5,esc:80,area:.2,target:15}
};
preset.onchange=()=>{
  if(Object.hasOwn(presets,preset.value))applyConfiguration({...defaults,...presets[preset.value]},{source:'preset'});
};
function restore(snapshot){
  const {schema,parameters,materials,motor}=snapshot??{};
  if(![undefined,1,2].includes(schema)||!parameters||typeof parameters!=='object'||
     Array.isArray(parameters)||!Object.keys(parameters).some(key=>Object.hasOwn(empty,key))||!validDraft(parameters))
    throw new Error('Konfiguracijski JSON sadrži neispravne parametre ili nepodržanu verziju.');
  const prepared=materialState?.validate(materials);
  materialState?.write(prepared);
  preset.value='custom';
  byId('motor-catalog').value=typeof motor==='string'?motor:'';
  applyConfiguration({...empty,...parameters},{source:'restore'});
}
export function initConfiguration(state){
  materialState=state;
  try{
    const saved=localStorage.getItem(storageKey);
    if(saved){restore(JSON.parse(saved));return;}
    const legacy=localStorage.getItem('noria-drone-v1');
    if(legacy){restore({schema:1,parameters:JSON.parse(legacy)});return;}
  }catch{}
  publish('restore',[]);
}
byId('save').onclick=()=>{
  if(!validDraft(config)){status('Ispravi vrijednosti izvan raspona prije čuvanja JSON-a.');return;}
  const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='noria-drone-configuration.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
};
byId('load').onclick=()=>byId('file').click();
byId('file').onchange=async event=>{
  const input=event.target, file=input.files[0], revision=++fileRevision;
  input.value='';
  if(!file)return;
  try{
    if(file.size>1024*1024)throw new Error('Konfiguracijski JSON mora biti manji od 1 MB.');
    const data=JSON.parse(await file.text());
    if(revision!==fileRevision)return;
    restore(data);
    status('Konfiguracija učitana.');
  }catch(error){
    if(revision===fileRevision)status(error instanceof SyntaxError?'Neispravan konfiguracijski JSON.':error.message);
  }
};
