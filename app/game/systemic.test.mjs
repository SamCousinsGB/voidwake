import test from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import * as THREE from 'three';
import {Universe,initialState,SYSTEMS,SHIPS,WEAPONS,STATION,factionIds,supportsPointDefense} from './engine.ts';
import {initialGalaxy,spawnEvent,tickGalaxy,pricesFor,ownerOf,tradeRoutes,atWar} from './galaxy.ts';
import {chooseTarget,enemies,shootNPC,pointDefense,detonate,tickBattle} from './battle.ts';
import {encodeSave,decodeSave} from './cookies.ts';
import {captainFor} from './captains.ts';
import {createBattleEffects} from './BattleEffects.ts';
const step=(g,seconds,dt=.02)=>{for(let i=0;i<Math.round(seconds/dt);i++)g.update(dt);};
const ship=(id,kind='hostile',x=400,y=0,faction)=>({id,name:id,kind,x,y,vx:0,vy:0,angle:0,hull:1000,maxHull:1000,shield:0,fire:999,radius:25,faction});
const quiet=()=>{const g=new Universe(undefined,{dynamic:false});g.contacts=[];g.s.x=g.s.y=0;return g;};
const shot=(kind='missile',props={})=>({id:777,x:0,y:0,vx:0,vy:0,life:7,kind,enemy:false,damage:126,source:'player',side:'player',...props});

test('arrival creates an actual pirate attack on a convoy, with local escorts fighting independently',()=>{
 const g=new Universe(),raider=g.contacts.find(c=>c.role==='raider'),convoy=g.contacts.find(c=>c.role==='convoy'),escort=g.contacts.find(c=>c.role==='escort');
 assert.equal(g.condition.kind,'raid');assert.equal(chooseTarget(g,raider).kind,'trader');assert.equal(chooseTarget(g,escort).kind,'hostile');
 raider.fire=0;const victim=chooseTarget(g,raider),before=victim.hull+victim.shield;shootNPC(g,raider,victim,.05);assert.ok(victim.hull+victim.shield<before);assert.equal(g.s.kills,0);assert.equal(g.s.credits,2400);
 const pos={x:convoy.x,y:convoy.y};step(g,.5);assert.ok(convoy.distressed);assert.ok(Math.hypot(convoy.x-pos.x,convoy.y-pos.y)>50);
});

test('NPC kills affect supplies but never grant player credits, crime, or contract progress',()=>{
 const g=new Universe(),convoy=g.contacts.find(c=>c.role==='convoy'),standing=g.standing();g.s.contracts.push({id:'bounty',type:'bounty',target:0,progress:0,done:false});
 g.damageContact(convoy,9999,'laser','corsair');assert.equal(g.s.galaxy.supply[0],-8);assert.equal(g.s.credits,2400);assert.equal(g.s.kills,0);assert.equal(g.standing(),standing);assert.equal(g.alert,false);assert.equal(g.s.contracts[0].progress,0);
 const pirate=g.contacts.find(c=>c.role==='raider');g.damageContact(pirate,9999,'phaser','escort');assert.equal(g.s.contracts[0].progress,0);assert.equal(g.s.credits,2400);
});

test('relief convoys replenish real stock and lower prices; shortages affect medicine and food',()=>{
 const g=quiet();spawnEvent(g,'shortage');const normal=SYSTEMS[0].prices;assert.ok(pricesFor(g,0)[3]>normal[3]*1.6);assert.equal(pricesFor(g,0)[2],normal[2]);
 g.contacts=[];spawnEvent(g,'convoy');g.contacts=g.contacts.filter(c=>c.role==='convoy');const c=g.contacts[0];c.x=STATION.x;c.y=STATION.y;const before=[...g.stock];step(g,.02);assert.deepEqual(g.stock,before.map(n=>n+8));assert.equal(g.s.galaxy.supply[0],10);assert.ok(g.price[0]<normal[0]);assert.equal(g.condition,undefined);
});

test('an interdiction station blocks only its route, and destroying it opens that route without a local crime',()=>{
 const g=quiet(),condition=spawnEvent(g,'blockade'),station=g.contacts.find(c=>c.role==='blockade');assert.ok(condition.route!==undefined);assert.equal(g.startJump(condition.route),false);assert.match(g.message,/blockad|interdict/i);
 const alternative=tradeRoutes(0).find(id=>id!==condition.route);assert.notEqual(alternative,undefined);assert.equal(g.startJump(alternative),true);g.jump=null;
 const rep=g.standing();g.damageContact(station,10000,'torpedo');assert.equal(g.standing(),rep);assert.equal(g.alert,false);assert.equal(g.blockedRoute,undefined);assert.equal(g.startJump(condition.route),true);
});

