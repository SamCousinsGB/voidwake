import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Universe,initialState,SYSTEMS,SHIPS,FACTIONS,WEAPONS,STATION,factionIds,fleetFor,planetsFor } from './engine.ts';
import { makeShip,makeStation,disposeModel } from './ShipModels.ts';
import { renderFlightLayers } from './renderLayers.ts';
import { encodeSave,decodeSave,saveToCookies,loadCookieSave } from './cookies.ts';
const step=(g,seconds)=>{for(let t=0;t<seconds;t+=.02)g.update(.02);};
const quiet=()=>{const g=new Universe(undefined,{dynamic:false});g.contacts=g.contacts.filter(c=>c.kind==='planet'||c.kind==='station');return g;};
const dummy=(id='test',kind='hostile',x=450,y=0)=>({id,name:'Test ship',kind,x,y,vx:0,vy:0,angle:0,hull:1000,maxHull:1000,shield:0,fire:999,radius:30,...(kind!=='hostile'?{faction:'union'}:{})});

test('48 populated systems contain 240 uniquely named, selectable worlds and six complete fleets',()=>{
 assert.equal(SYSTEMS.length,48);assert.equal(Object.keys(SHIPS).length,24);assert.equal(factionIds.length,6);
 const ids=new Set(),names=new Set();for(const sys of SYSTEMS){const g=new Universe(undefined,{dynamic:false});g.s.system=sys.id;g.populate();assert.equal(g.worlds.length,5);assert.equal(g.contacts.filter(c=>c.kind==='planet').length,5);assert.ok(g.contacts.filter(c=>c.kind==='trader').length>=5);for(const w of planetsFor(sys.id)){ids.add(w.id);names.add(w.name);assert.ok(Number.isFinite(w.x)&&Number.isFinite(w.y));assert.equal(g.hail(w.id),true);assert.equal(g.interactionContact.id,w.id);}}
 assert.equal(ids.size,240);assert.equal(names.size,240);for(const f of factionIds){assert.equal(fleetFor(f).length,4);assert.equal(SYSTEMS.filter(s=>s.factionId===f).length,8);}
});

test('all 24 ship models have finite layered geometry, distinct hulls, and bounded draw calls',()=>{
 const signatures=new Set();for(const id of Object.keys(SHIPS)){const model=makeShip(id);let vertices=0,draws=0;model.traverse(o=>{if(o.isMesh){draws++;const a=o.geometry.getAttribute('position');vertices+=a.count;assert.ok(Array.from(a.array).every(Number.isFinite),id);}});const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());assert.ok(size.z>14&&size.x>35&&size.y>50,id+' must be a substantial 3D hull');assert.ok(vertices>6000,id+' must retain detailed geometry');assert.ok(draws<=15,id+' batching keeps draw calls bounded');signatures.add([vertices,size.x,size.y,size.z].join(':'));disposeModel(model);}assert.equal(signatures.size,24);
 for(const f of factionIds){const m=makeStation(f);assert.ok(m.children.length>=3);disposeModel(m);}
});

test('planets render first and their depth is cleared before the ship scene',()=>{
 const events=[],sky={},ships={},camera={};const renderer={clear:()=>events.push('clear'),clearDepth:()=>events.push('clearDepth'),render:(scene,c)=>{assert.equal(c,camera);events.push(scene);}};renderFlightLayers(renderer,sky,ships,camera);assert.deepEqual(events,['clear',sky,'clearDepth',ships]);
});

test('an unprovoked civilian hit sends distress, costs standing, closes ports and summons security',()=>{
 const g=new Universe(undefined,{dynamic:false}),c=g.contacts.find(c=>c.kind==='trader'),before=g.standing();g.damageContact(c,1);assert.equal(g.standing(),before-12);assert.equal(c.distressed,true);assert.equal(g.alert,true);assert.equal(g.dockingAllowed,false);assert.ok(g.contacts.filter(c=>c.id.startsWith('security-')).length===2);assert.ok(g.contacts.filter(c=>c.kind==='patrol').every(c=>g.isHostile(c)));g.s.x=STATION.x;g.s.y=STATION.y;assert.equal(g.dock(),false);g.damageContact(c,1);assert.equal(g.standing(),before-12,'one offence per victim, not per beam frame');
 const r=new Universe(Universe.validate(decodeSave(encodeSave(g.s))));assert.equal(r.alert,true);assert.equal(r.standing(),before-12);assert.equal(r.contacts.find(ship=>ship.id===c.id).provoked,true);
});

