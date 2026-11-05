export const materials = {
  'Karbonski kompozit CFRP': 1.55, 'Stakleni kompozit GFRP': 1.9, 'Aramidni kompozit': 1.4,
  'Aluminij 6061-T6': 2.7, 'Aluminij 7075-T6': 2.81, 'Aluminij 2024-T3': 2.78,
  'Magnezij AZ31B': 1.77, 'Titan Ti-6Al-4V': 4.43, 'Nehrđajući čelik 304': 8,
  'Čelik 4130': 7.85, 'Bakar': 8.96, 'Mesing': 8.5, 'NdFeB magnet': 7.5,
  'PLA': 1.24, 'PETG': 1.27, 'ABS': 1.04, 'ASA': 1.07, 'PA12 (najlon)': 1.02,
  'PA-CF (najlon s karbonskim vlaknima)': 1.15, 'Polikarbonat': 1.2, 'TPU': 1.21,
  'PEEK': 1.3, 'POM': 1.41, 'Polipropilen': .91, 'EPP pjena': .05,
  'Balza': .16, 'Brezova šperploča': .67, 'Silikon': 1.12
};
export const printableMaterials = new Set(['PLA','PETG','ABS','ASA','PA12 (najlon)','PA-CF (najlon s karbonskim vlaknima)','Polikarbonat','TPU','PEEK','POM','Polipropilen']);

const cyrillic=Object.fromEntries([...'абвгдђежзијклљмнњопрстћуфхцчџш'].map((letter,i)=>
  [letter,'a b v g d dj e z z i j k l lj m n nj o p r s t c u f h c c dz s'.split(' ')[i]]));
const normalize=text=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[а-яђјљњћџ]/g,letter=>cyrillic[letter]??letter).replace(/đ/g,'dj').replace(/[–—−]/g,'-');

const names={
  frame:'Ram, krakovi i kućište',gear:'Stajni trap',propMass:'Propeleri',
  motor:'Motor',escMass:'ESC',battery:'Baterijski sklop',avionics:'Avionika',payload:'Korisni teret'
};
const partAliases={
  frame:'centraln\\w* ploc\\w*|nosec\\w* konstrukcij\\w*|tijelo drona|konstrukcij\\w* drona|okvir\\w*|ram(?:a|u|om|ovi)?|krak\\w*|kucist\\w*|oplata\\w*|frame|arms?|airframe|body|shell',
  gear:'stajn\\w* trap\\w*|trap\\w*|nog(?:e|a|ama|ice|icu|icama)|skij\\w*|landing gear',
  propMass:'propeler\\w*|elis\\w*|lopatic\\w*|propellers?|blades?',
  motor:'(?:kucist\\w*|nosac\\w*) (?:motora?|motor\\w*)|motor\\w*',
  escMass:'(?:kucist\\w*|hladnjak\\w*) (?:esc|regulator\\w*)|esc\\w*|regulator\\w* brzine',
  battery:'kucist\\w* (?:baterij\\w*|akumulator\\w*)|baterij\\w*|akumulator\\w*|battery(?: pack| housing)?',
  avionics:'kucist\\w* (?:avionik\\w*|elektronik\\w*)|avionik\\w*|elektronik\\w*|ozicenj\\w*|kablov\\w*|avionics|wiring',
  payload:'kucist\\w* (?:teret\\w*|kamer\\w*|modul\\w*)|korisn\\w* teret\\w*|teret\\w*|kamer\\w*|modul\\w*|payload'
};
const aliases=[
  ['PA-CF (najlon s karbonskim vlaknima)','pa[ -]?(?:6|12)?[ -]?cf|(?:najlon\\w*|nylon) (?:sa? )?(?:ojacan\\w* )?karbonsk\\w* vlakn\\w*'],
  ['PA12 (najlon)','pa[ -]?12|najlon\\w*|nylon\\w*|poliamid\\w*'],
  ['Karbonski kompozit CFRP','cfrp|karbon\\w*|uglji(?:cn|kov)\\w* vlakn\\w*|carbon fib(?:er|re)s?'],
  ['Stakleni kompozit GFRP','gfrp|staklen\\w* (?:kompozit\\w*|vlakn\\w*)|fiberglas\\w*|fibreglas\\w*'],
  ['Aramidni kompozit','aramid\\w*|kevlar\\w*'],
  ['Aluminij 7075-T6','(?:alumin\\w*\\s*)?7075(?:[ -]?t6)?'],
  ['Aluminij 2024-T3','(?:alumin\\w*\\s*)?2024(?:[ -]?t3)?'],
  ['Aluminij 6061-T6','(?:alumin\\w*\\s*)?6061(?:[ -]?t6)?|alumin\\w*'],
  ['Magnezij AZ31B','az31b|magnezij\\w*'],
  ['Titan Ti-6Al-4V','ti[ -]?6al[ -]?4v|titan\\w*'],
  ['Nehrđajući čelik 304','nehrdajuc\\w* celik\\w*(?: 304)?|inox\\w*|stainless(?: steel)?(?: 304)?'],
  ['Čelik 4130','celik\\w*(?: 4130)?|steel(?: 4130)?'],
  ['Bakar','bakar\\w*|bakr\\w*|copper'],
  ['Mesing','mesing\\w*|brass'],
  ['NdFeB magnet','ndfeb(?: magnet\\w*)?|neodim\\w* magnet\\w*'],
  ['PETG','pet[ -]?g(?:-om|-a)?'],['PLA','pla(?:-om|-a)?'],['ABS','abs(?:-om|-a)?'],['ASA','asa(?:-om|-a)?'],
  ['Polikarbonat','polikarbonat\\w*|polycarbonate|pc'],['TPU','tpu(?:-om|-a)?'],['PEEK','peek(?:-om|-a)?'],
  ['POM','pom(?:-om|-a)?|acetal\\w*|delrin\\w*'],
  ['Polipropilen','polipropilen\\w*|polypropylene|pp'],
  ['EPP pjena','epp(?: pjen\\w*)?'],['Balza','balz\\w*|bals\\w*'],
  ['Brezova šperploča','brezov\\w* sperploc\\w*|sperploc\\w*|plywood'],
  ['Silikon','silikon\\w*|silicone']
];
function matcher(entries){
  const ordered=entries.map(([key,alias])=>({key,alias}));
  const groups=ordered.map(({alias},i)=>`(?<a${i}>${alias})`).join('|');
  return {
    pattern:new RegExp(`\\b(?:${groups})\\b`,'g'),
    key:match=>ordered[Object.keys(match.groups).find(key=>match.groups[key]!==undefined).slice(1)].key
  };
}
const componentMatcher=matcher(['gear','propMass','motor','escMass','battery','avionics','payload','frame'].map(key=>[key,partAliases[key]]));
const materialMatcher=matcher(aliases);
const genericPlastic=/\b(?:plastik\w*|plastic|termoplast\w*)\b/g;
const negated=/\b(?:ne|nije|nisu|bez|izbjeci|izbegavati|izbjegavati|umjesto|umesto|not|without)\s+(?:(?:od|koristi|koristiti|je|su|biti)\s+)?$/;
const structural=['frame','gear','propMass'];

