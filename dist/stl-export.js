import {config} from './configuration.js';
import {cadMaterialSelections,cadMaterialVolumes,printableMaterials,structuralDesign} from './materials.js';
import {massOf} from './physics.mjs';
import {selectedMotor,rankMotorTests} from './motor-catalog.js';
import {planCad,zip} from './cad.js';

const encoder=new TextEncoder();
function makeDrawing(params,motors){
  const rotorRadius=params.diam*25.4/2, scale=125/(params.span/2+rotorRadius);
  const body=params.body*scale;
  const drawing=motors.map(({x,y},i)=>{
    const cx=x*scale,cy=y*scale;
    return `<line x1="0" y1="0" x2="${cx}" y2="${cy}" stroke="#344b5f" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="${rotorRadius*scale}" fill="none" stroke="#748499" stroke-dasharray="3 2"/>
      <circle cx="${cx}" cy="${cy}" r="3" fill="#207865"/>
      <text x="${cx+5}" y="${cy-5}" font-size="8">M${i+1}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -155 300 325" font-family="sans-serif">
    <rect x="-150" y="-155" width="300" height="325" fill="white"/>
    <text x="-135" y="-138" font-size="11">NORIA · RASPORED MOTORA I DISKOVA</text>
    ${drawing}<rect x="${-body/2}" y="${-body*.36}" width="${body}" height="${body*.72}" fill="none" stroke="#22364a"/>
    <text x="-135" y="145" font-size="9">Ø${params.span} mm krug osa motora · Ø${(rotorRadius*2).toFixed(1)} mm propeler</text>
    <text x="-135" y="159" font-size="8">Pogled odozgo · konceptualne mjere</text></svg>`;
}

function openWorkshop(){
  const params={...config}, motor=selectedMotor();
  const dialog=document.createElement('dialog');
  dialog.style.cssText='width:min(680px,90vw);max-height:85vh;overflow:auto;color:#e8f3ff;background:#122036;border:1px solid #527090;border-radius:14px;padding:22px';
  dialog.innerHTML=`<h2>CAD radionica</h2>
  <p>STL koristi mreže iz 3D prikaza i odabir iz sekcije Materijali. Dimenzije su u milimetrima.</p>
  <form><label>Ploča printera X <input name="bedX" type="number" min="1" step="any" value="220" required></label>
  <label>Ploča printera Y <input name="bedY" type="number" min="1" step="any" value="220" required></label>
  <button>Izračunaj i pregledaj</button></form>
  <div data-diagram style="width:min(250px,100%);margin-top:12px"></div>
  <details><summary>Rangiranje motora</summary>
  <p>Jedan test po redu: model | ćelije | prečnik in | korak in | masa g | potisak g | struja A | URL izvora.</p>
  <textarea data-tests rows="4" style="width:100%" aria-label="Objavljeni testovi motora"></textarea>
  <button type="button" data-rank>Rangiraj izmjerene kombinacije</button><pre data-ranked style="white-space:pre-wrap"></pre></details>
  <p data-result role="status"></p><ul data-parts></ul>
  <button data-download disabled>Preuzmi STL paket</button> <button data-close>Zatvori</button>`;
  const form=dialog.querySelector('form'), download=dialog.querySelector('[data-download]');
  const result=dialog.querySelector('[data-result]'), parts=dialog.querySelector('[data-parts]');
  const diagram=dialog.querySelector('[data-diagram]');
  const selections=cadMaterialSelections(),volumes=cadMaterialVolumes(),structural=structuralDesign();
  let plan,bed,svg;
  function invalidate(){
    plan=null;download.disabled=true;parts.replaceChildren();diagram.replaceChildren();
    result.textContent='Ponovo izračunaj nakon izmjene mjera.';
  }
  form.addEventListener('input',invalidate);
  form.onsubmit=event=>{
    event.preventDefault();
    invalidate();
    try{
      bed=[form.elements.bedX.valueAsNumber,form.elements.bedY.valueAsNumber];
      plan=planCad(params,bed,{selections,volumes,structural,printableMaterials});
      svg=makeDrawing(params,plan.motors);
      diagram.innerHTML=svg;
      const printable=plan.dimensions.filter(part=>part.printable);
      const messages=[];
      if(printable.length)messages.push(printable.length+' STL fajlova. Prikazani su gabariti u početnoj orijentaciji za štampu.');
      else messages.push('Odaberi plastiku u sekciji 07 za komponentu koju želiš izvesti.');
      if(printable.some(part=>!part.fits))messages.push('Preveliki dijelovi ostaju u ZIP-u u punoj skali i označeni su ispod.');
      if(plan.propellerGapMm<=0)messages.push('Diskovi propelera se dodiruju ili preklapaju.');
      if(['frame','gear','propMass'].some(key=>printableMaterials.has(selections[key])&&!(structural[key]>0)&&params[key]>0))
        messages.push('Za dimenzionisanje rama, trapa ili makete propelera prema masi unesi odgovarajuću zapreminu. Trenutno se izvoze osnovne mjere prikaza.');
      result.textContent=messages.join(' ');
      parts.replaceChildren(...printable.map(part=>{
        const line=document.createElement('li');
        line.textContent=part.name+' · '+part.material+' · '+part.sizeMm.map(value=>value.toFixed(1)).join(' × ')+' mm'+
          (part.fits?'':' · prevelik u prikazanoj orijentaciji');
        return line;
      }));
      download.disabled=!plan.entries.length;
    }catch(error){result.textContent=error.message;}
  };
  download.onclick=()=>{
    if(!plan?.entries.length)return;
    const manifest={unit:'mm',scale:1,printerBed:bed,parameters:params,motorSource:motor?.source??null,
      motorPositions:plan.motors,propellerGapMm:plan.propellerGapMm,parts:plan.dimensions,materialVolumes:plan.materialVolumes};
    const description='STL u milimetrima, 100% skale. Svaka mreža je položena na Z=0. Gabariti i usklađenost s pločom su u JSON izvještaju. STL datoteke su konceptualne makete, uključujući propelere. Montažne rupe, čvrstoća i tolerancije traže zaseban inženjerski nacrt i provjeru.';
    const url=URL.createObjectURL(zip([...plan.entries,['Sema-sklapanja.svg',encoder.encode(svg)],
      ['Konfiguracija-i-dijelovi.json',encoder.encode(JSON.stringify(manifest,null,2))],['Procitaj.txt',encoder.encode(description)]]));
    const link=document.createElement('a');link.href=url;link.download='Noria-CAD-prototip-rama.zip';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  dialog.querySelector('[data-rank]').onclick=()=>{
    const output=dialog.querySelector('[data-ranked]');
    try{
      const lines=dialog.querySelector('[data-tests]').value.trim().split(/\n/).filter(line=>line.trim());
      if(!lines.length)throw new Error('Dodaj podatke iz objavljenog testa.');
      const tests=lines.map(line=>{
        const values=line.split('|').map(value=>value.trim());
        const [name,cells,diam,pitch,mass,thrust,amps,source]=values;
        if(values.length!==8||!name||!/^https?:\/\//i.test(source)||
           ![cells,diam,pitch,mass,thrust,amps].every(v=>Number.isFinite(Number(v))&&Number(v)>0))
          throw new Error('Svaki red treba osam valjanih polja, uključujući URL izvora.');
        return {name,cells:+cells,diam:+diam,pitch:+pitch,mass:+mass/1000,thrust:+thrust/1000,amps:+amps,source};
      });
      output.textContent=rankMotorTests(tests,params,massOf(params)-params.n*params.motor)
        .map((test,i)=>`${i+1}. ${test.name} · ${test.ratio.toFixed(2)} : 1 · ${test.amps} A po motoru\n${test.reasons.join(' ')||'Prolazi unesene kriterije.'}\n${test.source}`).join('\n\n');
    }catch(error){output.textContent=error.message;}
  };
  const close=()=>dialog.close();
  dialog.querySelector('[data-close]').onclick=close;
  dialog.addEventListener('close',()=>{
    window.removeEventListener('drone-config-change',close);dialog.remove();
  },{once:true});
  document.body.append(dialog);
  dialog.showModal();
  window.addEventListener('drone-config-change',close);
}
document.querySelector('#export-stl').addEventListener('click',openWorkshop);