test('civilian destruction pays no bounty and persists across reloads and system visits',()=>{
 const g=new Universe(undefined,{dynamic:false}),c=g.contacts.find(c=>c.kind==='trader'),credits=g.s.credits;g.damageContact(c,5000);assert.equal(g.s.credits,credits);assert.equal(g.standing(),-17);assert.ok(g.s.losses.includes(c.id));g.populate();assert.ok(!g.contacts.some(ship=>ship.id===c.id));const r=new Universe(structuredClone(g.s),{dynamic:false});assert.ok(!r.contacts.some(ship=>ship.id===c.id));
});

test('negative faction reputation makes its other systems hostile while other factions stay neutral',()=>{
 const g=new Universe(undefined,{dynamic:false});g.reputationChange('union',-26);assert.equal(g.relation('union'),'Hostile');g.s.system=2;g.populate();assert.ok(g.contacts.filter(c=>c.kind==='patrol').every(c=>g.isHostile(c)));assert.equal(g.dockingAllowed,false);g.s.system=1;g.populate();assert.equal(g.relation(),'Neutral');assert.equal(g.dockingAllowed,true);assert.ok(g.contacts.filter(c=>c.kind==='patrol').every(c=>!g.isHostile(c)));
});

test('local fines clear alerts without buying away faction hostility',()=>{
 const g=new Universe(undefined,{dynamic:false}),c=g.contacts.find(c=>c.kind==='trader');g.damageContact(c,1);assert.equal(g.payFine(),true);assert.equal(g.s.credits,1800);assert.equal(g.alert,false);assert.equal(g.standing(),13);assert.equal(g.dockingAllowed,true);assert.equal(g.payFine(),false);g.damageContact(c,5000);g.s.credits=10000;assert.equal(g.payFine(),true);assert.equal(g.alert,false);assert.ok(g.standing()<0);assert.equal(g.dockingAllowed,false);
});

test('response patrols pursue and shoot, while frightened civilian traffic flees',()=>{
 const g=new Universe(undefined,{dynamic:false}),civilian=g.contacts.find(c=>c.kind==='trader');g.s.x=600;g.s.y=20;g.damageContact(civilian,1);const before={x:civilian.x,y:civilian.y};step(g,.4);assert.ok(Math.hypot(civilian.x-before.x,civilian.y-before.y)>40);assert.ok(civilian.distressed);g.contacts=g.contacts.filter(c=>c.id.startsWith('security-'));const patrol=g.contacts[0];patrol.x=g.s.x+400;patrol.y=g.s.y;patrol.fire=0;const x=patrol.x;step(g,.1);assert.notEqual(patrol.x,x);assert.ok(g.s.shield<100||g.bullets.some(b=>b.enemy)||g.beams.some(b=>b.enemy));
});

test('survey rewards are one-time, aid consumes cargo, and planet operations obey range and cooldown',()=>{
 const g=quiet(),w=g.worlds[0];g.s.x=4000;assert.equal(g.scanPlanet(w.id),false);g.s.x=w.x+w.radius+100;g.s.y=w.y;const credits=g.s.credits;assert.equal(g.scanPlanet(w.id),true);assert.equal(g.s.credits,credits+350);assert.equal(g.scanPlanet(w.id),false);g.s.cargo[3]=6;const rep=g.standing();assert.equal(g.planetAction(w.id,'aid'),true);assert.equal(g.s.cargo[3],3);assert.equal(g.standing(),rep+8);assert.equal(g.planetAction(w.id,'aid'),false);g.s.time+=121;assert.equal(g.planetAction(w.id,'aid'),true);assert.equal(g.s.cargo[3],0);assert.equal(g.planetAction(w.id,'mine'),false);
 const gas=g.worlds[2];g.s.x=gas.x;g.s.y=gas.y;g.s.fuel=90;assert.equal(g.planetAction(gas.id,'fuel'),true);assert.equal(g.s.fuel,100);
 const rock=g.worlds[4];g.s.x=rock.x;g.s.y=rock.y;assert.equal(g.planetAction(rock.id,'mine'),true);assert.equal(g.s.cargo[rock.good],3);
});

