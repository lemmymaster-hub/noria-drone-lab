export const groups=[['frame','01 / Ram i geometrija',[['n','Broj motora',6,4,8,2],['span','Prečnik kruga motora (mm)',1000,200,2500,10],['body','Dužina tijela (mm)',310,120,700,10],['frame','Masa rama (kg)',1.4,.1,20,.1],['gear','Stajni trap (kg)',.3,0,5,.05]]],['motor','02 / Motori i ESC',[['kv','Motor KV (rpm/V)',380,50,3000,10],['motor','Masa motora / kom. (kg)',.23,.01,3,.01],['thrust','Maks. potisak / motor (kgf)',3.5,.1,30,.1],['maxW','Snaga / motor pri maks. potisku (W)',650,10,8000,10],['esc','ESC struja / motor (A)',60,5,300,1],['escMass','ESC masa / kom. (kg)',.055,.005,1,.005]]],['prop','03 / Propeleri i aerodinamika',[['diam','Prečnik propelera (in)',18,3,40,.5],['pitch','Korak propelera (in)',6,1,20,.1],['propMass','Masa propelera / kom. (kg)',.035,.005,1,.005],['cd','Koeficijent otpora Cd',1.1,.1,3,.05],['area','Čeona površina (m²)',.12,.01,3,.01],['eff','Efikasnost lebdenja (0–1)',.62,.2,.9,.01]]],['battery','04 / Baterija i napajanje',[['cells','Broj ćelija LiPo (S)',6,2,24,1],['capacity','Kapacitet (mAh)',22000,500,100000,100],['battery','Masa baterije (kg)',2.6,.1,30,.1],['rating','Kontinuirani C rating',15,1,150,1],['reserve','Rezerva energije (%)',25,10,60,1]]],['payload','05 / Korisni teret i avionika',[['payload','Korisni teret (kg)',1,0,30,.1],['avionics','Avionika i kablovi (kg)',.4,.05,5,.05],['aux','Potrošnja elektronike (W)',25,0,500,1],['link','Procijenjen domet veze (km)',8,.1,100,.1],['cg','Pomak težišta od centra (mm)',0,0,200,1]]],['mission','06 / Misija i okruženje',[['speed','Ciljana brzina kroz vazduh (m/s)',12,1,50,.5],['wind','Čeoni vjetar (m/s)',3,0,30,.5],['alt','Visina terena AMSL (m)',600,0,6000,10],['agl','Visina leta AGL (m)',100,0,1500,10],['temp','Temperatura (°C)',20,-30,50,1],['target','Željeno trajanje (min)',25,1,180,1],['radius','Traženi povratni radijus (km, 0 = automatska procjena)',0,0,100,.1]]]];

export const fields = groups.flatMap(group => group[2]);
export const defaults = Object.fromEntries(fields.map(([id,,value]) => [id,value]));
export const empty = Object.fromEntries(fields.map(([id]) => [id,0]));
const motorCounts = [4,6,8];
export function parameterProblems(p, partial = false) {
  return fields.filter(([id,, ,min,max]) => {
    if (partial && !Object.hasOwn(p,id)) return false;
    const v = p[id];
    return !Number.isFinite(v) || v < min || v > max ||
      (id === 'n' && !motorCounts.includes(v)) || (id === 'cells' && !Number.isInteger(v));
  }).map(([field,label]) => ({field,message:label + ': unesi valjanu vrijednost u granicama polja.'}));
}

export function geometryProblems(p){
  return parameterProblems({n:p.n,span:p.span,body:p.body,diam:p.diam},true);
}
