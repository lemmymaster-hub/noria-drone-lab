import * as THREE from './three.module.js';
import {buildDroneGeometry} from './drone-geometry.js';
import {config, selectGroup} from './configuration.js';
import {geometryProblems} from './fields.mjs';
import {structuralDesign} from './materials.js';

const p=config;
let ready=false;
const modelReady=()=>ready;
let yaw=.65,tilt=.55,zoom=1,pan=[0,0],exploded=false,spinning=false,selected='frame';
let canvas=document.querySelector('#c');
let design=structuralDesign();
window.addEventListener('drone-config-change',()=>{design=structuralDesign();ready=!geometryProblems(p).length;});
const modelKey=()=>JSON.stringify([p.n,p.span,p.body,p.diam,p.gear>0,p.payload>0,exploded,design]);
const select=selectGroup;
window.addEventListener('drone-part-selected',event=>{selected=event.detail;});
function webGL(canvas,renderer){
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,1,15000),assembly=new THREE.Group();scene.add(assembly);scene.add(new THREE.HemisphereLight(0xd8eaff,0x303138,2.4));
for(const [x,y,z,power]of [[700,1400,800,4],[-1000,700,-400,3],[300,500,-1000,2]]){let l=new THREE.DirectionalLight(0xe4f4ff,power);l.position.set(x,y,z);scene.add(l);if(y===1400){l.castShadow=true;l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-1600,right:1600,top:1600,bottom:-1600,near:1,far:5000});l.shadow.bias=-.001}}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12000,12000),new THREE.MeshStandardMaterial({color:0x111c29,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-180;floor.receiveShadow=true;scene.add(floor);let grid=new THREE.GridHelper(6000,40,0x34495b,0x233345);grid.position.y=-179;scene.add(grid);
const texcanvas=document.createElement('canvas');texcanvas.width=texcanvas.height=128;const tc=texcanvas.getContext('2d');tc.fillStyle='#171c21';tc.fillRect(0,0,128,128);for(let x=0;x<128;x+=8)for(let y=0;y<128;y+=8){tc.fillStyle=(x/8+y/8)%2?'#30373b':'#11171b';tc.fillRect(x,y,7,7);tc.fillStyle='#ffffff10';tc.fillRect(x,y,2,7)}let weave=new THREE.CanvasTexture(texcanvas);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(4,4);
const mats={carbon:new THREE.MeshStandardMaterial({color:0x485057,map:weave,metalness:.55,roughness:.38}),metal:new THREE.MeshStandardMaterial({color:0x8b98a2,metalness:.85,roughness:.25}),black:new THREE.MeshStandardMaterial({color:0x161a20,metalness:.35,roughness:.45}),red:new THREE.MeshStandardMaterial({color:0xa52a20,metalness:.55,roughness:.35}),battery:new THREE.MeshStandardMaterial({color:0x34424d,metalness:.2,roughness:.6}),green:new THREE.MeshStandardMaterial({color:0x19a88c,metalness:.35,roughness:.3}),rubber:new THREE.MeshStandardMaterial({color:0x090c0f,roughness:.95})};let signature='',rotors=[], viewportWidth=0, viewportHeight=0;
function rebuild(){
 for(const child of [...assembly.children]){
  assembly.remove(child);
  child.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
 }
 rotors = modelReady() ? buildDroneGeometry(p,assembly,mats,exploded,design) : [];
}
window.addEventListener('drone-flight-frame',e=>{let f=e.detail;assembly.position.set(f.x,f.y,f.z);assembly.rotation.set(f.pitch,0,f.roll);});
const raycaster=new THREE.Raycaster();function pick(x,y){if(!modelReady())return;raycaster.setFromCamera(new THREE.Vector2(x/canvas.clientWidth*2-1,-y/canvas.clientHeight*2+1),camera);let hit=raycaster.intersectObjects(assembly.children,true)[0];if(hit)select(hit.object.userData.part)}
function draw(now){
  const width=canvas.clientWidth, height=canvas.clientHeight;
  if(width && height){
    if(width!==viewportWidth || height!==viewportHeight){
      renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
      viewportWidth=width;viewportHeight=height;
    }
    const key=modelKey();
    if(key!==signature){signature=key;rebuild();}
    const distance=Math.max(550,(p.span+p.diam*25.4)*1.5,2.2*p.body)*Math.max(1,1/camera.aspect)/zoom;
    const ct=Math.cos(tilt), target=new THREE.Vector3(-pan[0]*1.8,pan[1]*1.8,0);
    camera.position.set(Math.sin(yaw)*ct*distance,Math.sin(tilt)*distance,Math.cos(yaw)*ct*distance).add(target);
    camera.lookAt(target);
    const delta=Math.min(50,now-(draw.previous??now));
    if(spinning)yaw+=delta*.00012;
    if(spinning||window.droneFlightActive)rotors.forEach((r,i)=>r.rotation.y+=(i%2?1:-1)*delta*.024);
    assembly.traverse(o=>{if(o.isMesh)o.material.emissive?.setHex(o.userData.part===selected?0x06322a:0);});
    renderer.render(scene,camera);
  }
  draw.previous=now;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
return pick;
}
function wireframe(canvas,ctx){
  const colors={carbon:0x425b6e,metal:0x8298ac,black:0x253442,battery:0x375e73,red:0xaa473d,green:0x369686,rubber:0x273341};
  const palette=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color})]));
  const assembly=new THREE.Group(), vertex=new THREE.Vector3();
  let signature='',cameraKey='',meshes=[],rotors=[],hits=[],previous=0;
  window.addEventListener('drone-flight-frame',event=>{
    const {x,y,z,pitch,roll}=event.detail;
    assembly.position.set(x,y,z);assembly.rotation.set(pitch,0,roll);cameraKey='';
  });

  function rebuild(){
    for(const {mesh} of meshes){mesh.geometry.dispose();mesh.material.dispose();}
    assembly.clear();
    meshes=[];
    rotors=modelReady()?buildDroneGeometry(p,assembly,palette,exploded,design):[];
    assembly.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const positions=mesh.geometry.getAttribute('position'), unique=new Map();
      for(let i=0;i<positions.count;i++){
        vertex.fromBufferAttribute(positions,i);
        const key=vertex.toArray().map(value=>value.toFixed(3)).join(',');
        if(!unique.has(key))unique.set(key,vertex.clone());
      }
      meshes.push({mesh,positions:[...unique.values()],color:'#'+mesh.material.color.getHexString()});
    });
  }
  function outline(points){
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const chain=list=>{
      const result=[];
      for(const point of list){
        while(result.length>1&&cross(result.at(-2),result.at(-1),point)<=0)result.pop();
        result.push(point);
      }
      return result.slice(0,-1);
    };
    return chain(points).concat(chain(points.reverse()));
  }
  function draw(now){
    requestAnimationFrame(draw);
    if(now-previous<30)return;
    const delta=Math.min(60,now-previous);previous=now;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    const nextSignature=modelKey();
    if(signature!==nextSignature){signature=nextSignature;rebuild();cameraKey='';}
    const dpr=Math.min(2,devicePixelRatio||1);
    if(spinning)yaw+=delta*.00012;
    if(spinning||window.droneFlightActive)rotors.forEach((rotor,i)=>rotor.rotation.y+=(i%2?1:-1)*delta*.024);
    const nextCamera=JSON.stringify([w,h,dpr,yaw,tilt,zoom,pan,selected]);
    if(nextCamera===cameraKey&&!window.droneFlightActive)return;
    cameraKey=nextCamera;
    const px=Math.round(w*dpr),py=Math.round(h*dpr);
    if(canvas.width!==px||canvas.height!==py){canvas.width=px;canvas.height=py;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const scale=Math.min(w,h)*zoom/Math.max(550,(p.span+p.diam*25.4)*1.15,1.7*p.body);
    const cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
    const project=({x,y,z})=>{
      const depth=x*sy+z*cy;
      return [w/2+(x*cy-z*sy)*scale+pan[0],h*.52-(y*ct-depth*st)*scale+pan[1],y*st+depth*ct];
    };
    ctx.strokeStyle='#253648';
    for(let i=-1200;i<=1200;i+=150)for(const [a,b] of [
      [{x:i,y:-180,z:-1200},{x:i,y:-180,z:1200}],
      [{x:-1200,y:-180,z:i},{x:1200,y:-180,z:i}]]){
      ctx.beginPath();ctx.moveTo(...project(a).slice(0,2));ctx.lineTo(...project(b).slice(0,2));ctx.stroke();
    }
    assembly.updateMatrixWorld(true);
    hits=meshes.map(({mesh,positions,color})=>{
      const points=positions.map(position=>project(vertex.copy(position).applyMatrix4(mesh.matrixWorld)));
      const depth=points.reduce((sum,point)=>sum+point[2],0)/points.length;
      return {points:outline(points),depth,color,id:mesh.userData.part};
    }).sort((a,b)=>a.depth-b.depth);
    for(const {points,color,id} of hits){
      if(points.length<3)continue;
      ctx.beginPath();
      points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
      ctx.fillStyle=color;ctx.fill();
      ctx.strokeStyle=id===selected?'#65ffe0':'#7895a544';ctx.stroke();
    }
  }
  requestAnimationFrame(draw);
  return (x,y)=>{
    for(let i=hits.length-1;i>=0;i--){
      const {points,id}=hits[i];
      let inside=false;
      for(let j=0,k=points.length-1;j<points.length;k=j++){
        const [ax,ay]=points[j],[bx,by]=points[k];
        if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
      }
      if(inside){select(id);return;}
    }
  };
}
let renderer, pick;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});}catch{}
if(renderer){
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.3;
  pick=webGL(canvas,renderer);
}else{
  let ctx=canvas.getContext('2d');
  if(!ctx){
    const replacement=canvas.cloneNode();
    canvas.replaceWith(replacement);canvas=replacement;
    ctx=canvas.getContext('2d');
  }
  pick=ctx?wireframe(canvas,ctx):()=>{};
  document.querySelector('#viewport .badge').textContent=ctx?'REZERVNI PRIKAZ / 2D PROJEKCIJA':'GRAFIČKI PRIKAZ NEDOSTUPAN';
}
const pointers=new Map();
let moved=0,lastDistance=0,multiTouch=false;
function pickEvent(event){
  const rect=canvas.getBoundingClientRect();
  pick(event.clientX-rect.left,event.clientY-rect.top);
}
canvas.onpointerdown=event=>{
  if(event.button===2)return;
  canvas.setPointerCapture(event.pointerId);
  if(!pointers.size){moved=0;multiTouch=false;}
  pointers.set(event.pointerId,[event.clientX,event.clientY]);
  if(pointers.size>1)multiTouch=true;
  lastDistance=0;
};
canvas.onpointermove=event=>{
  const old=pointers.get(event.pointerId);
  if(!old)return;
  pointers.set(event.pointerId,[event.clientX,event.clientY]);
  const dx=event.clientX-old[0],dy=event.clientY-old[1];
  moved+=Math.abs(dx)+Math.abs(dy);
  if(pointers.size>=2){
    const [a,b]=pointers.values(),distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
    if(lastDistance)zoom=clampZoom(zoom*distance/lastDistance);
    lastDistance=distance;pan[0]+=dx/2;pan[1]+=dy/2;
  }else if(event.shiftKey||event.buttons===4){
    pan[0]+=dx;pan[1]+=dy;
  }else{
    yaw+=dx*.008;tilt=Math.max(-1.5,Math.min(1.5,tilt+dy*.008));
  }
};
canvas.onpointerup=event=>{
  if(!pointers.delete(event.pointerId))return;
  lastDistance=0;
  if(event.button===0&&!multiTouch&&moved<6)pickEvent(event);
};
canvas.onpointercancel=canvas.onlostpointercapture=event=>{pointers.delete(event.pointerId);lastDistance=0;};
canvas.oncontextmenu=event=>{event.preventDefault();pickEvent(event);};
const clampZoom=value=>Math.max(.25,Math.min(4,value));
canvas.onwheel=event=>{event.preventDefault();zoom=clampZoom(zoom*Math.exp(-event.deltaY*.001));};
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
  yaw=button.dataset.view==='iso'?.65:0;
  tilt=button.dataset.view==='top'?Math.PI/2-.001:button.dataset.view==='side'?0:.55;
  pan=[0,0];
});
document.querySelector('#reset').onclick=()=>{zoom=1;pan=[0,0];yaw=.65;tilt=.55;};
document.querySelector('#explode').onclick=event=>event.currentTarget.classList.toggle('active',exploded=!exploded);
document.querySelector('#spin').onclick=event=>event.currentTarget.classList.toggle('active',spinning=!spinning);