test('civilian trade uses actual credits, stock, capacity, standing and reserved cargo',()=>{
 const g=new Universe(undefined,{dynamic:false}),c=g.contacts.find(c=>c.kind==='trader');g.s.x=c.x;g.s.y=c.y;const before=g.s.credits;assert.equal(g.civilianTrade(c.id,c.good,1,true),true);assert.equal(g.s.cargo[c.good],1);assert.equal(g.s.credits,before-Math.floor(g.price[c.good]*1.08));assert.equal(c.quantity,9);const r=new Universe(structuredClone(g.s),{dynamic:false});assert.equal(r.contacts.find(v=>v.id===c.id).quantity,9);assert.equal(g.civilianTrade(c.id,c.good,100,true),false);assert.equal(g.civilianTrade(c.id,c.good,1,'buy'),false);g.s.contracts.push({id:'reserved',type:'delivery',good:c.good,quantity:1,done:false});assert.equal(g.civilianTrade(c.id,c.good,1,false),false);g.s.contracts=[];g.s.x+=600;assert.equal(g.civilianTrade(c.id,c.good,1,false),false);g.s.x=c.x;g.damageContact(c,1);assert.equal(g.civilianTrade(c.id,c.good,1,false),false);
});

test('phaser and heavy laser are instant beams with different reach and energy costs',()=>{
 for(const weapon of ['phaser','laser']){const g=quiet();g.s.x=0;g.s.y=0;const c=dummy('beam-target','hostile',500,0);g.contacts=[c];g.target=c.id;g.setWeapon(weapon);assert.equal(g.fire(),true);assert.equal(g.bullets.length,0);assert.equal(g.beams.length,1);assert.equal(c.hull,1000-g.stats.damage*WEAPONS[weapon].multiplier*(weapon==='phaser'?.05:1));assert.equal(g.s.energy,100-WEAPONS[weapon].energy*(weapon==='phaser'?.05:1));assert.equal(g.fire(),weapon==='phaser');}
 const g=quiet(),c=dummy('distant','hostile',950,0);g.contacts=[c];g.target=c.id;g.s.x=0;g.s.y=0;g.s.angle=-Math.PI/2;g.fire();assert.equal(c.hull,1000);g.cooldown=0;g.setWeapon('laser');g.fire();assert.ok(c.hull<1000);
});

test('torpedoes travel over time and preferentially deplete shields',()=>{
 const g=quiet(),c=dummy('torpedo-target','trader',500,0);g.contacts=[c];c.shield=180;g.s.x=0;g.s.y=0;g.target=c.id;g.setWeapon('torpedo');g.fire();assert.equal(c.shield,180);assert.equal(g.bullets[0].kind,'torpedo');c.kind='station';c.fire=999;step(g,1.5);assert.equal(c.shield,0);assert.ok(c.hull<860);
});

test('seeker missiles arc out, steer toward their target and deal damage',()=>{
 const g=quiet(),c=dummy('missile-target','station',800,0);g.contacts=[c];g.s.x=0;g.s.y=0;g.target=c.id;g.setWeapon('missile');g.fire();const first=g.bullets[0],initialDirection=Math.atan2(first.vy,first.vx);step(g,.6);assert.ok(Math.abs(first.y)>20);assert.ok(Math.abs(Math.atan2(first.vy,first.vx)-initialDirection)>.25);assert.ok(first.trail.length>10);step(g,3);assert.ok(c.hull<1000);assert.equal(g.bullets.filter(b=>!b.enemy).length,0);
});

test('beam damage cannot be farmed on planets; orphaned seekers expire safely',()=>{
 const g=quiet(),world=g.contacts.find(c=>c.kind==='planet');g.target=world.id;g.s.x=world.x-100;g.s.y=world.y;g.damageContact(world,1000);assert.equal(world.hull,1);assert.equal(g.standing(),25);g.contacts=[dummy('vanishing','hostile',600,0)];g.s.x=0;g.s.y=0;g.target='vanishing';g.setWeapon('missile');g.fire();g.contacts=[];step(g,7);assert.equal(g.bullets.length,0);assert.ok(Number.isFinite(g.s.x));
});

test('allied shipyards unlock faction capital ships and preserve a transferred cargo hold',()=>{
 for(const f of factionIds){const g=new Universe(undefined,{dynamic:false});g.s.system=SYSTEMS.find(s=>s.factionId===f).id;g.populate();g.s.x=STATION.x;g.s.y=STATION.y;g.dock();g.s.credits=100000;const capital=fleetFor(f)[3];g.buyShip(capital);assert.equal(g.s.ship,'courier');g.reputationChange(f,25);g.s.cargo[0]=10;g.buyShip(capital);assert.equal(g.s.ship,capital);assert.equal(g.s.cargo[0],10);assert.equal(g.s.hull,SHIPS[capital].hull);assert.equal(g.s.credits,100000-SHIPS[capital].price);}
});

