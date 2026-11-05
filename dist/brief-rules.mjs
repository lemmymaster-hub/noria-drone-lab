import {describeMaterials} from './material-catalog.mjs';
import {defaults} from './fields.mjs';
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'dj').replace(/\b(\d{1,3})[. ](\d{3})(?=\s*(?:mah\b|m(?:etara)?\s+(?:nadmorske|amsl|iznad|agl)))/g,'$1$2');
const num='(-?\\d+(?:[.,]\\d+)?)';
function number(v){return Number(v.replace(',','.'))}
export function interpretBrief(text,current,previous=null){
 const t=normalize(text).replace(/((?:visina terena|nadmorska visina|visina leta)[^0-9.;\n]{0,15})(\d{1,3})[. ](\d{3})(?=\s*m\b)/g,'$1$2$3'),p={...current},explicit={},notes=[];
 const materialBrief=describeMaterials(text);
 const hasMaterials=Object.keys(materialBrief.requested).length>0||materialBrief.messages.length>0;
 const type=hasMaterials&&!/\b(?:dron|sniman|dostav|transport|nadzor|trka|trke|fpv|relej|mesh)\w*\b/.test(t)?null:interpretType(text);
 const previousType=previous?interpretType(previous):null;
 // Purpose changes choose a complete conceptual baseline; edits within the same purpose retain parameters.
 if(type&&(type!==previousType||!current.n)){
 Object.assign(p,{n:4,span:650,body:220,frame:.8,gear:.2,kv:700,motor:.14,thrust:2.5,maxW:450,esc:45,escMass:.035,diam:12,pitch:4.5,propMass:.02,cd:1.1,area:.08,eff:.62,cells:6,capacity:10000,battery:1.4,rating:20,reserve:25,payload:.3,avionics:.25,aux:15,link:3,cg:0,speed:8,wind:2,alt:600,agl:80,temp:20,target:20,radius:0});
 if(type==='relay')Object.assign(p,{n:6,span:1100,body:310,frame:1.4,gear:.3,kv:380,motor:.23,thrust:3.5,maxW:650,esc:60,escMass:.055,diam:18,pitch:6,propMass:.035,area:.12,capacity:22000,battery:2.6,rating:15,payload:.8,avionics:.4,aux:25,link:5,target:25});
 if(type==='cargo')Object.assign(p,{n:6,span:1400,body:360,frame:2.7,gear:.4,kv:180,motor:.5,thrust:8,maxW:1800,esc:80,escMass:.08,diam:24,pitch:8,propMass:.07,cells:12,capacity:30000,battery:5,payload:3,area:.2,avionics:.5,aux:30,link:5,speed:8,target:20});
 if(type==='sport')Object.assign(p,{n:4,span:250,body:140,frame:.15,gear:.03,kv:2300,motor:.035,thrust:.9,maxW:300,esc:40,escMass:.008,diam:5,pitch:4,propMass:.005,cells:4,capacity:1500,battery:.18,payload:0,avionics:.07,aux:8,area:.025,rating:60,speed:15,wind:1,target:5,agl:20,link:1});
 notes.push('Prepoznata namjena: '+({relay:'NRN / komunikacioni relej',cargo:'prenos tereta',sport:'FPV / sportski dron',camera:'snimanje / nadgledanje'}[type])+'. Primijenjena konceptualna osnova.');
 }
 const capture=(key,patterns,scale=1)=>{if(key in explicit)return;for(const pattern of patterns){const re=new RegExp(pattern,'g');let match,last;while((match=re.exec(t)))last=match;if(last){explicit[key]=number(last[1])*scale;return}}};
 capture('payload',[`(?:teret\\w*|nosivost\\w*|modul\\w*|paket\\w*)[^\\n;.!?0-9-]{0,35}?(?:od\\s+|mase\\s+)?${num}\\s*kg`,`${num}\\s*kg\\s*(?:teret|nosivost|modul|paket)`]);
 if(!('payload'in explicit))capture('payload',[`(?:teret\\w*|nosivost\\w*|modul\\w*|paket\\w*)[^\\n;.!?0-9-]{0,25}?${num}\\s*(?:g\\b|gram)`],.001);
 capture('target',[`${num}\\s*(?:sat(?:a|i)?\\b|h\\b)`],60);
 capture('target',[`${num}\\s*(?:minuta|minut|min\\b)`,`(?:trajanje|autonomija)[^\\n;]{0,20}?${num}`]);
 capture('reserve',[`${num}\\s*%\\s*(?:rezerve|rezerva)`,`rezerv\\w*[^\\n;]{0,15}?${num}\\s*%`]);
 capture('speed',[`brzin\\w*[^\\n;]{0,18}?${num}\\s*m/s`]);
 if(!('speed'in explicit))capture('speed',[`brzin\\w*[^\\n;]{0,18}?${num}\\s*km/h`],1/3.6);
 capture('wind',[`vjet\\w*[^\\n;]{0,18}?${num}\\s*m/s`,`vet\\w*[^\\n;]{0,18}?${num}\\s*m/s`]);
 capture('link',[`(?:domet\\w*\\s+(?:radio[- ]?)?vez\\w*|radio[- ]?vez\\w*|domet\\w*\\s+signala)[^\\n;.]{0,22}?${num}\\s*km(?!\\s*/)`]);
 capture('radius',[`(?:radijus\\w*|domet\\w*(?!\\s+(?:radio[- ]?)?(?:vez|signal))|udaljenost\\w*)[^\\n;.]{0,22}?${num}\\s*km(?!\\s*/)`]);
 capture('alt',[`${num}\\s*m(?:etara)?\\s*(?:nadmorske|amsl)`,`(?:nadmorska visina|visina terena)[^\\n;]{0,15}?${num}\\s*m`]);
 capture('agl',[`${num}\\s*m(?:etara)?\\s*(?:iznad tla|agl)`,`visin\\w* leta[^\\n;]{0,15}?${num}\\s*m`]);
 capture('temp',[`temperatur\\w*[^\\n;]{0,15}?(-?\\d+(?:[.,]\\d+)?)\\s*(?:°\\s*c|c\\b)`]);
 capture('n',[`${num}\\s*motora`,`broj motora[^\\n;]{0,10}?${num}`]);
 capture('capacity',[`${num}\\s*mah`]);
 capture('span',[`(?:ram\\w*|krug\\w* motora)[^\\n;]{0,18}?${num}\\s*mm`]);
 capture('diam',[`propeler\\w*[^\\n;]{0,18}?${num}\\s*(?:in\\b|inca|inc|\")`]);
 if(!type&&!current.n&&(Object.keys(explicit).length||hasMaterials)){
  Object.assign(p,defaults);
  notes.push('Primijenjena početna konfiguracija za prepoznate zahtjeve.');
 }
 for(const [k,v] of Object.entries(explicit))p[k]=v;
 if(!type&&!Object.keys(explicit).length&&!hasMaterials)notes.push('Nisam prepoznao namjenu ili brojčane zahtjeve. Napiši npr. „dron za snimanje, teret 1 kg, 20 minuta, domet 3 km“.');
 return {parameters:p,explicit,notes};
}
function interpretType(text){
 const t=normalize(text);
 if(/relej|komunikacion|komunikacij|\bnrn\b|\bmesh\b/.test(t))return 'relay';
 if(/trka|trke|trkan|\bfpv\b|igranj|igru/.test(t))return 'sport';
 if(/dostav|transport|prenos\s+teret|prenosen\w*\s+teret|teretni\s+dron/.test(t))return 'cargo';
 if(/sniman|kamer|nadzor|nadgled|fotograf/.test(t))return 'camera';
 return /\bteret\b|nosivost/.test(t)?'cargo':null;
}