export function describeMaterials(description){
  const requested={}, conflicts=new Set(), messages=[];
  function set(key,material){
    if(requested[key]&&requested[key]!==material){delete requested[key];conflicts.add(key);}
    if(!conflicts.has(key))requested[key]=material;
  }
  const clauses=normalize(description).split(/[;\n!?]|\.(?!\d)|\b(?:ali|a za|dok|medjutim|whereas)\b/);
  const globals=new Set();
  for(const clause of clauses){
    const parts=[...clause.matchAll(componentMatcher.pattern)].map(match=>({key:componentMatcher.key(match),start:match.index,end:match.index+match[0].length}));
    const identify=(match,key)=>({key,start:match.index,end:match.index+match[0].length});
    const direct=[...clause.matchAll(materialMatcher.pattern)].map(match=>identify(match,materialMatcher.key(match)));
    const generic=[...clause.matchAll(genericPlastic)].map(match=>identify(match,'PLA')).filter(m=>
      !direct.some(d=>{
        const between=d.start<m.start?clause.slice(d.end,m.start):clause.slice(m.end,d.start);
        return /^\s*$/.test(between);
      }));
    const mentioned=direct.concat(generic).sort((a,b)=>a.start-b.start).filter(m=>!negated.test(clause.slice(0,m.start)));
    if(!mentioned.length)continue;
    if(!parts.length){mentioned.forEach(m=>globals.add(m.key));continue;}
    // In the common "ram od PETG-a, propeleri od najlona" form, each
    // material attaches to the parts since the previous material.
    let boundary=0;
    for(let i=0;i<mentioned.length;i++){
      const m=mentioned[i], next=mentioned[i+1]?.start??clause.length;
      const prior=parts.filter(p=>p.end<=m.start&&p.start>=boundary);
      const following=parts.filter(p=>p.start>=m.end&&p.end<=next);
      const connector=clause.slice(m.end,following[0]?.start??m.end);
      const after=/^\s*(?:za|for)\s*$/.test(connector);
      const related=after&&following.length?following:prior.length?prior:following;
      const assigned=related.length?related:parts.slice(-1);
      for(const p of assigned)set(p.key,m.key);
      boundary=after&&following.length?following.at(-1).end:m.end;
    }
  }
  if(globals.size===1){
    const material=[...globals][0];
    for(const key of structural)if(!requested[key]&&!conflicts.has(key))requested[key]=material;
  }
  if(globals.size>1)messages.push('Opis sadrži više materijala bez naziva dijela. Navedi koji materijal ide na koji dio.');
  for(const key of conflicts)messages.push(names[key]+': navedeno je više različitih materijala za isti red. Odredi jedan materijal za taj red.');
  return {requested,conflicts:[...conflicts],messages};
}
export const materialPartNames=names;
