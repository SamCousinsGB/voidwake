import test from 'node:test';
import assert from 'node:assert/strict';
import { Universe, SYSTEMS, STATION, fuelCost, systemDistance, SAVE_KEY } from './engine.ts';
import { gameTools } from './webmcp.ts';
const step=(game,seconds)=>{for(let t=0;t<seconds;t+=.02)game.update(.02);};
const atStation=()=>{const g=new Universe();g.s.x=STATION.x-100;g.s.y=STATION.y;g.dock();return g;};

test('manual thrust accelerates, steering turns and brakes stop the ship',()=>{
 const g=new Universe();g.keys.add('w');step(g,2);assert.ok(Math.hypot(g.s.vx,g.s.vy)>180);const before=g.s.angle;g.keys.clear();g.keys.add('a');step(g,.5);assert.ok(g.s.angle>before+1);g.keys.clear();g.keys.add('s');step(g,2);assert.ok(Math.hypot(g.s.vx,g.s.vy)<1);
});
test('autopilot actually flies to the station and docks',()=>{
 const g=new Universe();let opened=false;g.onDock=()=>opened=true;g.dock();assert.equal(g.autoDock,true);step(g,12);assert.equal(g.docked,true);assert.equal(opened,true);assert.equal(g.s.vx,0);g.undock();assert.equal(g.docked,false);assert.ok(Math.hypot(g.s.x-STATION.x,g.s.y-STATION.y)<185);
});
test('market enforces credits, capacity, integer quantity, cargo and station access',()=>{
 const g=new Universe();assert.equal(g.trade(0,5,true).ok,false);g.s.x=STATION.x;g.s.y=STATION.y;g.dock();const before=g.s.credits;assert.equal(g.trade(0,5,true).ok,true);assert.equal(g.s.credits,before-210);assert.equal(g.s.cargo[0],5);assert.equal(g.stock[0],75);assert.equal(g.trade(0,31,true).ok,false);assert.equal(g.trade(2,20,true).ok,false);assert.equal(g.trade(0,-1,true).ok,false);assert.equal(g.trade(0,.5,true).ok,false);assert.equal(g.trade(6,1,true).ok,false);assert.equal(g.trade(0,6,false).ok,false);assert.equal(g.trade(0,5,false).ok,true);assert.equal(g.s.cargo[0],0);assert.ok(g.s.credits<before,'buy-sell spread must prevent local arbitrage');
});
test('travel consumes exact fuel once, visits new system and preserves cargo',()=>{
 const g=new Universe();g.s.cargo[0]=8;const fuel=g.s.fuel;assert.equal(g.startJump(5),false,'far system requires intermediate jump');assert.equal(g.startJump(1),true);assert.equal(g.startJump(2),false,'only one jump can be queued');step(g,4);assert.equal(g.s.system,1);assert.equal(g.s.fuel,fuel-fuelCost(0,1));assert.equal(g.s.cargo[0],8);assert.deepEqual(g.s.visited,[0,1]);assert.equal(g.jump,null);assert.equal(g.startJump(1),false);g.s.fuel=0;assert.equal(g.startJump(0),false);
});
test('all seven systems are connected within jump range',()=>{
 const visited=new Set([0]);let changed=true;while(changed){changed=false;for(const a of [...visited])for(const b of SYSTEMS)if(systemDistance(a,b.id)<=5.8&&!visited.has(b.id)){visited.add(b.id);changed=true;}}assert.equal(visited.size,7);
});
test('a complete trade route produces the expected profit after fuel',()=>{
 const g=atStation();g.trade(0,20,true);g.undock();g.startJump(1);step(g,3.1);g.dock();step(g,12);assert.equal(g.docked,true);g.trade(0,20,false);assert.equal(g.s.credits,2400-20*42+20*74);assert.equal(g.usedCargo,0);assert.equal(g.s.fuel,80-fuelCost(0,1));
});
test('freight contracts reserve cargo, deliver at destination and pay only once',()=>{
 const g=atStation();const offer=g.offers.find(c=>c.type==='delivery');g.accept(offer.id);assert.equal(g.s.cargo[0],8);assert.equal(g.availableCargo(0),0);assert.equal(g.trade(0,1,false).ok,false);const credits=g.s.credits;g.complete(offer.id);assert.equal(g.s.credits,credits,'wrong destination must not pay');g.undock();g.startJump(offer.target);step(g,3.1);g.dock();step(g,12);g.complete(offer.id);assert.equal(g.s.credits,credits+offer.reward);assert.equal(g.s.cargo[0],0);assert.equal(g.s.completed.length,1);g.complete(offer.id);assert.equal(g.s.credits,credits+offer.reward);
});
test('abandoning a freight contract reclaims the supplied cargo',()=>{
 const g=atStation();g.accept('delivery-0');g.cancelContract('delivery-0');assert.equal(g.usedCargo,0);assert.equal(g.s.contracts.length,0);assert.equal(g.s.credits,2400);
});
test('pulse cannon hits targeted hostiles, grants bounty and creates salvage',()=>{
 const g=new Universe();g.s.x=800;g.s.y=0;g.contacts=g.contacts.filter(c=>c.kind==='station');g.contacts.push({id:'pirate-0',name:'Target',kind:'hostile',x:1050,y:0,vx:0,vy:0,angle:0,hull:80,maxHull:80,shield:0,fire:99});g.target='pirate-0';g.keys.add(' ');const before=g.s.credits;step(g,5);assert.equal(g.s.kills,1);assert.equal(g.s.credits,before+240);assert.ok(g.contacts.some(c=>c.kind==='salvage'));assert.ok(!g.contacts.some(c=>c.id==='pirate-0'));assert.ok(g.s.energy>=0);
});
test('hostile shots deplete shields then damage the hull; shields regenerate',()=>{
 const g=new Universe();g.s.x=800;g.s.y=0;g.s.shield=10;g.sinceHit=0;const hull=g.s.hull;g.bullets.push({id:1,x:g.s.x,y:g.s.y,vx:0,vy:0,life:1,enemy:true,damage:20});g.update(.01);assert.equal(g.s.shield,0);assert.equal(g.s.hull,hull-10);g.contacts=g.contacts.filter(c=>c.kind==='station');step(g,7);assert.ok(g.s.shield>15);assert.equal(g.s.hull,hull-10);
});
test('bounty contracts count only kills after acceptance and pay at the origin',()=>{
 const g=atStation();g.accept('bounty-0');g.undock();g.s.x=800;g.s.y=0;g.contacts=g.contacts.filter(c=>c.kind==='station');for(let i=0;i<2;i++){g.contacts.push({id:`pirate-${i}`,name:'Target',kind:'hostile',x:1040,y:i*20,vx:0,vy:0,angle:0,hull:18,maxHull:18,shield:0,fire:99});g.target=`pirate-${i}`;g.keys.add(' ');step(g,1);g.keys.clear();}const c=g.s.contracts[0];assert.equal(c.progress,2);g.s.x=STATION.x;g.s.y=STATION.y;g.dock();const before=g.s.credits;g.complete(c.id);assert.equal(g.s.credits,before+c.reward);
});
test('ship destruction recovers without a credit or fuel softlock',()=>{
 const g=new Universe();g.s.credits=1000;g.s.cargo[1]=20;g.s.hull=-1;g.s.fuel=0;let rescued=false;g.onRescue=()=>rescued=true;g.update(.01);assert.equal(rescued,true);assert.equal(g.s.credits,900);assert.equal(g.usedCargo,0);assert.equal(g.s.hull,g.stats.hull);assert.ok(g.s.fuel>=30);assert.equal(g.docked,true);g.s.credits=0;g.s.fuel=0;g.emergencyTow();assert.equal(g.s.credits,0);assert.ok(g.s.fuel>=25);
});
test('services and upgrades charge exactly and obey maximum levels',()=>{
 const g=atStation();g.s.credits=30000;g.s.hull=100;g.service('repair');assert.equal(g.s.hull,160);assert.equal(g.s.credits,29820);g.s.fuel=50;g.service('fuel');assert.equal(g.s.fuel,100);assert.equal(g.s.credits,29620);for(let i=0;i<4;i++)g.upgrade('shield');assert.equal(g.s.upgrades.shield,3);assert.equal(g.stats.shield,220);const before=g.s.credits;g.upgrade('shield');assert.equal(g.s.credits,before);g.buyShip('freighter');assert.equal(g.s.ship,'freighter');assert.equal(g.stats.cargo,90);assert.equal(g.s.hull,320);assert.equal(g.s.upgrades.shield,3);
});
test('pause freezes physics and jump countdown',()=>{
 const g=new Universe();g.startJump(1);g.paused=true;const before=JSON.stringify(g.s);step(g,10);assert.equal(JSON.stringify(g.s),before);assert.equal(g.jumpTime,3);g.paused=false;step(g,4);assert.equal(g.s.system,1);
});
test('local save roundtrip restores progress and ignores malformed saves',()=>{
 const values=new Map();globalThis.localStorage={setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)??null};const g=atStation();g.trade(0,5,true);assert.equal(g.save(),true);assert.deepEqual(Universe.restore(),g.s);localStorage.setItem(SAVE_KEY,'{broken');assert.equal(Universe.restore(),null);localStorage.setItem(SAVE_KEY,JSON.stringify({...g.s,credits:-20}));assert.equal(Universe.restore(),null);localStorage.setItem(SAVE_KEY,JSON.stringify({...g.s,cargo:[-5,0,0,0,0,0]}));assert.equal(Universe.restore(),null);delete globalThis.localStorage;
});
test('WebMCP action contract uses shared state and refuses invalid input',()=>{
 const g=atStation();let updates=0;const tools=gameTools(g,()=>updates++);assert.deepEqual(tools.map(t=>t.name),['get_flight_status','trade_commodity','start_station_approach']);assert.equal(tools[0].annotations.readOnlyHint,true);assert.equal(tools[1].annotations.readOnlyHint,false);assert.equal(tools[1].execute({commodity:0,tonnes:5,side:'buy'}).ok,true);assert.equal(tools[0].execute({}).cargo[0],5);const before=JSON.stringify(g.s);assert.throws(()=>tools[1].execute({commodity:0,tonnes:-2,side:'delete'}));assert.equal(JSON.stringify(g.s),before);assert.equal(tools[1].execute({commodity:0,tonnes:-2,side:'buy'}).ok,false);assert.ok(updates>0);g.undock();g.s.x=0;g.s.y=-80;assert.equal(tools[2].execute({}).autopilot,true);
});
