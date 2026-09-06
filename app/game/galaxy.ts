import { SYSTEMS,FACTIONS,SHIPS,factionIds,fleetFor,ANTIMATTER_DEPOTS,type FactionId } from './world.ts';
import type { Universe,Contact } from './engine.ts';
export type EventKind='raid'|'convoy'|'blockade'|'siege'|'storm'|'shortage'|'relic';
export type Condition={kind:EventKind;until:number;serial:number;route?:number;faction?:FactionId;resolved?:boolean};
export type War={id:number;attacker:FactionId;defender:FactionId;front:number;pressure:number;ends:number;next:number};
export type GalacticState={seed:number;serial:number;nextEvent:number;nextWar:number;wars:War[];owners:Partial<Record<number,FactionId>>;conditions:Record<number,Condition>;supply:Record<number,number>;news:{id:number;time:number;system:number;text:string}[];rare:Record<number,{stock:number;next:number}>;encounters:Record<number,number>};
export const EVENT_NAMES:Record<EventKind,string>={raid:'Pirate incursion',convoy:'Relief convoy',blockade:'Jump-lane blockade',siege:'Planetary siege',storm:'Ion storm',shortage:'Medical emergency',relic:'Derelict research vessel'};
export function initialGalaxy(time=0,seed=846273):GalacticState{return {seed,serial:0,nextEvent:time+45,nextWar:time+360,wars:[{id:1,attacker:'union',defender:'syndicate',front:11,pressure:20,ends:time+900,next:time+90},{id:2,attacker:'forge',defender:'verdant',front:19,pressure:30,ends:time+1000,next:time+100}],owners:{},conditions:{},supply:{},news:[],rare:Object.fromEntries(ANTIMATTER_DEPOTS.map(id=>[id,{stock:1,next:time+900}])),encounters:{}};}
export function random(g:Universe){const s=g.s.galaxy!;s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export const ownerOf=(g:Universe,id:number)=>g.s.galaxy?.owners[id]??SYSTEMS[id].factionId;
export const atWar=(g:Universe,a:FactionId,b:FactionId)=>a!==b&&!!g.s.galaxy?.wars.some(w=>(w.attacker===a&&w.defender===b)||(w.attacker===b&&w.defender===a));
export function report(g:Universe,text:string,system=g.s.system){const galaxy=g.s.galaxy!;galaxy.news.unshift({id:++galaxy.serial,time:Math.floor(g.s.time),system,text});galaxy.news=galaxy.news.slice(0,12);if(system===g.s.system)g.notify(text);}
export function conditionAt(g:Universe,id=g.s.system){const c=g.s.galaxy?.conditions[id];return c&&!c.resolved&&c.until>g.s.time?c:undefined;}
export function pricesFor(g:Universe,id:number){const event=conditionAt(g,id),supply=g.s.galaxy?.supply[id]??0;return SYSTEMS[id].prices.map((n,i)=>Math.max(8,Math.round(n*Math.max(.65,Math.min(1.65,1-supply*.004))*(event?.kind==='shortage'&&(i===0||i===3)?1.65:event?.kind==='blockade'?1.25:event?.kind==='siege'&&(i===1||i===5)?1.35:1))));}
export function tradeRoutes(id:number){return SYSTEMS.filter(s=>s.id!==id&&Math.hypot(s.x-SYSTEMS[id].x,s.y-SYSTEMS[id].y)<=52.2).map(s=>s.id);}
export function spawnShip(g:Universe,kind:'hostile'|'patrol'|'trader',faction:FactionId,x:number,y:number,role:Contact['role'],tier=1):Contact{
 const ship=fleetFor(faction)[tier],spec=SHIPS[ship];const id='dynamic-'+g.s.system+'-'+(++g.s.galaxy!.serial);
 const c:Contact={id,name:(kind==='hostile'?'Corsair ':kind==='trader'?'MV ':'CSV ')+['Endeavour','Revenant','Argosy','Vanguard','Resolve','Sable','Dawn'][g.s.galaxy!.serial%7],kind,faction:kind==='hostile'?undefined:faction,ship,x,y,vx:0,vy:0,angle:-Math.PI/2,hull:spec.hull,maxHull:spec.hull,shield:spec.shield,fire:1+random(g),radius:27*spec.size,role,dynamic:true,good:g.s.galaxy!.serial%6,quantity:10};
 g.contacts.push(c);return c;
}
export function spawnEvent(g:Universe,kind:EventKind,system=g.s.system,invader?:FactionId){
 const galaxy=g.s.galaxy!,serial=++galaxy.serial;const c:Condition={kind,until:g.s.time+(kind==='blockade'?480:kind==='siege'?360:240),serial};
 if(kind==='blockade')c.route=tradeRoutes(system)[Math.floor(random(g)*tradeRoutes(system).length)];
 if(kind==='siege')c.faction=invader??galaxy.wars.find(w=>w.front===system)?.attacker??factionIds.find(f=>atWar(g,f,ownerOf(g,system)))??factionIds[(factionIds.indexOf(ownerOf(g,system))+2)%6];
 galaxy.conditions[system]=c;report(g,EVENT_NAMES[kind]+(kind==='blockade'?': route to '+SYSTEMS[c.route!].name+' interdicted.':kind==='shortage'?': food and medicine prices rising.':'.'),system);
 if(system===g.s.system)materializeEvent(g,c);return c;
}
export function materializeEvent(g:Universe,c:Condition){
 if(g.contacts.some(ship=>ship.encounter===c.serial)||c.resolved||c.until<=g.s.time)return;
 const before=new Set(g.contacts.map(c=>c.id)),faction=ownerOf(g,g.s.system);
 if(c.kind==='raid'||c.kind==='convoy'){
  const convoy=spawnShip(g,'trader',faction,630,280,'convoy',1);convoy.name='Relief convoy '+SYSTEMS[g.s.system].name;convoy.hull=convoy.maxHull=360;convoy.shield=160;convoy.routeGoal={x:300,y:20};
  spawnShip(g,'patrol',faction,370,430,'escort',1);
  if(c.kind==='raid'){spawnShip(g,'hostile','syndicate',910,360,'raider',0);spawnShip(g,'hostile','syndicate',1050,490,'raider',0);}
 }else if(c.kind==='blockade'){
  const id='blockade-'+g.s.system+'-'+c.serial;g.contacts.push({id,name:'Interdiction station · '+SYSTEMS[c.route!].name,kind:'station',role:'blockade',dynamic:true,x:920,y:-480,vx:0,vy:0,angle:0,hull:1500,maxHull:1500,shield:500,fire:2,radius:100,encounter:c.serial});spawnShip(g,'hostile','syndicate',1030,-280,'raider',1);
 }else if(c.kind==='siege'){
  for(let i=0;i<3;i++)spawnShip(g,'patrol',c.faction!,-960+i*180,640,'invader',i===0?3:2);
 }else if(c.kind==='relic')g.contacts.push({id:'relic-'+c.serial,name:'Lost antimatter research tender',kind:'salvage',role:'relic',dynamic:true,x:850,y:380,vx:0,vy:0,angle:0,hull:1,maxHull:1,shield:0,fire:0,radius:30});
 for(const ship of g.contacts)if(!before.has(ship.id))ship.encounter=c.serial;
}
export function populateDynamic(g:Universe){
 const galaxy=g.s.galaxy!;
 for(const w of g.worlds.filter(w=>w.inhabited)){
  const id='battery-'+w.id;if(g.s.losses?.includes(id))continue;
  g.contacts.push({id,name:w.name+' · defence grid',kind:'station',role:'battery',faction:g.faction,planetId:w.id,x:w.x+w.radius*.65,y:w.y-w.radius*.35,vx:0,vy:0,angle:0,hull:900,maxHull:900,shield:320,fire:4,radius:40});
 }
 let condition=conditionAt(g);
 if(!condition&&(galaxy.encounters[g.s.system]??-1e6)+90<g.s.time){
  galaxy.encounters[g.s.system]=g.s.time;
  const war=galaxy.wars.find(w=>w.front===g.s.system);
  condition=spawnEvent(g,war?'siege':g.s.system===0?'raid':['raid','convoy','blockade','shortage','relic'][Math.floor(random(g)*5)] as EventKind);
  if(war){condition.faction=war.attacker;}
 }else if(condition)materializeEvent(g,condition);
}
export function recordLoss(g:Universe,victim:Contact,source:string){
 const galaxy=g.s.galaxy!;
 if(victim.kind==='trader'){galaxy.supply[g.s.system]=Math.max(-70,(galaxy.supply[g.s.system]??0)-8);if(victim.role==='convoy')report(g,'Relief convoy lost. Local supplies falling.');}
 if(victim.role==='blockade'){const condition=galaxy.conditions[g.s.system];if(condition?.kind==='blockade')condition.resolved=true;report(g,'Interdiction station destroyed. Jump lane reopened.');if(source==='player')g.s.credits+=1200;}
 for(const war of galaxy.wars.filter(w=>w.front===g.s.system)){if(victim.faction===war.defender)war.pressure=Math.min(100,war.pressure+(victim.role==='battery'?12:victim.kind==='station'?30:8));else if(victim.faction===war.attacker)war.pressure=Math.max(-40,war.pressure-12);}
 if(victim.dynamic&&victim.encounter){const event=galaxy.conditions[g.s.system];if(event?.serial===victim.encounter&&event.kind==='raid'&&!g.contacts.some(c=>c.id!==victim.id&&c.encounter===victim.encounter&&c.role==='raider'&&c.hull>0)){event.resolved=true;report(g,'Pirate incursion repelled. Trade traffic can resume.');}if(event?.serial===victim.encounter&&event.kind==='siege'&&!g.contacts.some(c=>c.id!==victim.id&&c.role==='invader'&&c.hull>0)){event.resolved=true;report(g,'Assault fleet defeated. Planetary siege lifted.');}}
}
export function tickGalaxy(g:Universe){
 const galaxy=g.s.galaxy!,time=g.s.time;
 for(const [id,c] of Object.entries(galaxy.conditions))if(!c.resolved&&c.until<=time){c.resolved=true;if(c.kind==='blockade'&&Number(id)===g.s.system){for(const ship of g.contacts)if(ship.encounter===c.serial)ship.departing=true;}report(g,EVENT_NAMES[c.kind]+' ended.',Number(id));}
 if(time>=galaxy.nextEvent){galaxy.nextEvent=time+55+random(g)*40;const system=random(g)<.55?g.s.system:Math.floor(random(g)*SYSTEMS.length);if(!conditionAt(g,system)){const kinds:EventKind[]=['raid','convoy','blockade','siege','storm','shortage','relic'];spawnEvent(g,kinds[Math.floor(random(g)*kinds.length)],system);}}
 for(const war of [...galaxy.wars]){
  if(time>=war.ends){galaxy.wars=galaxy.wars.filter(w=>w.id!==war.id);report(g,FACTIONS[war.attacker].short+' and '+FACTIONS[war.defender].short+' signed a ceasefire.',war.front);continue;}
  if(time>=war.next){war.next=time+75;war.pressure+=10+Math.floor(random(g)*18);if(war.pressure>=100){const captured=war.front;galaxy.owners[captured]=war.attacker;report(g,SYSTEMS[captured].name+' fell to '+FACTIONS[war.attacker].name+'.',captured);if(captured===g.s.system){for(const c of g.contacts)if(c.faction===war.defender&&['station','planet'].includes(c.kind))c.faction=war.attacker;if(g.docked&&g.standing(war.attacker)<0)g.undock();}const next=SYSTEMS.find(s=>ownerOf(g,s.id)===war.defender&&tradeRoutes(captured).includes(s.id));if(next){war.front=next.id;war.pressure=0;spawnEvent(g,'siege',next.id,war.attacker);}else war.ends=time;}}
 }
 if(time>=galaxy.nextWar){galaxy.nextWar=time+480;const attacker=factionIds[Math.floor(random(g)*6)],defender=factionIds[(factionIds.indexOf(attacker)+1+Math.floor(random(g)*5))%6];if(!atWar(g,attacker,defender)&&galaxy.wars.length<4){const target=SYSTEMS.find(s=>ownerOf(g,s.id)===defender);if(!target)return;const front=target.id;galaxy.wars.push({id:++galaxy.serial,attacker,defender,front,pressure:0,ends:time+720,next:time+75});report(g,FACTIONS[attacker].name+' declared war on '+FACTIONS[defender].name+'.',front);}}
 for(const depot of Object.values(galaxy.rare))if(time>=depot.next){depot.stock=Math.min(2,depot.stock+1);depot.next=time+900;}
}
