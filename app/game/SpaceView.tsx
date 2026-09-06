'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Universe, SYSTEMS, STATION } from './engine';
import { createSpaceBackground } from './SpaceBackground';

const noiseGLSL=`
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}`;

function planet(radius:number,color:string,seed:number,moon=false){
 const geometry=new THREE.SphereGeometry(radius,80,64);
 const material=new THREE.ShaderMaterial({uniforms:{baseColor:{value:new THREE.Color(color)},seed:{value:seed+1.3},moon:{value:moon?1:0}},vertexShader:`varying vec3 vPos;varying vec3 vNormal;void main(){vPos=position;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 vPos;varying vec3 vNormal;uniform vec3 baseColor;uniform float seed;uniform float moon;${noiseGLSL}
void main(){vec3 n=normalize(vNormal);vec3 p=n*4.5+seed;float terrain=fbm(p);float fine=fbm(p*7.);float land=smoothstep(.48,.54,terrain);vec3 ocean=mix(vec3(.025,.09,.19),baseColor*.36,fine);vec3 ground=mix(baseColor*.25,vec3(.4,.44,.33),fine);vec3 col=mix(ocean,ground,land);float clouds=smoothstep(.53,.7,fbm(p*1.8+seed))* .82;col=mix(col,vec3(.82,.87,.89),clouds);if(moon>.5)col=baseColor*(.24+terrain*.6+fine*.2);float light=max(0.,dot(n,normalize(vec3(-.85,.65,.6))));float night=.014;col*=night+light*1.45;float rim=pow(1.-max(dot(n,vec3(0,0,1)),0.),3.5);col+=baseColor*rim*light*.7;gl_FragColor=vec4(col,1.);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.rotation.z=.3;return mesh;
}
function makeShip(kind:string='player',heavy=false){
 const group=new THREE.Group();
 const hull=new THREE.MeshStandardMaterial({color:kind==='hostile'?0x806a69:kind==='trader'?0x8b8275:0x98abb6,metalness:.78,roughness:.32});
 const dark=new THREE.MeshStandardMaterial({color:0x22313d,metalness:.85,roughness:.4});
 const trim=new THREE.MeshStandardMaterial({color:kind==='hostile'?0x823e35:0x235169,metalness:.75,roughness:.3});
 const light=new THREE.MeshBasicMaterial({color:kind==='hostile'?0xff633e:kind==='trader'?0xffbe69:0x64dfff});
 const shape=new THREE.Shape();shape.moveTo(0,32);shape.lineTo(9,9);shape.lineTo(24,-13);shape.lineTo(20,-21);shape.lineTo(8,-15);shape.lineTo(5,-25);shape.lineTo(-5,-25);shape.lineTo(-8,-15);shape.lineTo(-20,-21);shape.lineTo(-24,-13);shape.lineTo(-9,9);shape.closePath();
 const body=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:5,bevelEnabled:true,bevelThickness:1.5,bevelSize:1.5,bevelSegments:2}),hull);group.add(body);
 const addBox=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;};
 addBox(9,25,6,0,1,7,dark);addBox(5,12,3,0,11,10,trim);addBox(3,7,1,0,14,12,light);
 for(const side of [-1,1]){
  const engine=new THREE.Mesh(new THREE.CylinderGeometry(3.5,4.5,31,12),hull);engine.position.set(side*17,-8,4);group.add(engine);
  addBox(4,22,1,side*17,-8,8,trim);addBox(3,6,1,side*17,-13,9,light);
  addBox(2,15,2,side*10,7,5,dark);addBox(2,3,2,side*10,15,5,light);
  const plume=new THREE.Mesh(new THREE.ConeGeometry(3.8,24,16),new THREE.MeshBasicMaterial({color:kind==='hostile'?0xff593d:0x5cd8ff,transparent:true,opacity:.8}));plume.rotation.z=Math.PI;plume.position.set(side*17,-33,4);plume.name='engine';group.add(plume);
 }
 if(heavy){addBox(21,29,9,-27,-2,3,hull);addBox(21,29,9,27,-2,3,hull);}
 group.scale.setScalar(kind==='player'?1:kind==='trader'?.78:.83);return group;
}
function makeStation(){
 const group=new THREE.Group();const metal=new THREE.MeshStandardMaterial({color:0x71818b,metalness:.8,roughness:.42});const dark=new THREE.MeshStandardMaterial({color:0x203444,metalness:.7,roughness:.5});const glow=new THREE.MeshBasicMaterial({color:0x5ae0f1});
 const ring=new THREE.Mesh(new THREE.TorusGeometry(57,7,10,64),metal);group.add(ring);
 const ringLight=new THREE.Mesh(new THREE.TorusGeometry(58,1,6,64),glow);ringLight.position.z=5;group.add(ringLight);
 const core=new THREE.Mesh(new THREE.CylinderGeometry(21,30,20,12),metal);core.rotation.x=Math.PI/2;core.position.z=4;group.add(core);
 const tower=new THREE.Mesh(new THREE.CylinderGeometry(10,16,20,8),dark);tower.rotation.x=Math.PI/2;tower.position.z=18;group.add(tower);
 for(let i=0;i<6;i++){const angle=i*Math.PI/3;const spoke=new THREE.Mesh(new THREE.BoxGeometry(8,80,6),metal);spoke.rotation.z=angle;group.add(spoke);const pod=new THREE.Mesh(new THREE.BoxGeometry(20,24,12),metal);pod.position.set(Math.sin(angle)*66,Math.cos(angle)*66,0);pod.rotation.z=-angle;group.add(pod);const panel=new THREE.Mesh(new THREE.BoxGeometry(15,16,1),dark);panel.position.copy(pod.position);panel.position.z=7;panel.rotation.z=-angle;group.add(panel);const beacon=new THREE.Mesh(new THREE.SphereGeometry(2,8,8),glow);beacon.position.set(Math.sin(angle)*77,Math.cos(angle)*77,7);group.add(beacon);}
 group.position.set(STATION.x,STATION.y,25);return group;
}
function orbit(x:number,y:number,r:number,color=0x365167){const points=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;points.push(new THREE.Vector3(x+Math.cos(a)*r,y+Math.sin(a)*r,-90));}return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.25}));}
function disposeTree(object:THREE.Object3D){object.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material){for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();}});}

export default function SpaceView({game,onTick}:{game:Universe;onTick:()=>void}){
 const hostRef=useRef<HTMLDivElement>(null);const tickRef=useRef(onTick);tickRef.current=onTick;
 useEffect(()=>{
  const host=hostRef.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{host.textContent='Your browser could not start the 3D renderer. Enable hardware acceleration and reload to play.';return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setClearColor(0x040910);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Space flight view. Click space to fly; click ships to select a target.');
  const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-700,700,450,-450,.1,5000);camera.position.set(0,0,1800);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0x7d9fbf,1.8));const sun=new THREE.DirectionalLight(0xb9ddff,4.5);sun.position.set(-700,800,900);scene.add(sun);const fill=new THREE.DirectionalLight(0x456bbf,1);fill.position.set(500,-600,500);scene.add(fill);
  let seed=8462;function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  const background=createSpaceBackground(scene,renderer.getPixelRatio());
  let systemGroup=new THREE.Group();scene.add(systemGroup);let renderedSystem=-1;const player=makeShip();scene.add(player);let renderedShip=game.s.ship;
  const contactMeshes=new Map<string,THREE.Object3D>();const bulletMeshes=new Map<number,THREE.Mesh>();
  const targetRing=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-35,-20,0),new THREE.Vector3(-35,-35,0),new THREE.Vector3(-35,-35,0),new THREE.Vector3(-20,-35,0),new THREE.Vector3(20,-35,0),new THREE.Vector3(35,-35,0),new THREE.Vector3(35,-35,0),new THREE.Vector3(35,-20,0),new THREE.Vector3(-35,20,0),new THREE.Vector3(-35,35,0),new THREE.Vector3(-35,35,0),new THREE.Vector3(-20,35,0),new THREE.Vector3(20,35,0),new THREE.Vector3(35,35,0),new THREE.Vector3(35,35,0),new THREE.Vector3(35,20,0)]),new THREE.LineBasicMaterial({color:0x73d9e2,transparent:true,opacity:.8}));scene.add(targetRing);
  const waypointRing=new THREE.Mesh(new THREE.RingGeometry(12,13,32),new THREE.MeshBasicMaterial({color:0x9bd4e8,transparent:true,opacity:.6}));scene.add(waypointRing);
  const particleGeo=new THREE.BufferGeometry();const particlePositions=new Float32Array(1024*3),particleColors=new Float32Array(1024*3);particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3).setUsage(THREE.DynamicDrawUsage));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3).setUsage(THREE.DynamicDrawUsage));const particlePoints=new THREE.Points(particleGeo,new THREE.PointsMaterial({size:4,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending}));particlePoints.frustumCulled=false;scene.add(particlePoints);
  const labels=document.createElement('div');labels.className='space-labels';host.appendChild(labels);const labelMap=new Map<string,HTMLDivElement>();
  const makeLabel=(id:string,text:string,sub:string,color:string)=>{const el=document.createElement('div');el.className='world-label';el.style.setProperty('--label-color',color);const t=document.createElement('strong');t.textContent=text;const s=document.createElement('span');s.textContent=sub;el.appendChild(t);el.appendChild(s);labels.appendChild(el);labelMap.set(id,el);};
  const placeLabel=(id:string,x:number,y:number,offset:number)=>{const el=labelMap.get(id);if(!el)return;const v=new THREE.Vector3(x,y,40).project(camera);el.style.transform=`translate(${(v.x*.5+.5)*host.clientWidth}px,${(-v.y*.5+.5)*host.clientHeight+offset}px) translateX(-50%)`;el.style.display=Math.abs(v.x)>1.2||Math.abs(v.y)>1.2?'none':'';};
  const rebuild=()=>{scene.remove(systemGroup);disposeTree(systemGroup);systemGroup=new THREE.Group();scene.add(systemGroup);labels.replaceChildren();labelMap.clear();for(const m of contactMeshes.values()){scene.remove(m);disposeTree(m);}contactMeshes.clear();const sys=SYSTEMS[game.s.system];background.setSystem(sys.color);const world=planet(206,sys.color,game.s.system*2.73);world.position.set(-425,320,-90);systemGroup.add(world);const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(211,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(sys.color)}},vertexShader:'varying vec3 n;void main(){n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 n;uniform vec3 color;void main(){float rim=pow(1.-max(dot(normalize(n),vec3(0,0,1)),0.),7.);gl_FragColor=vec4(color,rim*.35);}'}));atmosphere.position.copy(world.position);systemGroup.add(atmosphere);const moon=planet(70,'#96999e',game.s.system*3,true);moon.position.set(700,-400,-60);systemGroup.add(moon);systemGroup.add(orbit(-425,320,420),orbit(-425,320,730),orbit(-425,320,1170));
   const asteroids=new THREE.IcosahedronGeometry(1,1);const rockMat=new THREE.MeshStandardMaterial({color:0x555768,roughness:1,metalness:.12});const rocks=new THREE.InstancedMesh(asteroids,rockMat,100);const dummy=new THREE.Object3D();for(let i=0;i<100;i++){const a=-.9+random()*2.3;const r=880+random()*130;dummy.position.set(-425+Math.cos(a)*r,320+Math.sin(a)*r,-30+random()*50);dummy.rotation.set(random()*6,random()*6,random()*6);const scale=3+random()*14;dummy.scale.set(scale,scale*.7,scale*.8);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}systemGroup.add(rocks);
   const star=new THREE.Mesh(new THREE.SphereGeometry(145,48,40),new THREE.ShaderMaterial({vertexShader:'varying vec3 n;void main(){n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 n;${noiseGLSL}void main(){float f=fbm(n*18.);float edge=pow(max(n.z,0.),.35);gl_FragColor=vec4(mix(vec3(.8,.26,.06),vec3(1.,.79,.38),f)*(.5+edge*.8),1.);}`}));star.position.set(-1300,1100,-50);systemGroup.add(star);
   const corona=new THREE.Mesh(new THREE.PlaneGeometry(750,750),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;float glow=pow(max(0.,1.-d),4.);gl_FragColor=vec4(1.,.43,.1,glow*.6);}'}));corona.position.set(-1300,1100,-55);systemGroup.add(corona);
   const giant=new THREE.Mesh(new THREE.SphereGeometry(136,64,48),new THREE.ShaderMaterial({vertexShader:'varying vec3 n;void main(){n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 n;${noiseGLSL}void main(){float f=fbm(n*7.);float band=sin(n.y*33.+f*9.)*.5+.5;vec3 c=mix(vec3(.25,.2,.15),vec3(.65,.53,.37),band);float light=max(.015,dot(normalize(n),normalize(vec3(-.7,.65,.7))));gl_FragColor=vec4(c*light,1.);}`}));giant.position.set(-1050,-770,-50);systemGroup.add(giant);const rings=new THREE.Mesh(new THREE.RingGeometry(169,224,96),new THREE.MeshBasicMaterial({color:0x96866b,transparent:true,opacity:.3,side:THREE.DoubleSide}));rings.position.copy(giant.position);rings.rotation.x=.6;rings.rotation.y=.18;systemGroup.add(rings);
   makeLabel('planet',sys.planet.toUpperCase(),sys.kind+' world',sys.color);makeLabel('moon','SILENT MOON','Uninhabited','#8695a6');makeLabel('sun',sys.name.toUpperCase(),'Main-sequence star','#d6b184');makeLabel('giant','THE WATCHER','Ringed gas giant','#b8a07a');renderedSystem=game.s.system;
  };
  let width=0,height=0;function resize(){width=host.clientWidth;height=host.clientHeight;renderer.setSize(width,height);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const click=(event:PointerEvent)=>{if(game.docked||game.paused||event.button!==0)return;const rect=renderer.domElement.getBoundingClientRect();const v=new THREE.Vector3((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1,0).unproject(camera);let hit=false;for(const c of game.contacts){if(Math.hypot(v.x-c.x,v.y-c.y)<(c.kind==='station'?90:42)){game.target=c.id;game.notify(`${c.name} selected.`);hit=true;break;}}if(!hit){game.waypoint={x:v.x,y:v.y};game.autoDock=false;}tickRef.current();};
  const wheel=(event:WheelEvent)=>{event.preventDefault();game.zoom=Math.min(1.8,Math.max(.5,game.zoom-event.deltaY*.0006));};
  renderer.domElement.addEventListener('pointerdown',click);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  let last=performance.now(),uiElapsed=0,raf=0;function frame(now:number){const dt=Math.min((now-last)/1000,.05);last=now;game.update(dt);if(renderedSystem!==game.s.system)rebuild();const s=game.s;
   camera.position.x+=(s.x-camera.position.x)*Math.min(dt*3,1);camera.position.y+=(s.y+90-camera.position.y)*Math.min(dt*3,1);const span=950/game.zoom;camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();background.update(camera.position.x,camera.position.y,s.time);
   player.position.set(s.x,s.y,30);player.rotation.z=s.angle;player.visible=!game.docked;if(renderedShip!==s.ship){const next=makeShip('player',s.ship==='freighter');disposeTree(player);player.clear();while(next.children.length)player.add(next.children[0]);player.scale.setScalar(s.ship==='interceptor'?1.18:1);renderedShip=s.ship;}
   player.children.forEach(c=>{if(c.name==='engine'){c.scale.y=.45+Math.hypot(s.vx,s.vy)/game.stats.speed*(1+Math.random()*.25);}});
   for(const c of game.contacts){let m=contactMeshes.get(c.id);if(!m){m=c.kind==='station'?makeStation():c.kind==='salvage'?new THREE.Mesh(new THREE.OctahedronGeometry(7),new THREE.MeshBasicMaterial({color:0xffc778})):makeShip(c.kind);scene.add(m);contactMeshes.set(c.id,m);if(c.kind==='station')makeLabel(c.id,c.name.toUpperCase(),'STATION','#84d6cb');}m.position.set(c.x,c.y,c.kind==='station'?25:30);m.rotation.z=c.kind==='station'?s.time*.02:c.angle;}
   for(const [id,m]of contactMeshes)if(!game.contacts.some(c=>c.id===id)){scene.remove(m);disposeTree(m);contactMeshes.delete(id);}
   for(const b of game.bullets){let m=bulletMeshes.get(b.id);if(!m){m=new THREE.Mesh(new THREE.CapsuleGeometry(1.5,16,4,6),new THREE.MeshBasicMaterial({color:b.enemy?0xff644a:0x8ceaff}));scene.add(m);bulletMeshes.set(b.id,m);}m.position.set(b.x,b.y,35);m.rotation.z=Math.atan2(b.vy,b.vx)-Math.PI/2;}
   for(const[id,m]of bulletMeshes)if(!game.bullets.some(b=>b.id===id)){scene.remove(m);disposeTree(m);bulletMeshes.delete(id);}
   game.particles.slice(0,1024).forEach((p,i)=>{particlePositions.set([p.x,p.y,40],i*3);const color=new THREE.Color(p.color).multiplyScalar(p.life/p.maxLife);particleColors.set([color.r,color.g,color.b],i*3);});particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.color.needsUpdate=true;particleGeo.setDrawRange(0,Math.min(game.particles.length,1024));
   const selected=game.selected;targetRing.visible=!!selected;if(selected){targetRing.position.set(selected.x,selected.y,80);targetRing.scale.setScalar(selected.kind==='station'?2.8:1);(targetRing.material as THREE.LineBasicMaterial).color.set(selected.kind==='hostile'?0xf17c6d:0x84d6cb);}
   waypointRing.visible=!!game.waypoint;if(game.waypoint)waypointRing.position.set(game.waypoint.x,game.waypoint.y,30);
   placeLabel('planet',-425,320,206*height/span+20);placeLabel('moon',700,-400,70*height/span+12);placeLabel('station',STATION.x,STATION.y,95*height/span+12);placeLabel('sun',-1300,1100,145*height/span+18);placeLabel('giant',-1050,-770,180*height/span+18);
   renderer.render(scene,camera);uiElapsed+=dt;if(uiElapsed>.12){tickRef.current();uiElapsed=0;}raf=requestAnimationFrame(frame);
  }raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('pointerdown',click);renderer.domElement.removeEventListener('wheel',wheel);disposeTree(scene);renderer.dispose();host.replaceChildren();};
 },[game]);
 return <div className="space-render" ref={hostRef}/>;
}