test('siege worlds launch three curved missiles at invaders, and those invaders cannot attack their own faction',()=>{
 const g=new Universe();g.s.system=11;g.populate();const battery=g.contacts.find(c=>c.role==='battery'),invader=g.contacts.find(c=>c.role==='invader');assert.equal(invader.faction,'union');
 invader.x=battery.x+600;invader.y=battery.y;battery.fire=0;shootNPC(g,battery,invader,.05);const volley=g.bullets.filter(b=>b.source===battery.id);assert.equal(volley.length,3);assert.ok(volley.every(b=>b.kind==='missile'&&b.target===invader.id));assert.equal(new Set(volley.map(b=>b.vy)).size,3);
 const friendly={...battery,faction:invader.faction};assert.equal(enemies(g,invader,friendly),false);
});

test('war offensives capture territory, update local control, advance fronts, and end in ceasefires',()=>{
 const g=quiet();g.dynamic=true;g.s.system=11;g.populate();const war=g.s.galaxy.wars[0];war.pressure=99;war.next=0;const front=war.front;tickGalaxy(g);assert.equal(ownerOf(g,front),'union');assert.equal(g.faction,'union');assert.equal(g.contacts.find(c=>c.id==='station').faction,'union');assert.ok(g.s.galaxy.news.some(n=>n.text.includes('fell to')));assert.ok(war.front!==front||war.ends===g.s.time);
 for(const w of g.s.galaxy.wars)w.ends=0;tickGalaxy(g);assert.equal(g.s.galaxy.wars.length,0);assert.equal(atWar(g,'union','syndicate'),false);assert.ok(g.s.galaxy.news.some(n=>n.text.includes('ceasefire')));
 const r=new Universe(Universe.validate(decodeSave(encodeSave(g.s))),{dynamic:false});assert.equal(r.owner(front),'union');
});

test('local defender losses advance a war and destroying invaders reduces assault pressure',()=>{
 const g=new Universe();g.s.system=11;g.populate();const w=g.s.galaxy.wars[0],battery=g.contacts.find(c=>c.role==='battery');const before=w.pressure;g.damageContact(battery,9999,'torpedo','attacker');assert.equal(w.pressure,before+12);const invader=g.contacts.find(c=>c.role==='invader');g.damageContact(invader,9999,'laser','defender');assert.equal(w.pressure,before);
});

test('phasers sustain one uninterrupted beam and apply frame-independent damage and energy drain',()=>{
 const results=[];for(const dt of [.01,.02,.05]){const g=quiet(),target=ship('target','station',500);target.faction=undefined;g.contacts=[target];g.target=target.id;g.keys.add(' ');for(let i=0;i<1/dt;i++){g.update(dt);assert.equal(g.beams.filter(b=>b.id===-1).length,1);assert.ok(g.beams[0].life>0);}results.push({hull:target.hull,energy:g.s.energy});g.keys.clear();step(g,.2);assert.equal(g.beams.length,0);assert.equal(g.beamSound,false);}
 for(const result of results){assert.ok(Math.abs(result.hull-(1000-18*3.2))<.001);assert.ok(result.energy>89&&result.energy<90.01);}assert.ok(Math.abs(results[0].energy-results[2].energy)<1);
});

test('phaser exhaustion recovers, pause stops its loop, and weapon switching leaves no beam behind',()=>{
 const g=quiet();g.target='empty';g.s.energy=.1;assert.equal(g.fire(.05),false);assert.equal(g.phaserLocked,true);step(g,1.5);assert.equal(g.phaserLocked,false);g.keys.add(' ');step(g,.1);assert.equal(g.beamSound,true);const sounds=[];g.onSound=t=>sounds.push(t);g.paused=true;g.update(.02);assert.ok(sounds.includes('phaser-stop'));assert.equal(g.beams.length,0);g.paused=false;g.keys.clear();g.setWeapon('missile');step(g,.2);assert.equal(g.beamSound,false);
});

