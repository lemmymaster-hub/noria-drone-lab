import {applyConfiguration,config} from './configuration.js';
import { interpretBrief } from './brief-rules.mjs';
import { assess, massOf } from './physics.mjs';

import {materials,printableMaterials,describeMaterials} from './material-catalog.mjs';
export {printableMaterials};
export function cadMaterialSelections() {
  return Object.fromEntries(parts.map(([key],i)=>[key,rows[i].querySelector('select').value]));
}
export function cadMaterialVolumes() {
  return Object.fromEntries(parts.map(([key],i)=>[key,Number(rows[i].querySelector('input').value)]));
}
export function structuralDesign() {
  const selections=cadMaterialSelections(), volumes=cadMaterialVolumes();
  const design={};
  for(const key of ['frame','gear','propMass']){
    if(printableMaterials.has(selections[key])&&volumes[key]>0&&
       Math.abs(volumes[key]*materials[selections[key]]/1000-config[key])<.00001)
      design[key]=volumes[key];
  }
  return design;
}
const parts = [
  ['frame','Ram, krakovi i kućište','Karbonski kompozit CFRP',1],
  ['gear','Stajni trap','PA12 (najlon)',1],
  ['propMass','Propeler','PA12 (najlon)',0],
  ['motor','Motor','Aluminij 6061-T6',0],
  ['escMass','ESC','Aluminij 6061-T6',0],
  ['battery','Baterijski sklop','ABS',1],
  ['avionics','Avionika i ožičenje','Bakar',1],
  ['payload','Korisni teret','ABS',1]
];
const assemblies = {
  motor:'Sklop motora · aluminij, bakar i magneti',
  escMass:'ESC · pločica, elektronika i konektori',
  battery:'Baterijski sklop · LiPo ćelije i kućište',
  avionics:'Avionika · pločice, senzori i ožičenje',
  payload:'Korisni teret · masa prema opisu'
};
// Approximate effective densities, including voids within a complete assembly.
const assemblyDensity = {motor:3.4,escMass:1.6,battery:2,avionics:1.5,payload:1};
const form = document.querySelector('#forms');
const byId = id => document.getElementById(id);
const read = () => ({...config});
const total = massOf;
function apply(p){applyConfiguration(p,{source:'materials'});}
function refresh() {
  const p = read();
  const mass=total(p);
  byId('material-total').value=Number.isFinite(mass)?mass.toFixed(3):'—';
  for (const [id] of parts) byId('material-mass-'+id).textContent = (p[id] || 0).toFixed(3)+' kg';
}

