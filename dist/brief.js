import {fitToLimit,markMaterials,flightMaterialCheck} from './materials.js';
import {applyConfiguration,config} from './configuration.js';
import {defaults,empty,parameterProblems} from './fields.mjs';
import {assess,massOf} from './physics.mjs';
import {interpretBrief} from './brief-rules.mjs';
import {materials,materialPartNames} from './material-catalog.mjs';

const example='Želim sklopivi dron za NRN spasilačke timove, prvenstveno kao vazdušni relej za komunikaciju na planinskom terenu. Nosi komunikacioni modul mase 0,8 kg. Cilj je 25 minuta leta uz 25% rezerve baterije, radio-veza do 5 km i brzina oko 8 m/s. Polijetanje je na 1.000 m nadmorske visine, let na 80 m iznad tla, temperatura 15 °C i čeoni vjetar do 3 m/s.';
const input=document.querySelector('#drone-brief'), button=document.querySelector('#configure-ai');
const result=document.querySelector('#ai-result'), progress=document.querySelector('#ai-progress');
const useAi=document.querySelector('#use-local-ai');
let worker,timeout,lastDescription=null,running=false;
const persistBrief=()=>{try{localStorage.setItem('noria-drone-brief',input.value);}catch{}};
try{input.value=localStorage.getItem('noria-drone-brief')||'';}catch{}
input.placeholder='Opiši namjenu, teret, trajanje leta i uslove rada ili klikni „Prikaži primjer“.';

function finish(){
  clearTimeout(timeout);running=false;button.disabled=false;button.textContent='✦ Konfiguriši';
  progress.hidden=true;
}
function cancel(){
  worker?.terminate();worker=null;finish();
}
input.addEventListener('input',()=>{
  if(running)cancel();
  persistBrief();
  result.textContent=input.value.trim()?'Klikni „Konfiguriši“ da primijeniš opis.':'';
});
document.querySelector('#brief-example').onclick=()=>{
  cancel();input.value=example;lastDescription=null;persistBrief();
  result.textContent='Primjer je prikazan. Prilagodi ga ili klikni „Konfiguriši“.';
  input.focus();
};
document.querySelector('#brief-clear').onclick=()=>{
  cancel();input.value='';lastDescription=null;persistBrief();result.textContent='';input.focus();
};
document.querySelector('#reset-config').onclick=()=>{
  cancel();lastDescription=null;
  applyConfiguration(empty,{source:'reset'});
  document.querySelector('#status').textContent='Konfiguracija resetovana';
  result.textContent='Parametri i materijali su resetovani. Opis je sačuvan.';
};
window.addEventListener('drone-config-change',event=>{
  if(event.detail.source==='brief')return;
  if(running){
    cancel();
    result.textContent+='\n\nDodatna analiza je prekinuta zbog izmjene konfiguracije.';
  }
  if(['preset','restore','reset'].includes(event.detail.source))lastDescription=null;
});
useAi.addEventListener('change',()=>{
  if(!useAi.checked&&running){
    cancel();result.textContent+='\n\nDodatna AI analiza je isključena.';
  }
});
button.onclick=configure;

function applyAndReport(params,description,source,explanation,suggestions={}){
  const plan=fitToLimit(params,description,suggestions);
  const before={...config};
  markMaterials(plan,plan.candidate);
  applyConfiguration(plan.candidate,{source:'brief'});
  const fields=[...document.querySelectorAll('#forms input[type=number]')];
  const changes=fields.filter(el=>config[el.id]!==before[el.id]).map(el=>
    el.closest('label').textContent.trim()+': '+before[el.id]+' → '+config[el.id]);
  const report=flightMaterialCheck(config,assess(config));
  const check=report.errors.length?report.errors.map(e=>'• '+e.message).join('\n'):'Osnovni proračun prolazi. Pokreni Test leta za provjeru geometrije i simulaciju.';
  const selected=Object.entries(plan.requested).map(([key,material])=>materialPartNames[key]+': '+material);
  const materialNotes=selected.concat(plan.messages).join('\n');
  document.querySelector('#status').textContent=source;
  return source+'\nProcijenjena ukupna masa: '+massOf(config).toFixed(3)+' kg.\n'+explanation+(materialNotes?'\n\nMaterijali:\n'+materialNotes:'')+
    '\n\n'+(changes.length?'Izmijenjeno:\n'+changes.join('\n'):'Parametri već odgovaraju opisu.')+'\n\n'+check;
}

