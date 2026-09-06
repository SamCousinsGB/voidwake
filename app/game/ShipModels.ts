import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACTIONS, SHIPS, type ShipClass, type FactionId } from './world.ts';

export function disposeModel(object:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 object.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

/** Bakes static hull detail into one draw call per material; engines stay animated. */
function bake(group:THREE.Group){
 group.updateMatrixWorld(true);const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();const keep:THREE.Object3D[]=[];
 for(const o of [...group.children]){const mesh=o as THREE.Mesh;if(!mesh.isMesh||mesh.name==='engine'){keep.push(o);continue;}const material=mesh.material as THREE.Material;const transformed=mesh.geometry.clone().applyMatrix4(mesh.matrix);const g=transformed.index?transformed.toNonIndexed():transformed;if(g!==transformed)transformed.dispose();const geometries=buckets.get(material)??[];geometries.push(g);buckets.set(material,geometries);mesh.geometry.dispose();}
 group.clear();for(const [mat,geometries] of buckets){const merged=mergeGeometries(geometries);if(merged)group.add(new THREE.Mesh(merged,mat));geometries.forEach(g=>g.dispose());}for(const o of keep)group.add(o);return group;
}

export function makeShip(id:ShipClass='courier',pirate=false){
 const spec=SHIPS[id],f=FACTIONS[spec.faction],t=spec.tier;const group=new THREE.Group();
 const hull=new THREE.MeshStandardMaterial({color:f.hull,metalness:.72,roughness:.33});
 const plate=new THREE.MeshStandardMaterial({color:new THREE.Color(f.hull).multiplyScalar(1.22),metalness:.58,roughness:.4});
 const dark=new THREE.MeshStandardMaterial({color:f.dark,metalness:.85,roughness:.38});
 const trim=new THREE.MeshStandardMaterial({color:pirate?'#98413c':f.secondary,metalness:.62,roughness:.3});
 const glow=new THREE.MeshBasicMaterial({color:pirate?'#ff684e':f.color});
 const windowMat=new THREE.MeshBasicMaterial({color:'#fff4d4'});
 const add=(geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material=hull)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 const ellipsoid=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material=hull)=>{const m=add(new THREE.SphereGeometry(1,32,16),mat,x,y,z);m.scale.set(w,h,d);return m;};
 const plateShape=(points:number[][],depth:number,z:number,mat:THREE.Material=hull)=>{const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return add(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:1.2,bevelSize:1.3,bevelSegments:2,curveSegments:20}),mat,0,0,z);};
 const ring=(r:number,tube:number,x:number,y:number,z:number,mat:THREE.Material=hull)=>add(new THREE.TorusGeometry(r,tube,8,64),mat,x,y,z);
 const engine=(x:number,y:number,width=4,length=28)=>{
  box(width*2,length,6,x,y,5,hull);box(width*.8,length-4,1,x,y,8.5,dark);box(width*.55,length-6,.7,x,y,9.2,glow);
  ellipsoid(width,width*.55,2,x,y-length/2,5,glow);
  const plume=add(new THREE.ConeGeometry(width*.85,22,12),new THREE.MeshBasicMaterial({color:pirate?'#ff653b':f.color,transparent:true,opacity:.68,depthWrite:false,blending:THREE.AdditiveBlending}),x,y-length/2-11,5);plume.rotation.z=Math.PI;plume.name='engine';plume.userData.baseY=plume.position.y;
 };
 const windows=(x:number,y:number,count:number,horizontal=false)=>{for(let i=0;i<count;i++)box(horizontal?1.2:.7,horizontal?.7:1.3,.3,x+(horizontal?i*2.7:0),y+(horizontal?0:i*3.1),14,windowMat);};
 const turret=(x:number,y:number)=>{ellipsoid(3,3,2,x,y,11,dark);box(1.2,9,1.2,x,y+3,13,plate);};

 if(spec.faction==='union'){
  // Layered command saucer, neck, drive hull, and separated warp nacelles.
  const radius=19+t*2;ellipsoid(radius,radius*.78,4.7,0,21,6,hull);ellipsoid(radius*.82,radius*.64,1.8,0,21,10,plate);ring(radius*.68,.65,0,21,11,trim).scale.y=.78;
  box(9,32,5,0,-1,3,dark);ellipsoid(9,24,6,0,-16,3,hull);ellipsoid(5,6,2,0,24,12,dark);box(4,6,1,0,25,14,glow);
  for(const side of [-1,1]){const wing=box(22,6,3,side*17,-7,2,trim);wing.rotation.z=side*.3;engine(side*(26+t*2),-10,3.3,35+t*3);windows(side*8,12,5);turret(side*13,29);}
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const m=box(1,3,.5,Math.cos(a)*(radius-3),21+Math.sin(a)*(radius-3)*.78,10.5,dark);m.rotation.z=a;}
  if(t>=2){engine(0,-27,3,26);for(const side of [-1,1])box(7,14,5,side*13,-21,6,plate);}
  if(t===3){ring(12,.9,0,21,12,glow).scale.y=.78;turret(-17,-12);turret(17,-12);}
 }else if(spec.faction==='traders'){
  box(13,73,8,0,0,3,dark);plateShape([[0,42],[11,28],[9,7],[-9,7],[-11,28]],7,4);box(8,11,4,0,25,12,plate);box(6,4,1,0,29,15,glow);
  const rows=2+(t>1?1:0);for(const side of [-1,1]){for(let i=0;i<rows;i++){const y=9-i*16;box(16,13,10,side*18,y,4,hull);box(13,10,1,side*18,y,10,trim);for(let j=0;j<4;j++)box(1,10,.8,side*18-5+j*3,y,11,dark);}engine(side*14,-30,4.5,23);turret(side*9,13);}
  for(let i=0;i<6;i++)box(7,2,1,0,-21+i*7,8,plate);windows(-3,18,3,true);
  if(t>=2){for(const side of [-1,1]){box(10,50,5,side*33,-4,0,dark);engine(side*34,-25,2.5,20);}}
  if(t===3){box(7,70,6,-43,-1,0,hull);box(7,70,6,43,-1,0,hull);}
 }else if(spec.faction==='syndicate'){
  plateShape([[0,44],[9,17],[42,-17],[48,-33],[20,-21],[8,-31],[0,-25],[-8,-31],[-20,-21],[-48,-33],[-42,-17],[-9,17]],5,2);
  plateShape([[0,37],[5,10],[31,-17],[12,-11],[0,1],[-12,-11],[-31,-17],[-5,10]],2,9,trim);
  ellipsoid(7,23,6,0,-1,9,dark);ellipsoid(3,9,1.5,0,9,15,glow);
  for(const side of [-1,1]){engine(side*29,-21,2.6,19);turret(side*12,1);for(let i=0;i<4;i++){const rib=box(1.2,15,1,side*(17+i*5),-9-i*3,9,plate);rib.rotation.z=side*.6;}windows(side*7,-10,4);}
  if(t>=2){for(const side of [-1,1]){plateShape([[side*14,-10],[side*17,12],[side*37,34],[side*30,3]],3,1,dark);box(2,19,2,side*32,12,5,glow);}}
  if(t===3){ring(7,2,0,-14,15,trim);turret(0,26);}
 }else if(spec.faction==='helios'){
  ring(27+t*2,3.5,0,0,4,hull);ring(24+t*2,.85,0,0,6,glow);ring(31+t*2,.65,0,0,4,trim);
  plateShape([[0,49],[7,16],[6,-22],[0,-41],[-6,-22],[-7,16]],7,5,plate);box(3,31,1,0,13,14,glow);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const spoke=box(3,15,2,Math.sin(a)*23,Math.cos(a)*23,3,trim);spoke.rotation.z=-a;ellipsoid(2.2,2.2,2,Math.sin(a)*28,Math.cos(a)*28,6,plate);}
  engine(-11,-26,2.4,19);engine(11,-26,2.4,19);windows(-4,-16,5);
  if(t>=2){ring(15,2,0,0,11,plate);ring(13,.7,0,0,12,glow);}
  if(t===3){for(const side of [-1,1]){ellipsoid(6,19,4,side*38,0,3,plate);turret(side*38,9);}}
 }else if(spec.faction==='verdant'){
  const shape=new THREE.Shape();shape.moveTo(0,42);shape.bezierCurveTo(10,24,42,21,48,-15);shape.bezierCurveTo(28,-7,17,-18,8,-24);shape.quadraticCurveTo(0,-44,-8,-24);shape.bezierCurveTo(-17,-18,-28,-7,-48,-15);shape.bezierCurveTo(-42,21,-10,24,0,42);
  add(new THREE.ExtrudeGeometry(shape,{depth:5,bevelEnabled:true,bevelThickness:3,bevelSize:3,bevelSegments:4,curveSegments:24}),hull,0,0,3);
  ellipsoid(10,30,6,0,0,10,dark);ellipsoid(5,17,3,0,9,15,trim);ellipsoid(2,12,1,0,13,18,glow);
  for(const side of [-1,1]){for(let i=0;i<4;i++){const rib=ellipsoid(2,17-i*2,1.5,side*(14+i*6),3-i*3,10,plate);rib.rotation.z=-side*.6;box(1,6,.6,side*(14+i*6),7-i*3,13,glow);}engine(side*11,-27,3,17);turret(side*19,11);}
  if(t>=2){for(const side of [-1,1])ellipsoid(6,27,4,side*37,-3,3,trim);}
  if(t===3){ring(13,1,0,0,17,glow).scale.y=1.7;engine(0,-38,3.5,17);}
 }else{
  plateShape([[-13,40],[13,40],[18,29],[17,-32],[-17,-32],[-18,29]],12,0);
  box(22,14,8,0,29,12,plate);box(17,3,1,0,33,17,glow);box(9,40,6,0,-1,12,dark);
  for(const side of [-1,1]){box(16,48,11,side*23,-3,1,hull);for(let i=0;i<5;i++)box(13,5,2,side*23,-21+i*9,8,plate);box(2,53,3,side*34,5,7,dark);box(1.5,11,1,side*34,32,9,glow);engine(side*23,-28,5,20);turret(side*12,18);turret(side*23,-1);windows(side*9,-17,5);}
  if(t>=2){box(55,13,10,0,29,-1,trim);turret(-24,28);turret(24,28);}
  if(t===3){engine(0,-30,5,20);for(const side of [-1,1])box(10,48,10,side*42,-3,0,hull);}
 }
 // Dorsal faction insignia and flush navigation lights.
 const badge=ring(2.1,.6,0,-8,20,glow);badge.scale.y=.85;
 box(.6,5,.6,0,-8,20,plate);
 for(const side of [-1,1])ellipsoid(.9,.9,.6,side*19,-15,14,side<0?new THREE.MeshBasicMaterial({color:'#ff7060'}):glow);
 bake(group);group.scale.setScalar(spec.size);group.userData.ship=id;return group;
}

