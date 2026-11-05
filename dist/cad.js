import {buildDroneGeometry,geometryVolume} from './drone-geometry.js';
import {Group,MeshStandardMaterial,Vector3} from './three.module.js';
import {propellerGap} from './physics.mjs';
import {geometryProblems} from './fields.mjs';

function placeOnBed(geometry,bed){
  geometry.computeBoundingBox();
  const size=geometry.boundingBox.getSize(new Vector3());
  if((size.x>bed[0]||size.y>bed[1])&&size.y<=bed[0]&&size.x<=bed[1]){
    geometry.rotateZ(Math.PI/2);
    geometry.computeBoundingBox();
  }
  const center=geometry.boundingBox.getCenter(new Vector3());
  geometry.translate(-center.x,-center.y,-geometry.boundingBox.min.z);
  geometry.computeBoundingBox();
  return geometry.boundingBox.getSize(size).toArray();
}

export function binaryStl(geometry){
  const position=geometry.getAttribute('position'),{index}=geometry;
  const vertices=[new Vector3(),new Vector3(),new Vector3()];
  const edge=new Vector3(),normal=new Vector3();
  const count=(index?.count??position.count)/3;
  const buffer=new ArrayBuffer(84+count*50), view=new DataView(buffer);
  new Uint8Array(buffer,0,80).set(new TextEncoder().encode('Noria Drone Lab - prototype geometry - mm'));
  let triangles=0;
  for(let i=0;i<count;i++){
    for(let j=0;j<3;j++){
      const k=i*3+j;
      const vertex=vertices[j].fromBufferAttribute(position,index?index.getX(k):k);
      if(![vertex.x,vertex.y,vertex.z].every(Number.isFinite))
        throw new Error('STL sadrži neispravnu koordinatu.');
    }
    normal.subVectors(vertices[1],vertices[0]).cross(edge.subVectors(vertices[2],vertices[0]));
    if(normal.lengthSq()<1e-18)continue;
    normal.normalize();
    let offset=84+triangles++*50;
    for(const vector of [normal,...vertices]){
      for(const value of [vector.x,vector.y,vector.z]){
        view.setFloat32(offset,value,true);
        offset+=4;
      }
    }
  }
  if(!triangles)throw new Error('Geometrija nema STL površina.');
  view.setUint32(80,triangles,true);
  return new Uint8Array(buffer,0,84+triangles*50);
}

const labels={frame:'Ram',gear:'Stajni-trap',propMass:'Propeler-maketa',motor:'Motor-gabarit',
  escMass:'ESC-gabarit',battery:'Baterija-gabarit',avionics:'Avionika-gabarit',payload:'Teret-gabarit'};

export function planCad(params,bed,{selections,volumes,structural,printableMaterials}){
  const {n,span,body}=params;
  if(geometryProblems(params).length||!Array.isArray(bed)||bed.length!==2||
     !bed.every(value=>Number.isFinite(value)&&value>0))
    throw new Error('Unesi broj motora, dimenzije drona i dimenzije ploče printera.');
  if(body>=span)throw new Error('Dužina tijela mora biti manja od prečnika kruga motora.');
  const materialTemplate=new MeshStandardMaterial();
  const palette=Object.fromEntries(['carbon','metal','black','battery','rubber','green','red'].map(key=>[key,materialTemplate]));
  const scene=new Group(),entries=[],dimensions=[];
  buildDroneGeometry(params,scene,palette,false,structural);
  try{
    scene.traverse(object=>{
      if(!object.isMesh||!Object.hasOwn(labels,object.userData.materialKey))return;
      const key=object.userData.materialKey, material=selections[key]||'Ručna masa';
      const printable=printableMaterials.has(material);
      const name=String(dimensions.length+1).padStart(2,'0')+'-'+labels[key]+(object.name?'-'+object.name:'');
      const geometry=object.geometry.clone().scale(object.scale.x,object.scale.y,object.scale.z);
      try{
        if(object.userData.printOrientation==='flat'||(key==='battery'&&object.geometry.type==='BoxGeometry'))
          geometry.rotateX(Math.PI/2);
        const sizeMm=placeOnBed(geometry,bed);
        const volumeCm3=geometryVolume(geometry);
        if(!sizeMm.every(value=>Number.isFinite(value)&&value>0)||!(volumeCm3>0))
          throw new Error('Neispravna geometrija dijela: '+name);
        const fits=sizeMm[0]<=bed[0]+1e-4&&sizeMm[1]<=bed[1]+1e-4;
        dimensions.push({name,key,quantity:1,sizeMm,fits,material,printable,volumeCm3});
        if(printable)entries.push([name+'.stl',binaryStl(geometry)]);
      }finally{geometry.dispose();}
    });
  }finally{
    scene.traverse(object=>{if(object.isMesh){object.geometry.dispose();object.material.dispose();}});
    materialTemplate.dispose();
  }
  const motors=Array.from({length:n},(_,i)=>{
    const angle=i*2*Math.PI/n+Math.PI/4;
    return {x:span/2*Math.cos(angle),y:span/2*Math.sin(angle)};
  });
  const materialVolumes=Object.keys(labels).map(key=>{
    const count=['propMass','motor','escMass'].includes(key)?n:1;
    const modelCm3=dimensions.filter(part=>part.key===key).reduce((sum,part)=>sum+part.volumeCm3,0)/count;
    return {key,configuredCm3:volumes[key]||0,modelCm3,configuredKg:params[key],
      perMotor:count!==1,matchedToModel:structural[key]>0};
  });
  return {entries,dimensions,materialVolumes,motors,propellerGapMm:propellerGap(params)*1000};
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zip(entries) {
  const local = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const [filename, bytes] of entries) {
    const name = new TextEncoder().encode(filename);
    const crc = crc32(bytes);
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, bytes.length, true);
    header.setUint32(22, bytes.length, true);
    header.setUint16(26, name.length, true);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, bytes.length, true);
    entry.setUint32(24, bytes.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    local.push(header.buffer, name, bytes);
    directory.push(entry.buffer, name);
    offset += 30 + name.length + bytes.length;
    directorySize += 46 + name.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...local, ...directory, end.buffer], {type:'application/zip'});
}
