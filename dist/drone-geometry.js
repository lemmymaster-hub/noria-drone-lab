import * as THREE from './three.module.js';

// The viewport and CAD export use the same geometry in millimetres.
export function buildDroneGeometry(p, assembly, mats, exploded=false,volumes={}){
function mesh(geo,mat,id,pos,parent=assembly){let m=new THREE.Mesh(geo,mat.clone());m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;m.userData.part=id;m.userData.materialKey=id;parent.add(m);return m}function part(m,name,key,fit){m.name=name;m.userData.materialKey=key;m.userData.printOrientation=fit;return m;}function cube(x,y,z,w,h,d,mat,id,parent){return mesh(new THREE.BoxGeometry(w,h,d),mat,id,[x,y,z],parent)}function cyl(x,y,z,r,h,mat,id,parent){return mesh(new THREE.CylinderGeometry(r,r,h,40),mat,id,[x,y,z],parent)}function tube(a,b,r,mat,id){let av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),20),mat,id,av.clone().add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m}function wire(points,col,id){let curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));const cable=mesh(new THREE.TubeGeometry(curve,30,2.4,8,false),mats.black,id,[0,0,0]);cable.material.color.setHex(col);cable.userData.materialKey=null}
const rotors=[];let ex=exploded?150:0,L=p.body,W=L*.72;
part(cube(0,-15,0,L,10,W,mats.carbon,'frame'),'Donja-ploca','frame','flat');
part(cube(0,22,0,L*.94,10,W*.94,mats.carbon,'frame'),'Gornja-ploca','frame','flat');
for(const x of [-L*.4,L*.4])for(const z of [-W*.4,W*.4]){
  part(cyl(x,4,z,5,36,mats.metal,'frame'),'Distancer',null);
  part(cyl(x,29,z,6,3,mats.metal,'frame'),'Vijak',null);
}
part(cube(0,42,0,L*.65,28,W*.7,mats.black,'frame'),'Kuciste','frame','flat');
cube(0,81+ex,0,L*.76,58,W*.58,mats.battery,'battery');for(let x of [-L*.23,L*.23])cube(x,81+ex,0,19,63,W*.61,mats.rubber,'battery');cube(0,113+ex,0,L*.29,1,33,mats.green,'battery');wire([[L*.3,75+ex,10],[L*.47,70+ex,5],[L*.47,20,0],[L*.25,15,0]],0xc73724,'battery');wire([[L*.3,75+ex,-10],[L*.5,65+ex,-5],[L*.5,18,0]],0x111111,'battery');cube(L*.45,39,0,17,12,23,mats.red,'battery');
if(p.gear>0)for(const z of [-W*.65,W*.65]){
  for(const x of [-L*.33,L*.33])part(tube([x,-17,z*.45],[x,-132,z],7,mats.carbon,'frame'),'Noga','gear','tube');
  part(tube([-L*.65,-135,z],[L*.65,-135,z],8,mats.carbon,'frame'),'Sina','gear','tube');
  for(const x of [-L*.5,L*.5])part(cyl(x,-144,z,12,15,mats.rubber,'frame'),'Stopica','gear','flat');
}
if(p.payload>0){
  part(cube(0,-55-ex,0,90,45,85,mats.metal,'payload'),'Kuciste-tereta','payload','flat');
  let cam=part(cyl(0,-92-ex,17,32,42,mats.black,'payload'),'Kamera','payload','flat');cam.rotation.x=Math.PI/2;
  let lens=part(cyl(0,-92-ex,42,23,8,mats.lens??mats.metal,'payload'),'Objektiv',null);lens.rotation.x=Math.PI/2;
}
part(tube([0,55,-W*.33],[0,155,-W*.33],3,mats.black,'payload'),'Antena','avionics','tube');
part(cyl(0,160,-W*.33,20,8,mats.battery,'payload'),'Avionika','avionics','flat');
for(let i=0;i<p.n;i++){let angle=i*2*Math.PI/p.n+Math.PI/4,x=Math.cos(angle)*p.span/2,z=Math.sin(angle)*p.span/2;part(tube([0,0,0],[x,0,z],13,mats.carbon,'frame'),'Krak-'+(i+1),'frame','tube');let esc=part(cube(x*.63,16,z*.63,65,13,27,mats.black,'motor'),'ESC','escMass','flat');esc.rotation.y=-angle;esc.userData.materialKey='escMass';wire([[x*.5,16,z*.5],[x*.75,17,z*.75],[x,15,z]],i%2?0x982f24:0x22262c,'motor');part(cyl(x,9,z,36,8,mats.carbon,'motor'),'Podloga-motora-'+(i+1),'frame','flat');cyl(x,31+ex*.25,z,27,37,mats.black,'motor');cyl(x,50+ex*.25,z,29,10,mats.red,'motor');for(let j=0;j<12;j++){let t=j*Math.PI/6;cube(x+Math.cos(t)*26,33+ex*.25,z+Math.sin(t)*26,3,25,3,mats.metal,'motor')}cyl(x,59+ex*.25,z,7,17,mats.metal,'motor');let rotor=new THREE.Group();rotor.position.set(x,66+ex,z);rotor.userData.part='prop';assembly.add(rotor);rotors.push(rotor);const radius=p.diam*25.4/2, chord=Math.min(1,radius/85);
for(let flip of [0,Math.PI]){let shape=new THREE.Shape();shape.moveTo(7*chord,-7*chord);shape.bezierCurveTo(radius*.3,-8*chord,radius*.6,-27*chord,radius*.94,-15*chord);shape.quadraticCurveTo(radius,-8*chord,radius*.98,0);shape.bezierCurveTo(radius*.7,10*chord,radius*.4,17*chord,12*chord,9*chord);shape.closePath();let blade=mesh(new THREE.ExtrudeGeometry(shape,{depth:2.5,bevelEnabled:true,bevelSize:1,bevelThickness:1,bevelSegments:2,steps:1}),mats.carbon,'prop',[0,0,0],rotor);part(blade,'Lopatica-maketa','propMass','blade');blade.rotation.x=-Math.PI/2;blade.rotation.z=flip;part(cube(Math.cos(flip)*radius*.8,2,0,17*chord,3,13*chord,mats.metal,'prop',rotor),'Oznaka-lopatice',null)}cyl(0,4,0,13,10,mats.metal,'prop',rotor).userData.materialKey='propMass';rotor.rotation.y=angle}