for (const [id,name,reference] of parts) {
  const row = document.createElement('fieldset');
  row.id='material-row-'+id;
  row.innerHTML = `<legend>${name} · <output id="material-mass-${id}"></output></legend>
  <label>Materijal <select aria-label="Materijal: ${name}"><option value="">Ručna / deklarisana masa</option>${Object.keys(materials).map(m=>`<option>${m}</option>`).join('')}<option value="custom">Drugi materijal</option>${assemblies[id]?`<option value="assembly">${assemblies[id]}</option>`:""}</select></label>
  <label>Zapremina materijala (cm³)${['propMass','motor','escMass'].includes(id)?' / kom.':''} <input type="number" min="0" step="any" placeholder="cm³"></label>
  <label hidden>Gustina (g/cm³) <input type="number" min="0" step="any"></label>
  <small role="status"></small>`;
  const [volume,density] = row.querySelectorAll('input');
  const select = row.querySelector('select');
  const message = row.querySelector('small');
  function recalculate() {
    density.parentElement.hidden=select.value!=='custom';
    delete row.dataset.conflict;
    message.textContent='';
    if(!select.value||select.value==='assembly')delete row.dataset.partOnly;
    if(!select.value){volume.value='';density.value='';apply({});return;}
    if(row.hasAttribute('data-part-only')){
      message.textContent='U proračunu ostaje masa cijelog sklopa.';
      apply({});
      return;
    }
    const rho=select.value==='custom'?Number(density.value):select.value==='assembly'?assemblyDensity[id]:materials[select.value];
    if(!volume.value&&['frame','gear','propMass'].includes(id)&&config[id]>0&&rho>0){
      volume.value=String(config[id]*1000/rho);
      message.textContent='Početna zapremina je izvedena iz trenutne mase. Možeš je izmijeniti.';
    }
    const mass=Number(volume.value)*rho/1000;
    if(!volume.value||!Number.isFinite(mass)||!(rho>0)||!(Number(volume.value)>0)){
      message.textContent='Unesi pozitivnu zapreminu i gustinu za vlastiti materijal.';apply({});return;
    }
    const field=byId(id);
    if(mass<Number(field.min)-1e-12||mass>Number(field.max)+1e-12){
      message.textContent='Procjena je izvan raspona konfiguratora.';apply({});return;
    }
    apply({[id]:Math.max(Number(field.min),Math.min(Number(field.max),mass))});
  }
  for (const el of [select,volume,density]) el.addEventListener('change',recalculate);
  byId('material-rows').append(row);
}
const structuralChoices = [
  ['Karbonski kompozit CFRP','Aluminij 6061-T6','Magnezij AZ31B'],
  ['PA12 (najlon)','Karbonski kompozit CFRP'],
  ['PA12 (najlon)','Karbonski kompozit CFRP','Stakleni kompozit GFRP']
];
const rows = [...byId('material-rows').querySelectorAll('fieldset')];
function fillRow(row,state={}){
  const select=row.querySelector('select'), [volume,density]=row.querySelectorAll('input');
  select.value=state.material||'';
  volume.value=state.volume??'';
  density.value=state.density??'';
  density.parentElement.hidden=select.value!=='custom';
  row.toggleAttribute('data-part-only',state.partOnly===true);
  row.toggleAttribute('data-conflict',state.conflict===true);
  row.querySelector('small').textContent=state.conflict?'Odredi jedan materijal za ovaj red.':
    state.partOnly?'Odabran je materijal dijela sklopa. U proračunu ostaje masa cijelog sklopa.':'';
}
export const materialState={
  check:flightMaterialCheck,
  read(){
    const components=Object.fromEntries(parts.map(([key],i)=>{
      const row=rows[i], [volume,density]=row.querySelectorAll('input');
      return [key,{material:row.querySelector('select').value,volume:volume.value===''?null:volume.valueAsNumber,
        density:density.value===''?null:density.valueAsNumber,
        ...(row.hasAttribute('data-part-only')?{partOnly:true}:{}),
        ...(row.hasAttribute('data-conflict')?{conflict:true}:{})}];
    }));
    return {components,target:byId('material-target').valueAsNumber||null};
  },
  validate(state){
    if(state==null)return {};
    if(typeof state!=='object'||Array.isArray(state)||
       !(state.target==null||(Number.isFinite(state.target)&&state.target>0)))
      throw new Error('Neispravna ciljna masa u JSON-u.');
    const components=state.components??{};
    if(typeof components!=='object'||Array.isArray(components))
      throw new Error('Neispravni podaci o materijalima.');
    for(const [key] of parts){
      const part=components[key];
      if(part==null)continue;
      if(typeof part!=='object'||Array.isArray(part)||
         !(part.material===''||part.material==='custom'||(part.material==='assembly'&&assemblies[key])||Object.hasOwn(materials,part.material))||
         ![part.volume,part.density].every(value=>value==null||(Number.isFinite(value)&&value>=0)))
        throw new Error('Neispravna zapremina, gustina ili materijal za '+key+'.');
    }
    return {components,target:state.target};
  },
  write(state={}){
    parts.forEach(([key],i)=>fillRow(rows[i],state.components?.[key]));
    byId('material-target').value=state.target??'';
    byId('material-feedback').textContent='';
  }
};
window.addEventListener('drone-config-change',event=>{
  const {source,changed}=event.detail;
  if(source==='preset')rows.forEach(row=>fillRow(row));
  if(source==='manual'||source==='motor'){
    parts.forEach(([key],i)=>{
      if(!changed.includes(key)||!rows[i].querySelector('select').value)return;
      fillRow(rows[i]);
      rows[i].querySelector('small').textContent='Masa je promijenjena u konfiguraciji. Sada se koristi ručna masa.';
    });
  }
  refresh();
});