test('missiles have area damage and siege torpedoes deliver a larger shield-breaking blast',()=>{
 const g=quiet(),a=ship('a','hostile',500),b=ship('b','hostile',570),outside=ship('outside','hostile',700);g.contacts=[a,b,outside];detonate(g,shot('missile',{x:500}));assert.ok(a.hull<900);assert.ok(b.hull<1000);assert.equal(outside.hull,1000);assert.ok(g.shake>0);assert.equal(g.effects[0].radius,95);
 const t=quiet(),shielded=ship('shielded','hostile',500);shielded.shield=180;t.contacts=[shielded,ship('splash','hostile',650)];detonate(t,shot('torpedo',{x:500,damage:18*14}));assert.equal(shielded.shield,0);assert.ok(shielded.hull<860);assert.ok(t.contacts.find(c=>c.id==='splash').hull<1000);assert.equal(t.effects[0].radius,180);
});

test('point defence intercepts missiles without detonating them and ignores torpedoes and friendly outbound fire',()=>{
 const g=quiet();g.s.ship='sentinel';g.s.equipment.pointDefense=1;const missile=shot('missile',{x:100,enemy:true,source:'pirate',side:'pirate',target:'player'}),torpedo=shot('torpedo',{id:778,x:80,enemy:true,source:'pirate',target:'player'});g.bullets=[missile,torpedo];pointDefense(g,.02);assert.equal(missile.life,0);assert.equal(missile.detonated,undefined);assert.equal(torpedo.life,7);assert.equal(g.s.energy,95);assert.equal(g.interceptions,1);assert.ok(g.effects.every(e=>e.kind==='intercept'));
 const second=shot('missile',{id:779,x:50,enemy:true,target:'player'});g.bullets.push(second);pointDefense(g,.02);assert.equal(second.life,7,'cooldown prevents another immediate intercept');
 g.dynamic=true;g.contacts=[ship('friendly','station',500,0,'union')];g.bullets=[shot('missile',{x:510,target:'pirate'})];pointDefense(g,.02);assert.equal(g.bullets[0].life,7,'friendly station must not intercept pirate-hunting shots');g.bullets[0].target='friendly';pointDefense(g,.02);assert.equal(g.bullets[0].life,0,'station defends itself against a targeted attack');
});

test('point defence purchases enforce compatible hulls, price, level and energy',()=>{
 const g=quiet();g.docked=true;g.s.credits=100000;assert.equal(supportsPointDefense('courier'),false);assert.equal(g.installEquipment('pointDefense'),false);g.s.ship='freighter';assert.equal(g.installEquipment('pointDefense'),true);assert.equal(g.s.credits,95500);assert.equal(g.installEquipment('pointDefense'),true);assert.equal(g.s.credits,86500);assert.equal(g.installEquipment('pointDefense'),false);g.docked=false;g.s.energy=4;const b=shot('missile',{x:30,enemy:true,target:'player'});g.bullets=[b];pointDefense(g,.02);assert.equal(b.life,7);
});

test('rare antimatter installation and ammunition obey depot stock, allied standing, hull and reload persistence',()=>{
 const g=quiet();g.docked=true;g.s.ship='sentinel';g.s.credits=100000;assert.equal(g.installEquipment('antimatter'),false);g.s.system=6;g.populate();assert.equal(g.installEquipment('antimatter'),false);g.reputationChange(g.faction,25);assert.equal(g.installEquipment('antimatter'),true);assert.equal(g.s.equipment.ammo,1);assert.equal(g.s.galaxy.rare[6].stock,0);assert.equal(g.buyAntimatter(),false);assert.equal(g.s.credits,68000);
 const r=new Universe(Universe.validate(decodeSave(encodeSave(g.s))),{dynamic:false});assert.equal(r.s.equipment.antimatter,true);assert.equal(r.s.equipment.ammo,1);assert.equal(r.s.galaxy.rare[6].stock,0);r.s.time=901;tickGalaxy(r);assert.equal(r.s.galaxy.rare[6].stock,1);assert.equal(r.buyAntimatter(),true);assert.equal(r.s.equipment.ammo,2);
});

