const standardModel='Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
const compatibleModel='Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
let engine, model;

async function loadEngine(id) {
 const {CreateMLCEngine}=await import('https://esm.run/@mlc-ai/web-llm@0.2.80');
 model=id;
 engine=await CreateMLCEngine(id,{
  initProgressCallback:p=>self.postMessage({type:'progress',text:'Učitavanje AI modela: '+Math.round(p.progress*100)+'% • '+p.text,progress:p.progress})
 });
}

async function generate(data) {
 self.postMessage({type:'progress',text:'AI analizira namjenu i predlaže parametre…'});
 const materials=Object.fromEntries(Object.keys(data.materialParts).map(key=>[key,{type:'string',enum:['',...data.materialNames]}]));
 const schema={type:'object',properties:{
  parameters:{type:'object',properties:data.schema,required:Object.keys(data.schema),additionalProperties:false},
  materials:{type:'object',properties:materials,required:Object.keys(materials),additionalProperties:false},
  explanation:{type:'string'}
 },required:['parameters','materials','explanation'],additionalProperties:false};
 return await engine.chat.completions.create({messages:[{role:'system',content:'You propose CONCEPTUAL multirotor drone configurations. Return all numeric parameters and a short explanation in Bosnian/Serbian Latin. Return catalog material names by part for explicit requests or clearly justified proposals. Use an empty string when no material is proposed. Keep different materials attached to their specific parts. Material parts: '+JSON.stringify(data.materialParts)+'. Respect the user mission and explicitly explain conflicts and assumptions; do not claim flight certification. Component performance is estimated, not measured. Keep requested mission duration in target even if infeasible. Use plausible matched battery mass and capacity, motor thrust and power; ensure propeller clearance. KV and pitch alone do not establish thrust. Never silently lower explicit payload, mission time or reserve to make a mission pass. If previousDescription is provided, revise the CURRENT configuration to reflect changes in the new description; preserve unrelated parameters unless a dependent engineering change is necessary, and explain dependent changes. Previous description: '+JSON.stringify(data.previousDescription)+'. Current configuration: '+JSON.stringify(data.current)}, {role:'user',content:data.description}],temperature:0.2,max_tokens:1800,response_format:{type:'json_object',schema:JSON.stringify(schema)}});
}

self.onmessage=async({data})=>{
 try {
  if(!engine){
   const adapter=await navigator.gpu?.requestAdapter();
   if(!adapter) throw new Error('Preglednik nije mogao pokrenuti WebGPU adapter.');
   model=adapter.features.has('shader-f16')?standardModel:compatibleModel;
  }
  let reply;
  try {
   if(!engine) await loadEngine(model);
   reply=await generate(data);
  } catch(error) {
   const message=String(error?.message||error);
   if(model===compatibleModel||!/shader|compute stage|pipeline|device lost|out of memory|shader-f16/i.test(message))throw error;
   try { await engine?.unload(); } catch {}
   engine=null;
   self.postMessage({type:'progress',text:'Grafički procesor je odbio jezgru modela. Učitavam manji FP32 model…'});
   await loadEngine(compatibleModel);
   reply=await generate(data);
  }
  self.postMessage({type:'result',content:reply.choices[0].message.content});
 } catch(error) {
  const detail=String(error?.message||error);
  const message=/shader|compute stage|pipeline|device lost/i.test(detail)
   ? 'WebGPU nije mogao pokrenuti grafičku jezgru lokalnog modela. Provjeri hardversko ubrzanje i upravljački program grafike.'
   : detail.slice(0,400);
  self.postMessage({type:'error',message});
 }
};