for(const key of ['frame','gear','propMass']){
  if(!(volumes[key]>0))continue;
  const pieces=[];
  assembly.traverse(object=>{if(object.userData.materialKey===key)pieces.push(object);});
  const baseline=pieces.reduce((sum,piece)=>sum+geometryVolume(piece.geometry),0)/(key==='propMass'?p.n:1);
  if(!baseline)continue;
  const factor=volumes[key]/baseline;
  for(const piece of pieces){
    if(piece.userData.printOrientation==='tube')piece.scale.set(Math.sqrt(factor),1,Math.sqrt(factor));
    else if(piece.userData.printOrientation==='blade')piece.scale.z=factor;
    else piece.scale.y=factor;
  }
}
return rotors;
}

export function geometryVolume(geometry){
  const {index}=geometry, position=geometry.getAttribute('position');
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  let volume=0;
  for(let i=0;i<(index?.count??position.count);i+=3){
    a.fromBufferAttribute(position,index?index.getX(i):i);
    b.fromBufferAttribute(position,index?index.getX(i+1):i+1);
    c.fromBufferAttribute(position,index?index.getX(i+2):i+2);
    volume+=a.dot(b.cross(c));
  }
  return Math.abs(volume)/6000;
}

export function sweptRotorObstruction(parameters,volumes){
  const assembly=new THREE.Group(), template=new THREE.MeshStandardMaterial();
  const materials=Object.fromEntries(['carbon','metal','black','battery','rubber','green','red'].map(key=>[key,template]));
  const rotors=buildDroneGeometry(parameters,assembly,materials,false,volumes);
  try{
    assembly.updateMatrixWorld(true);
    const radius=parameters.diam*25.4/2;
    const fixed=assembly.children.filter(mesh=>mesh.isMesh&&(
      ['frame','gear','avionics','payload'].includes(mesh.userData.materialKey)||mesh.userData.part==='battery'));
    const boxes=fixed.map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh)}));
    for(let i=0;i<rotors.length;i++){
      const rotor=rotors[i];
      const swept=new THREE.Box3();
      for(const blade of rotor.children.filter(mesh=>mesh.userData.printOrientation==='blade'))
        swept.union(new THREE.Box3().setFromObject(blade));
      const {x,z}=rotor.position;
      for(const {mesh,box} of boxes){
        if(box.max.y<swept.min.y||box.min.y>swept.max.y)continue;
        const dx=Math.max(box.min.x-x,x-box.max.x,0),dz=Math.max(box.min.z-z,z-box.max.z,0);
        if(Math.hypot(dx,dz)<=radius)return {rotor:i+1,part:mesh.name||'baterija ili njena oprema'};
      }
    }
    return null;
  }finally{
    assembly.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
    template.dispose();
  }
}