test('a bounty remains completable when the original pirates were already destroyed',()=>{
 const g=new Universe(undefined,{dynamic:false});for(const c of [...g.contacts].filter(c=>c.kind==='hostile'))g.damageContact(c,5000);g.contacts=g.contacts.filter(c=>c.hull>0);g.s.x=STATION.x;g.s.y=STATION.y;g.dock();g.accept('bounty-0');assert.equal(g.contacts.filter(c=>c.kind==='hostile').length,2);const r=new Universe(structuredClone(g.s),{dynamic:false});assert.equal(r.contacts.filter(c=>c.kind==='hostile').length,2);for(const c of r.contacts.filter(c=>c.kind==='hostile'))r.damageContact(c,5000);assert.equal(r.s.contracts[0].progress,2);
});

test('destroyed stations stay local; recovery finds a usable friendly port even from a paused menu',()=>{
 const g=new Universe(undefined,{dynamic:false}),station=g.contacts.find(c=>c.kind==='station');g.damageContact(station,20000);assert.ok(g.s.losses.includes('port-0'));g.s.system=1;g.populate();assert.ok(g.contacts.some(c=>c.kind==='station'));g.s.system=0;g.populate();assert.ok(!g.contacts.some(c=>c.kind==='station'));g.paused=true;g.emergencyTow();assert.notEqual(g.s.system,0);assert.equal(g.docked,true);assert.ok(g.dockingAllowed);assert.ok(g.s.hull>0);
});

test('old saves migrate without losing progress and malformed expansion fields are rejected',()=>{
 const old=initialState();for(const key of ['factionRep','incidents','surveyed','harvested','losses','provoked','weapon','trafficStock'])delete old[key];old.credits=9340;old.reputation=15;old.cargo[0]=8;const g=new Universe(Universe.validate(old));assert.equal(g.s.credits,9340);assert.equal(g.s.cargo[0],8);assert.equal(g.standing(),40);assert.equal(g.s.weapon,'phaser');assert.equal(Universe.validate({...g.s,factionRep:{union:-101}}),null);assert.equal(Universe.validate({...g.s,weapon:'death-ray'}),null);assert.equal(Universe.validate({...g.s,incidents:{0:{fine:-1,until:5}}}),null);assert.equal(Universe.validate({...g.s,trafficStock:{abc:11}}),null);
});

test('a fully explored expanded campaign including conflicts fits verified cookie saves',()=>{
 const g=new Universe(undefined,{dynamic:false});g.s.ship='citadel';g.s.time=125000;g.s.credits=1500000;g.s.upgrades={weapon:3,shield:3,engine:3,cargo:3};g.s.visited=SYSTEMS.map(s=>s.id);
 for(const sys of SYSTEMS){g.s.system=sys.id;g.populate();for(const c of g.offers){g.s.contracts.push({...c,done:true,progress:c.quantity});g.s.completed.push(c.id);}for(const w of g.worlds){g.s.surveyed.push(w.id);g.s.harvested[w.id]=125000;}for(const c of g.contacts.filter(c=>['trader','patrol','hostile'].includes(c.kind))){g.s.losses.push(c.id);g.s.provoked.push(c.id);if(c.kind==='trader')g.s.trafficStock[c.id]=0;}g.s.incidents[sys.id]={until:125300,fine:4000};g.s.stocks[sys.id]=[40,55,20,44,40,9];}
 for(const sys of SYSTEMS){g.s.galaxy.conditions[sys.id]={kind:'siege',until:126000,serial:sys.id+100,faction:'union'};g.s.galaxy.supply[sys.id]=-40;g.s.galaxy.encounters[sys.id]=124999;g.s.galaxy.owners[sys.id]=sys.id%2?'forge':'union';g.s.losses.push('port-'+sys.id,...planetsFor(sys.id).filter(w=>w.inhabited).map(w=>'battery-'+w.id));}g.s.galaxy.news=Array.from({length:12},(_,i)=>({id:i,time:125000-i,system:i,text:'An assault fleet has entered '+SYSTEMS[i].name+'. Planetary defence grids are responding.'}));g.s.equipment={pointDefense:2,antimatter:true,ammo:3};
 const state=Universe.validate(g.s);assert.ok(state);const encoded=encodeSave(state);assert.ok(encoded.length<=14400,encoded.length+' encoded chars');assert.ok(JSON.stringify(state).length<=100000);assert.deepEqual(decodeSave(encoded),state);
 const map=new Map();const jar={path:'/voidwake/',secure:true,read:()=>[...map].map(([k,v])=>k+'='+v).join('; '),write:text=>{assert.ok(text.length<4096);const [pair]=text.split(';'),i=pair.indexOf('=');map.set(pair.slice(0,i),pair.slice(i+1));}};assert.equal(saveToCookies(state,jar),true);assert.deepEqual(loadCookieSave(jar),state);
});
