'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Universe, SYSTEMS, STATION, FACTIONS, SHIPS, WEAPONS } from './engine';
import { createSpaceBackground } from './SpaceBackground';
import { makeShip,makeStation,disposeModel } from './ShipModels';
import { createBattleEffects } from './BattleEffects';
import { renderFlightLayers } from './renderLayers';

const noiseGLSL=`
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}`;

function planet(radius:number,color:string,seed:number,type='terran'){
 const geometry=new THREE.SphereGeometry(radius,80,64);
 const material=new THREE.ShaderMaterial({uniforms:{baseColor:{value:new THREE.Color(color)},seed:{value:seed+1.3},moon:{value:type==='terran'?0:type==='gas'?2:type==='lava'?3:type==='ice'?4:1}},vertexShader:`varying vec3 vPos;varying vec3 vNormal;void main(){vPos=position;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 vPos;varying vec3 vNormal;uniform vec3 baseColor;uniform float seed;uniform float moon;${noiseGLSL}
void main(){vec3 n=normalize(vNormal);vec3 p=n*4.5+seed;float terrain=fbm(p);float fine=fbm(p*7.);float land=smoothstep(.48,.54,terrain);vec3 ocean=mix(vec3(.025,.09,.19),baseColor*.36,fine);vec3 ground=mix(baseColor*.25,vec3(.4,.44,.33),fine);vec3 col=mix(ocean,ground,land);float clouds=smoothstep(.53,.7,fbm(p*1.8+seed))* .82;col=mix(col,vec3(.82,.87,.89),clouds);if(moon>.5)col=baseColor*(.24+terrain*.6+fine*.2);if(moon>1.5&&moon<2.5){float band=sin(n.y*37.+fbm(p*2.)*10.)*.5+.5;col=mix(baseColor*.25,baseColor,band);}if(moon>2.5&&moon<3.5){float lava=smoothstep(.52,.59,fbm(p*3.));col=mix(vec3(.09,.055,.045),vec3(1.,.22,.035),lava);}if(moon>3.5)col=mix(baseColor*.28,vec3(.8,.9,.94),smoothstep(.39,.58,terrain));float light=max(0.,dot(n,normalize(vec3(-.85,.65,.6))));float night=.014;col*=night+light*1.45;float rim=pow(1.-max(dot(n,vec3(0,0,1)),0.),3.5);col+=baseColor*rim*light*.7;gl_FragColor=vec4(col,1.);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.rotation.z=.3;return mesh;
}
function orbit(x:number,y:number,r:number,color=0x365167){const points=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;points.push(new THREE.Vector3(x+Math.cos(a)*r,y+Math.sin(a)*r,-90));}return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.25}));}
function disposeTree(object:THREE.Object3D){object.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material){for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();}});}

export default function SpaceView({game,onTick}:{game:Universe;onTick:()=>void}){
 const hostRef=useRef<HTMLDivElement>(null);const tickRef=useRef(onTick);tickRef.current=onTick;
 useEffect(()=>{
  const host=hostRef.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{host.textContent='Your browser could not start the 3D renderer. Enable hardware acceleration and reload to play.';return;}
  renderer.autoClear=false;renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setClearColor(0x040910);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Space flight view. Click space to fly, ships to select, and planets to open communications.');
  const scene=new THREE.Scene();const celestial=new THREE.Scene();const camera=new THREE.OrthographicCamera(-700,700,450,-450,.1,5000);camera.position.set(0,0,1800);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0x7d9fbf,1.8));const sun=new THREE.DirectionalLight(0xb9ddff,4.5);sun.position.set(-700,800,900);scene.add(sun);const fill=new THREE.DirectionalLight(0x456bbf,1);fill.position.set(500,-600,500);scene.add(fill);
  let seed=8462;function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  celestial.add(new THREE.AmbientLight(0x75869a,2));const rockLight=sun.clone();celestial.add(rockLight);const background=createSpaceBackground(celestial,renderer.getPixelRatio());
  let systemGroup=new THREE.Group();celestial.add(systemGroup);let renderedSystem=-1;let player=makeShip(game.s.ship);scene.add(player);let renderedShip=game.s.ship;
  const battleEffects=createBattleEffects(scene);let renderedOwner=game.faction;
  const contactMeshes=new Map<string,THREE.Object3D>();const bulletMeshes=new Map<number,THREE.Group>();const beamMeshes=new Map<number,THREE.Group>();
  const targetRing=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-35,-20,0),new THREE.Vector3(-35,-35,0),new THREE.Vector3(-35,-35,0),new THREE.Vector3(-20,-35,0),new THREE.Vector3(20,-35,0),new THREE.Vector3(35,-35,0),new THREE.Vector3(35,-35,0),new THREE.Vector3(35,-20,0),new THREE.Vector3(-35,20,0),new THREE.Vector3(-35,35,0),new THREE.Vector3(-35,35,0),new THREE.Vector3(-20,35,0),new THREE.Vector3(20,35,0),new THREE.Vector3(35,35,0),new THREE.Vector3(35,35,0),new THREE.Vector3(35,20,0)]),new THREE.LineBasicMaterial({color:0x73d9e2,transparent:true,opacity:.8}));scene.add(targetRing);
  const waypointRing=new THREE.Mesh(new THREE.RingGeometry(12,13,32),new THREE.MeshBasicMaterial({color:0x9bd4e8,transparent:true,opacity:.6}));scene.add(waypointRing);
  const particleGeo=new THREE.BufferGeometry();const particlePositions=new Float32Array(1024*3),particleColors=new Float32Array(1024*3);particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3).setUsage(THREE.DynamicDrawUsage));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3).setUsage(THREE.DynamicDrawUsage));const particlePoints=new THREE.Points(particleGeo,new THREE.PointsMaterial({size:4,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending}));particlePoints.frustumCulled=false;scene.add(particlePoints);
  const labels=document.createElement('div');labels.className='space-labels';host.appendChild(labels);const labelMap=new Map<string,HTMLDivElement>();
  const makeLabel=(id:string,text:string,sub:string,color:string)=>{const el=document.createElement('div');el.className='world-label';el.style.setProperty('--label-color',color);const t=document.createElement('strong');t.textContent=text;const s=document.createElement('span');s.textContent=sub;el.appendChild(t);el.appendChild(s);labels.appendChild(el);labelMap.set(id,el);};
  const placeLabel=(id:string,x:number,y:number,offset:number)=>{const el=labelMap.get(id);if(!el)return;const v=new THREE.Vector3(x,y,40).project(camera);el.style.transform=`translate(${(v.x*.5+.5)*host.clientWidth}px,${(-v.y*.5+.5)*host.clientHeight+offset}px) translateX(-50%)`;el.style.display=Math.abs(v.x)>1.2||Math.abs(v.y)>1.2?'none':'';};
  const rebuild=()=>{
   celestial.remove(systemGroup);disposeTree(systemGroup);systemGroup=new THREE.Group();celestial.add(systemGroup);labels.replaceChildren();labelMap.clear();
   for(const m of contactMeshes.values()){scene.remove(m);disposeModel(m);}contactMeshes.clear();
   const sys=SYSTEMS[game.s.system],f=FACTIONS[game.faction];background.setSystem(f.color,f.secondary,f.style,sys.id);
   for(const w of game.worlds){
    const world=planet(w.radius,w.color,sys.id*2.73+w.x*.005,w.type);world.position.set(w.x,w.y,-110);systemGroup.add(world);
    if(w.type!=='barren'){
     const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(w.radius*1.025,48,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(w.color)}},vertexShader:'varying vec3 n;void main(){n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 n;uniform vec3 color;void main(){float rim=pow(1.-max(dot(normalize(n),vec3(0,0,1)),0.),5.);gl_FragColor=vec4(color,rim*.38);}'}));atmosphere.position.copy(world.position);systemGroup.add(atmosphere);
    }
    if(w.ring){const rings=new THREE.Mesh(new THREE.RingGeometry(w.radius*1.24,w.radius*1.85,96),new THREE.MeshBasicMaterial({color:w.color,transparent:true,opacity:.28,side:THREE.DoubleSide}));rings.position.copy(world.position);rings.rotation.x=.68;rings.rotation.y=.18;systemGroup.add(rings);}
    systemGroup.add(orbit(w.x,w.y,w.radius+130));makeLabel(w.id,w.name.toUpperCase(),w.economy,w.color);
   }
   const rockGeo=new THREE.IcosahedronGeometry(1,1),rockMat=new THREE.MeshStandardMaterial({color:f.dark,roughness:.85,metalness:.18});const rocks=new THREE.InstancedMesh(rockGeo,rockMat,240),dummy=new THREE.Object3D();
   for(let i=0;i<240;i++){const a=random()*Math.PI*2,r=1150+random()*210;dummy.position.set(-425+Math.cos(a)*r,320+Math.sin(a)*r,-50+random()*50);dummy.rotation.set(random()*6,random()*6,random()*6);const scale=3+random()*13;dummy.scale.set(scale,scale*.7,scale*.8);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}systemGroup.add(rocks);
   const star=planet(180,'#ffba6c',sys.id,'lava');star.position.set(-1500,2700,-70);systemGroup.add(star);
   const corona=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;float glow=pow(max(0.,1.-d),4.);gl_FragColor=vec4(1.,.43,.1,glow*.6);}'}));corona.position.copy(star.position);systemGroup.add(corona);
   makeLabel('sun',sys.name.toUpperCase(),'MAIN-SEQUENCE STAR','#f1ba81');renderedSystem=game.s.system;renderedOwner=game.faction;
  };
  let width=0,height=0;function resize(){width=host.clientWidth;height=host.clientHeight;renderer.setSize(width,height);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const click=(event:PointerEvent)=>{
   if(game.docked||game.paused||event.button!==0)return;
   const rect=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1,0).unproject(camera);
   const ship=game.contacts.find(c=>c.kind!=='planet'&&Math.hypot(v.x-c.x,v.y-c.y)<(c.radius??40));
   const world=game.contacts.find(c=>c.kind==='planet'&&Math.hypot(v.x-c.x,v.y-c.y)<(c.radius??200));
   const hit=ship??world;
   if(hit){if(hit.kind==='planet'||game.target===hit.id)game.hail(hit.id);game.target=hit.id;}else{game.waypoint={x:v.x,y:v.y};game.autoDock=false;}
   tickRef.current();
  };
  const wheel=(event:WheelEvent)=>{event.preventDefault();game.zoom=Math.min(1.8,Math.max(.5,game.zoom-event.deltaY*.0006));};
  renderer.domElement.addEventListener('pointerdown',click);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  let last=performance.now(),uiElapsed=0,raf=0;function frame(now:number){const dt=Math.min((now-last)/1000,.05);last=now;game.update(dt);if(renderedSystem!==game.s.system||renderedOwner!==game.faction)rebuild();const s=game.s;
   camera.position.x+=(s.x-camera.position.x)*Math.min(dt*3,1);camera.position.y+=(s.y+90-camera.position.y)*Math.min(dt*3,1);const span=950/game.zoom;camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-span/2;camera.position.x+=Math.sin(now*.051)*game.shake*.18;camera.position.y+=Math.cos(now*.063)*game.shake*.18;camera.updateProjectionMatrix();camera.updateMatrixWorld();background.update(camera.position.x,camera.position.y,s.time);
   if(renderedShip!==s.ship){scene.remove(player);disposeModel(player);player=makeShip(s.ship);scene.add(player);renderedShip=s.ship;}
   player.position.set(s.x,s.y,30);player.rotation.z=s.angle;player.visible=!game.docked;
   for(const child of player.children)if(child.name==='engine'){child.scale.y=.45+Math.hypot(s.vx,s.vy)/game.stats.speed*1.4;child.position.y=child.userData.baseY-(child.scale.y-1)*10;}
   for(const c of game.contacts){if(c.kind==='planet')continue;let m=contactMeshes.get(c.id);
    if(!m){m=c.kind==='station'?makeStation(c.faction??game.faction):c.kind==='salvage'?new THREE.Mesh(new THREE.OctahedronGeometry(7),new THREE.MeshBasicMaterial({color:0xffc778})):makeShip(c.ship??'courier',c.kind==='hostile');scene.add(m);contactMeshes.set(c.id,m);if(c.kind==='station'){if(c.role==='battery')m.scale.setScalar(.32);if(c.role==='blockade')m.scale.setScalar(1.35);makeLabel(c.id,c.name.toUpperCase(),c.role==='blockade'?'JUMP LANE INTERDICTOR':c.role==='battery'?'SURFACE MISSILE BATTERY':FACTIONS[game.faction].short+' STATION',c.role==='blockade'?'#f48c82':FACTIONS[game.faction].color);}if(c.role==='relic'){m.scale.setScalar(3);makeLabel(c.id,'LOST RESEARCH TENDER','ANTIMATTER SIGNATURE','#d9acff');}}
    m.position.set(c.x,c.y,c.kind==='station'?15:30);m.rotation.z=c.kind==='station'?s.time*.012:c.angle;
    for(const child of m.children)if(child.name==='engine')child.scale.y=c.distressed?1.4:.65;
   }
   for(const [id,m]of contactMeshes)if(!game.contacts.some(c=>c.id===id&&c.hull>0)){scene.remove(m);disposeModel(m);contactMeshes.delete(id);labelMap.get(id)?.remove();labelMap.delete(id);}
   for(const b of game.bullets){let m=bulletMeshes.get(b.id);
    if(!m){m=new THREE.Group();const color=b.enemy&&b.kind!=='antimatter'?'#ff7959':WEAPONS[b.kind??'torpedo'].color;
     const core=new THREE.Mesh(b.kind==='missile'?new THREE.CapsuleGeometry(2.2,10,4,8):new THREE.SphereGeometry(b.kind==='antimatter'?11:b.kind==='torpedo'?8:5,16,12),new THREE.MeshBasicMaterial({color}));m.add(core);
     const halo=new THREE.Mesh(new THREE.PlaneGeometry(34,34),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(color)}},vertexShader:'varying vec2 uvPos;void main(){uvPos=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uvPos;uniform vec3 color;void main(){float d=length(uvPos-.5)*2.;gl_FragColor=vec4(color,exp(-d*d*5.)*.7);}'}));m.add(halo);
     const trail=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(35*3),3)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.6,blending:THREE.AdditiveBlending}));trail.name='trail';trail.frustumCulled=false;m.add(trail);scene.add(m);bulletMeshes.set(b.id,m);
    }
    // Trail coordinates are world-space so the exhaust records the actual curve.
    m.children[0].position.set(b.x,b.y,35);m.children[0].rotation.z=Math.atan2(b.vy,b.vx)-Math.PI/2;m.children[1].position.set(b.x,b.y,36);
    const trail=m.children[2] as THREE.Line,positions=trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    (b.trail??[]).forEach((p,i)=>positions.setXYZ(i,p.x,p.y,34));positions.needsUpdate=true;trail.geometry.setDrawRange(0,b.trail?.length??0);
   }
   for(const[id,m]of bulletMeshes)if(!game.bullets.some(b=>b.id===id)){scene.remove(m);disposeModel(m);bulletMeshes.delete(id);}
   for(const b of game.beams){let m=beamMeshes.get(b.id);if(!m){m=new THREE.Group();for(const [width,opacity,color] of [[12,.12,b.color],[4,.7,b.color],[1.3,1,'#ffffff']] as const){const beam=new THREE.Mesh(new THREE.PlaneGeometry(width,1),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));beam.userData.opacity=opacity;m.add(beam);}scene.add(m);beamMeshes.set(b.id,m);}m.position.set((b.x+b.tx)/2,(b.y+b.ty)/2,50);m.rotation.z=Math.atan2(b.ty-b.y,b.tx-b.x)-Math.PI/2;m.scale.y=Math.hypot(b.tx-b.x,b.ty-b.y);for(const child of m.children)((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=child.userData.opacity*(b.continuous?.82+Math.sin(now*.05)*.12:b.life/b.maxLife);}
   for(const[id,m]of beamMeshes)if(!game.beams.some(b=>b.id===id)){scene.remove(m);disposeModel(m);beamMeshes.delete(id);}
   game.particles.slice(0,1024).forEach((p,i)=>{particlePositions.set([p.x,p.y,40],i*3);const color=new THREE.Color(p.color).multiplyScalar(p.life/p.maxLife);particleColors.set([color.r,color.g,color.b],i*3);});particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.color.needsUpdate=true;particleGeo.setDrawRange(0,Math.min(game.particles.length,1024));
   const selected=game.selected;targetRing.visible=!!selected;if(selected){targetRing.position.set(selected.x,selected.y,80);targetRing.scale.setScalar((selected.radius??35)/30);(targetRing.material as THREE.LineBasicMaterial).color.set(game.isHostile(selected)?0xf17c6d:0x84d6cb);}
   waypointRing.visible=!!game.waypoint;if(game.waypoint)waypointRing.position.set(game.waypoint.x,game.waypoint.y,30);
   for(const w of game.worlds)placeLabel(w.id,w.x,w.y,w.radius*height/span+18);for(const c of game.contacts)if(c.kind==='station'||c.role==='relic')placeLabel(c.id,c.x,c.y,(c.radius??40)*height/span+15);placeLabel('sun',-1500,2700,180*height/span+18);
   battleEffects.update(game.effects);renderFlightLayers(renderer,celestial,scene,camera);uiElapsed+=dt;if(uiElapsed>.12){tickRef.current();uiElapsed=0;}raf=requestAnimationFrame(frame);
  }raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('pointerdown',click);renderer.domElement.removeEventListener('wheel',wheel);disposeTree(scene);disposeTree(celestial);renderer.dispose();host.replaceChildren();};
 },[game]);
 return <div className="space-render" ref={hostRef}/>;
}