export function makeStation(faction:FactionId){
 const f=FACTIONS[faction],group=new THREE.Group();
 const metal=new THREE.MeshStandardMaterial({color:f.hull,metalness:.72,roughness:.38}),dark=new THREE.MeshStandardMaterial({color:f.dark,metalness:.75,roughness:.4}),glow=new THREE.MeshBasicMaterial({color:f.color});
 const add=(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
 const arms=[6,4,3,8,5,4][f.style];
 if(f.style!==2&&f.style!==5){add(new THREE.TorusGeometry(62,7,10,64),metal);add(new THREE.TorusGeometry(63,1,6,64),glow,0,0,7);}
 const core=add(new THREE.CylinderGeometry(19,29,22,arms*2),metal,0,0,10);core.rotation.x=Math.PI/2;
 const tower=add(new THREE.CylinderGeometry(9,15,18,8),dark,0,0,27);tower.rotation.x=Math.PI/2;
 for(let i=0;i<arms;i++){const a=i/arms*Math.PI*2;const spoke=add(new THREE.BoxGeometry(10,100,7),metal);spoke.rotation.z=a;const pod=add(new THREE.BoxGeometry(f.style===1?28:20,35,15),metal,Math.sin(a)*71,Math.cos(a)*71,2);pod.rotation.z=-a;const panel=add(new THREE.BoxGeometry(13,24,1),dark,Math.sin(a)*71,Math.cos(a)*71,10);panel.rotation.z=-a;add(new THREE.SphereGeometry(2.2,8,8),glow,Math.sin(a)*88,Math.cos(a)*88,10);}
 if(f.style===3)add(new THREE.TorusGeometry(95,2,8,80),glow,0,0,-4);
 if(f.style===5){for(const x of [-35,35])add(new THREE.BoxGeometry(18,125,16),metal,x,0,0);}
 return bake(group);
}