function configure(){
  if(running)return;
  const description=input.value.trim();
  if(!description){result.textContent='Unesi opis ili brojčane zahtjeve.';return;}
  const current={...config}, previousDescription=lastDescription;
  const interpreted=interpretBrief(description,current,previousDescription);
  const unrecognized=!Object.keys(interpreted.explicit).length&&interpreted.notes[0]?.startsWith('Nisam');
  if(unrecognized){
    result.textContent=interpreted.notes[0];
  }else{
    const problems=parameterProblems(interpreted.parameters);
    if(problems.length){
      result.textContent='Provjeri parametre izvan opsega: '+problems.map(issue=>issue.message).join(' ');return;
    }
    result.textContent=applyAndReport(interpreted.parameters,description,'Konfiguracija ažurirana pravilima iz opisa.',interpreted.notes.join(' '));
    lastDescription=description;
  }
  if(!useAi.checked)return;
  if(!navigator.gpu){result.textContent+='\n\nDodatna AI analiza zahtijeva WebGPU.';return;}
  const baseMessage=result.textContent;
  const fields=[...document.querySelectorAll('#forms input[type=number]')];
  const schema=Object.fromEntries(fields.map(el=>[el.id,{type:'number',minimum:Number(el.min),maximum:Number(el.max),description:el.closest('label').textContent.trim()}]));
  schema.n={type:'number',enum:[4,6,8],description:'Number of motors'};
  schema.cells.type='integer';
  function fail(message){
    cancel();result.textContent=baseMessage+'\n\nDodatna AI analiza: '+message;
  }
  running=true;button.disabled=true;button.textContent='AI konfiguriše…';progress.hidden=false;
  progress.removeAttribute('value');
  result.textContent=baseMessage+'\n\nPripremam dodatnu AI analizu…';
  try{
    worker??=new Worker(new URL('./brief-worker.js',import.meta.url),{type:'module'});
    worker.onerror=()=>fail('Pokretanje nije uspjelo. Provjeri vezu i WebGPU.');
    worker.onmessageerror=()=>fail('Odgovor modela nije čitljiv.');
    worker.onmessage=({data})=>{
      if(data.type==='progress'){
        result.textContent=baseMessage+'\n\n'+data.text;
        if(Number.isFinite(data.progress)){progress.max=1;progress.value=data.progress;}
        else progress.removeAttribute('value');
        return;
      }
      if(data.type==='error'){fail(data.message);return;}
      try{
        const proposed=JSON.parse(data.content);
        const params={...proposed.parameters,...interpreted.explicit};
        if(parameterProblems(params).length)throw new Error('Model je vratio nepotpune ili neispravne parametre.');
        const suggestions=Object.fromEntries(Object.entries(proposed.materials??{}).filter(([key,material])=>
          Object.hasOwn(materialPartNames,key)&&typeof material==='string'&&Object.hasOwn(materials,material)));
        const message=applyAndReport(params,description,'Konfiguracija ažurirana AI analizom.',String(proposed.explanation||'').slice(0,2000),suggestions);
        result.textContent=message;lastDescription=description;finish();
      }catch(error){fail(error.message);}
    };
    timeout=setTimeout(()=>fail('Isteklo je vrijeme obrade.'),8*60*1000);
    worker.postMessage({description,schema,current:unrecognized&&!current.n?defaults:current,previousDescription,materialNames:Object.keys(materials),materialParts:materialPartNames});
  }catch(error){fail(error.message);}
}