function referenceVolume(key,mass,reference){
  const {material,volume}=materialState.read().components[key];
  return Object.hasOwn(materials,material)&&volume>0&&Math.abs(volume*materials[material]/1000-mass)<.00001
    ? volume : mass*1000/materials[reference];
}
export function fitConfiguration(base, limit, selected=[]) {
  if (!base.n || !base.frame || !base.battery || !base.diam) return null;
  const fields=[...form.querySelectorAll('input[type=number]')];
  const baseVolumes=parts.slice(0,3).map(([key,,reference])=>referenceVolume(key,base[key],reference));
  let best=null;
  for (let step=45;step<=160;step++) {
    const scale=step/100, cube=scale**3;
    for(const frame of (selected[0]?[selected[0]]:structuralChoices[0])) for(const gear of (selected[1]?[selected[1]]:structuralChoices[1])) for(const prop of (selected[2]?[selected[2]]:structuralChoices[2])) {
      const choices=[frame,gear,prop];
      const candidate={...base};
      for(const key of ['span','body','diam','pitch']) candidate[key]=base[key]*scale;
      for(const key of ['motor','escMass','battery','avionics','maxW','capacity']) candidate[key]=base[key]*cube;
      candidate.thrust=base.thrust*cube;
      candidate.esc=Math.ceil(base.esc*cube);
      candidate.kv=base.kv/scale;
      candidate.area=base.area*scale**2;
      candidate.cg=base.cg*scale;
      const volumes=baseVolumes.map(volume=>volume*cube);
      for(let i=0;i<3;i++) candidate[parts[i][0]]=volumes[i]*materials[choices[i]]/1000;
      const mass=total(candidate);
      if(mass>limit || (best && mass<=best.mass)) continue;
      if(fields.some(el=>!Number.isFinite(candidate[el.id])||candidate[el.id]<Number(el.min)||candidate[el.id]>Number(el.max))) continue;
      if(assess(candidate).errors.length) continue;
      best={candidate,choices,volumes,mass};
    }
  }
  return best;
}
export function markMaterials(plan, params) {
  const {components}=materialState.read();
  for(let i=0;i<rows.length;i++){
    const row=rows[i], [key,,reference]=parts[i];
    const existing=components[key];
    if(plan.conflicts?.includes(key)){fillRow(row,{...existing,conflict:true});continue;}
    const chosen=plan.requested?.[key];
    if(!chosen&&!plan.optimized&&config[key]>0&&params[key]===config[key])continue;
    if(i<3){
      const material=plan.choices?.[i]||reference;
      const volume=plan.volumes?.[i]??params[key]*1000/materials[material];
      if(existing.material==='custom'&&!chosen&&!plan.optimized){
        fillRow(row,existing);
        continue;
      }
      fillRow(row,{material:params[key]>0||chosen?material:'',volume:volume>0?volume:null});
      if(volume>0)row.querySelector('small').textContent='Procijenjena zapremina materijala. Provjeri stvarne mjere dijela.';
    }else if(chosen||existing.partOnly){
      fillRow(row,{material:chosen||existing.material,partOnly:true,
        volume:!chosen||chosen===existing.material?existing.volume:null});
    }else if(existing.material&&existing.material!=='assembly'&&params[key]===config[key]){
      fillRow(row,existing);
    }else{
      const rho=assemblyDensity[key];
      fillRow(row,params[key]>0?{material:'assembly',volume:params[key]*1000/rho}:{});
    }
  }
}
export function fitToLimit(params, description='', suggestions={}, optimize=false) {
  const brief=describeMaterials(description);
  const requested={...suggestions,...brief.requested};
  for(const key of brief.conflicts)delete requested[key];
  const current=cadMaterialSelections();
  const selected=parts.slice(0,3).map(([key])=>requested[key]||(Object.hasOwn(materials,current[key])?current[key]:null));
  const metadata={...brief,requested};
  const limit=Number(byId('material-target').value);
  if(optimize&&limit>0){
    const plan=fitConfiguration(params,limit,selected);
    return plan?{...plan,...metadata,optimized:true}:null;
  }
  const choices=selected.map((material,i)=>material||parts[i][2]);
  const volumes=parts.slice(0,3).map(([key,,reference])=>referenceVolume(key,params[key],reference));
  const candidate={...params};
  for(let i=0;i<3;i++){
    const key=parts[i][0];
    if(brief.conflicts.includes(key)||!requested[key])continue;
    const mass=volumes[i]*materials[choices[i]]/1000;
    const field=byId(key), minimum=Number(field.min), maximum=Number(field.max);
    if(mass>=minimum-1e-12&&mass<=maximum+1e-12)candidate[key]=Math.max(minimum,Math.min(maximum,mass));
  }
  return {candidate,choices,volumes,...metadata};
}
export function flightMaterialCheck(p, report) {
  const limit=Number(byId('material-target').value);
  if(limit>0 && total(p)>limit) report.errors.push({field:'material-target',message:`Masa ${total(p).toFixed(3)} kg prelazi cilj ${limit} kg. Smanji masu sklopa ili promijeni cilj.`});
  rows.forEach((row,i)=>{
    const [key,label]=parts[i];
    if(row.hasAttribute('data-conflict')){
      report.errors.push({field:row.id,message:label+': odaberi jedan materijal među prijedlozima iz opisa.'});
      return;
    }
    const material=row.querySelector('select').value;
    if(!material||(row.hasAttribute('data-part-only')&&Object.hasOwn(materials,material)))return;
    const [volume,density]=row.querySelectorAll('input');
    const rho=material==='custom'?Number(density.value):material==='assembly'?assemblyDensity[key]:materials[material];
    const expected=Number(volume.value)*rho/1000;
    if(!(rho>0)||!(Number(volume.value)>0)||!Number.isFinite(expected)||Math.abs(expected-p[key])>.00001)
      report.errors.push({field:'material-row-'+key,message:`${parts[i][1]}: masa ne odgovara odabranom materijalu i zapremini. Uskladi zapreminu ili odaberi ručnu masu.`});
  });
  return report;
}
let previousOutput=null, referenceConfig=null;
const targetInput=byId('material-target');
byId('reset-config').addEventListener('click',()=>{
  previousOutput=null;
  referenceConfig=null;
  materialState.write();
});
function optimize() {
  const target=Number(byId('material-target').value), feedback=byId('material-feedback');
  if(!(target>0)){feedback.textContent='Unesi pozitivnu ciljnu masu.';return;}
  const current=read();
  const description=byId('drone-brief').value.trim() || 'Dron za snimanje kamerom.';
  if(JSON.stringify(current)!==previousOutput || !referenceConfig) {
    referenceConfig=current.n&&current.frame&&current.battery ? current : interpretBrief(description,current).parameters;
  }
  const plan=fitToLimit(referenceConfig,description,{},true);
  if(!plan){feedback.textContent='Nema kandidata unutar limita koji prolazi provjere. Povećaj limit ili prilagodi teret, vrijeme leta i brzinu.';return;}
  markMaterials(plan,plan.candidate);
  apply(plan.candidate);
  previousOutput=JSON.stringify(read());
  feedback.textContent=`Procjena ${plan.mass.toFixed(3)} kg · ${(target-plan.mass).toFixed(3)} kg ispod limita. Dimenzije, pogon, baterija i mase su konceptualne procjene.`;
}
byId('material-optimize').onclick=optimize;
targetInput.addEventListener('change',()=>apply({}));
window.addEventListener('drone-config-change',event=>{
  if(!['materials','automatic'].includes(event.detail.source)){
    previousOutput=null;
    referenceConfig=null;
  }
});