test('antimatter annihilates every shielded ship and station inside 350 m, consumes ammunition, and preserves worlds',()=>{
 const g=quiet();g.s.ship='sentinel';g.setWeapon('antimatter');assert.equal(g.fire(),false);g.s.equipment={pointDefense:0,antimatter:true,ammo:1};const a=ship('enemy','hostile',500),station=ship('station-target','station',800,0,'syndicate'),outside=ship('outside','hostile',851),world=ship('world','planet',500);a.shield=10000;station.hull=10000;station.shield=20000;g.contacts=[a,station,outside,world];g.target=a.id;assert.equal(g.fire(),true);assert.equal(g.s.equipment.ammo,0);const b=g.bullets[0];b.x=500;b.y=0;detonate(g,b);assert.ok(a.hull<=0);assert.ok(station.hull<=0);assert.equal(outside.hull,1000);assert.equal(world.hull,1000);assert.equal(g.effects[0].kind,'singularity');g.cooldown=0;g.s.energy=100;assert.equal(g.fire(),false);assert.ok(g.standing('syndicate')<0,'collateral destruction retains diplomatic consequences');
});

test('research wrecks award one persistent warhead; resolved encounters do not respawn on reload',()=>{
 const g=quiet();spawnEvent(g,'relic');const relic=g.contacts[0];g.s.x=relic.x;g.s.y=relic.y;step(g,.02);assert.equal(g.s.equipment.ammo,1);assert.equal(g.s.credits,3300);assert.equal(g.condition,undefined);const r=new Universe(Universe.validate(decodeSave(encodeSave(g.s))));assert.equal(r.s.equipment.ammo,1);assert.ok(!r.contacts.some(c=>c.role==='relic'));
});

test('captain identities are stable and cover all twelve human and alien portrait cells',()=>{
 const cells=new Set();for(const f of factionIds)for(const id of ['captain-0','captain-1']){const c={id,faction:f,kind:'trader'},a=captainFor(c,'union');assert.deepEqual(a,captainFor(c,'forge'));assert.ok(a.name&&a.race);assert.ok(a.column>=0&&a.column<4&&a.row>=0&&a.row<3);cells.add(a.index);}assert.equal(cells.size,12);assert.equal(captainFor({id:'pirate',kind:'hostile'},'union').race,'Ashen');
});

test('explosion and singularity geometry uses bounded materials and disposes expired effects',()=>{
 const scene=new THREE.Scene(),renderer=createBattleEffects(scene);renderer.update([{id:1,x:100,y:20,radius:350,life:2,maxLife:3.5,color:'#d9acff',kind:'singularity'}]);assert.equal(scene.children.length,1);const mesh=scene.children[0];assert.equal(mesh.material.uniforms.singularity.value,1);assert.equal(mesh.material.depthTest,false);let disposed=false;mesh.geometry.addEventListener('dispose',()=>disposed=true);renderer.update([]);assert.equal(scene.children.length,0);assert.ok(disposed);
});

test('legacy LZ saves migrate to the denser cookie codec and malformed world fields are rejected',()=>{
 const s=initialState();delete s.galaxy;delete s.equipment;s.credits=9999;const legacy=LZString.compressToEncodedURIComponent(JSON.stringify(s)),g=new Universe(Universe.validate(decodeSave(legacy)),{dynamic:false});assert.equal(g.s.credits,9999);assert.equal(g.s.equipment.ammo,0);assert.equal(g.s.galaxy.wars.length,2);assert.deepEqual(decodeSave(encodeSave(g.s)),g.s);
 assert.equal(Universe.validate({...g.s,equipment:{pointDefense:3,antimatter:true,ammo:9}}),null);const bad=structuredClone(g.s);bad.galaxy.conditions[0]={kind:'blockade',until:100,serial:1};assert.equal(Universe.validate(bad),null);
});

test('an hour of autonomous wars and encounters stays bounded, finite and saveable',()=>{
 const g=new Universe();g.docked=true;for(let minute=0;minute<60;minute++){g.s.system=minute%48;g.populate();for(let i=0;i<1200;i++)g.update(.05);assert.ok(g.contacts.length<=60);assert.ok(g.bullets.length<=200);assert.ok(g.beams.length<=80);assert.ok(g.effects.length<=40);assert.ok(g.particles.length<=1024);assert.ok(g.contacts.every(c=>[c.x,c.y,c.hull,c.shield].every(Number.isFinite)));assert.ok(Universe.validate(g.s),'valid state at minute '+minute);}
 assert.ok(g.s.galaxy.news.length<=12);assert.ok(Object.keys(g.s.galaxy.conditions).length<=48);assert.ok(Object.keys(g.s.galaxy.owners).length>0);assert.ok(g.s.galaxy.wars.length<=4);assert.ok(encodeSave(g.s).length<14400);assert.deepEqual(decodeSave(encodeSave(g.s)),g.s);
});
