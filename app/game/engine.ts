import {initialGalaxy,populateDynamic,tickGalaxy,ownerOf,atWar,conditionAt,pricesFor,recordLoss,report,type GalacticState} from './galaxy.ts';
import {tickBattle,beam} from './battle.ts';
import {supportsPointDefense,supportsAntimatter,ANTIMATTER_DEPOTS} from './world.ts';
import { loadCookieSave, saveToCookies } from './cookies.ts';
import { SYSTEMS, GOODS, SHIPS, FACTIONS, WEAPONS, factionIds, fleetFor, planetsFor, type ShipClass, type FactionId, type WeaponId } from './world.ts';
export { supportsPointDefense,supportsAntimatter,ANTIMATTER_DEPOTS,conditionAt,atWar,ownerOf,pricesFor, SYSTEMS, GOODS, SHIPS, FACTIONS, WEAPONS, factionIds, fleetFor, planetsFor };
export type { ShipClass, FactionId, WeaponId };
export type Contact = {id:string,name:string,kind:'station'|'hostile'|'trader'|'patrol'|'salvage'|'planet',x:number,y:number,vx:number,vy:number,angle:number,hull:number,maxHull:number,shield:number,fire:number,faction?:FactionId,ship?:ShipClass,planetId?:string,radius?:number,provoked?:boolean,distressed?:boolean,scanned?:boolean,good?:number,quantity?:number;role?:'convoy'|'escort'|'raider'|'invader'|'blockade'|'battery'|'relic';dynamic?:boolean;encounter?:number;departing?:boolean;routeGoal?:{x:number;y:number};energy?:number;beamId?:number;pdCooldown?:number};
export type Bullet = {id:number,x:number,y:number,vx:number,vy:number,life:number,enemy:boolean,damage:number,kind?:WeaponId,target?:string,age?:number,source?:string,trail?:{x:number;y:number}[];integrity?:number;side?:FactionId|'pirate'|'player';detonated?:boolean};
export type Beam={id:number;x:number;y:number;tx:number;ty:number;life:number;maxLife:number;color:string;enemy:boolean;continuous?:boolean};
export type BattleEffect={id:number;x:number;y:number;radius:number;life:number;maxLife:number;color:string;kind:'explosion'|'singularity'|'intercept'};
export type Particle = {x:number,y:number,vx:number,vy:number,life:number,maxLife:number,color:string};
export type Contract = {id:string,title:string,type:'delivery'|'bounty'|'explore',target:number,reward:number,good?:number,quantity:number,progress:number,done:boolean,origin:number};
export type GameState = {
 version:1; system:number; x:number;y:number;vx:number;vy:number;angle:number; hull:number;shield:number;energy:number;fuel:number;credits:number;
 ship:ShipClass; upgrades:{weapon:number;shield:number;engine:number;cargo:number}; cargo:number[];stocks:Record<number,number[]>;
 kills:number;profit:number;visited:number[];contracts:Contract[];completed:string[];reputation:number;time:number;docked?:boolean;preferences?:{muted:boolean;zoom:number};
 factionRep?:Partial<Record<FactionId,number>>;incidents?:Record<number,{until:number;fine:number}>;surveyed?:string[];harvested?:Record<string,number>;losses?:string[];provoked?:string[];weapon?:WeaponId;trafficStock?:Record<string,number>;galaxy?:GalacticState;equipment?:{pointDefense:number;antimatter:boolean;ammo:number};
};
export const STATION = {x:300,y:20};
export const SAVE_KEY = 'voidwake-save-v1';
export const distance = (a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export const systemDistance = (a:number,b:number)=>distance(SYSTEMS[a],SYSTEMS[b])/9;
export const fuelCost = (a:number,b:number)=>Math.ceil(systemDistance(a,b)*4);
export function initialState():GameState { return {version:1,system:0,x:0,y:-80,vx:0,vy:0,angle:0.5,hull:160,shield:100,energy:100,fuel:80,credits:2400,ship:'courier',upgrades:{weapon:0,shield:0,engine:0,cargo:0},cargo:[0,0,0,0,0,0],stocks:{},kills:0,profit:0,visited:[0],contracts:[],completed:[],reputation:0,time:0,factionRep:Object.fromEntries(factionIds.map(id=>[id,25])),incidents:{},surveyed:[],harvested:{},losses:[],provoked:[],weapon:'phaser',trafficStock:{},galaxy:initialGalaxy(0,Math.floor(Math.random()*4294967296)),equipment:{pointDefense:0,antimatter:false,ammo:0}}; }
export class Universe {
 s:GameState=initialState(); contacts:Contact[]=[];bullets:Bullet[]=[];particles:Particle[]=[];beams:Beam[]=[];
 keys=new Set<string>(); target:string='station'; waypoint:{x:number;y:number}|null=null;
 paused=false;docked=false;autoDock=false;jump:number|null=null;jumpTime=0;cooldown=0;sinceHit=10;shotId=0;
 dynamic=true;effects:BattleEffect[]=[];shake=0;pdCooldown=0;interceptions=0;phaserLocked=false;beamTrigger=0;beamSound=false;interaction:string|null=null;zoom=1;message='';messageTime=0;toastKind='info';
 onChange:()=>void=()=>{}; onDock:()=>void=()=>{};onRescue:()=>void=()=>{};onSound:(type:string)=>void=()=>{};
 onRestore:()=>void=()=>{};
 constructor(state?:GameState,options:{dynamic?:boolean}={}) {this.dynamic=options.dynamic??true;if(state){this.s=state;this.docked=!!state.docked;}this.populate();}
 get stats(){const b=SHIPS[this.s.ship];return {...b,hull:b.hull,shield:b.shield+this.s.upgrades.shield*40,cargo:b.cargo+this.s.upgrades.cargo*15,speed:b.speed+this.s.upgrades.engine*25,damage:b.damage+this.s.upgrades.weapon*8};}
 get usedCargo(){return this.s.cargo.reduce((a,b)=>a+b,0);}
 reservedCargo(good:number){return this.s.contracts.filter(c=>!c.done&&c.type==='delivery'&&c.good===good).reduce((n,c)=>n+c.quantity,0);}
 availableCargo(good:number){return Math.max(0,this.s.cargo[good]-this.reservedCargo(good));}
 get selected(){return this.contacts.find(c=>c.id===this.target);}
 get nearby(){return distance(this.s,STATION)<185;}
 get stock(){return this.s.stocks[this.s.system]??(this.s.stocks[this.s.system]=[80,60,45,70,30,55]);}
 get price(){return pricesFor(this,this.s.system);}
 pricesFor(id:number){return pricesFor(this,id);}
 owner(id:number){return ownerOf(this,id);}
 get condition(){return conditionAt(this);}
 get blockedRoute(){return this.condition?.kind==='blockade'?this.condition.route:undefined;}
 notify(message:string,kind='info'){this.message=message;this.messageTime=3.5;this.toastKind=kind;this.onChange();}
 normalize(){const s=this.s;s.factionRep??=Object.fromEntries(factionIds.map(id=>[id,Math.min(70,25+s.reputation)]));s.incidents??={};s.surveyed??=[];s.harvested??={};s.losses??=[];s.provoked??=[];s.weapon??='phaser';s.trafficStock??={};s.galaxy??=initialGalaxy(s.time);s.equipment??={pointDefense:0,antimatter:false,ammo:0};}
 get faction(){return ownerOf(this,this.s.system);}
 standing(id:FactionId=this.faction){return this.s.factionRep?.[id]??Math.min(70,25+this.s.reputation);}
 relation(id:FactionId=this.faction){return this.standing(id)<0?'Hostile':this.standing(id)>=50?'Allied':'Neutral';}
 get alert(){return (this.s.incidents?.[this.s.system]?.until??0)>this.s.time;}
 get dockingAllowed(){return !this.alert&&this.standing()>=0&&!this.s.losses?.includes('port-'+this.s.system);}
 contactKey(c:Contact){return c.id==='station'?'port-'+this.s.system:c.id;}
 get weapon(){return WEAPONS[this.s.weapon??'phaser'];}
 setWeapon(id:WeaponId){if(!WEAPONS[id])return;this.s.weapon=id;this.onChange();}
 isHostile(c:Contact){return c.kind==='hostile'||c.role==='blockade'||((c.kind==='patrol'||c.kind==='station')&&(!!c.provoked||this.standing(c.faction??this.faction)<0||(c.faction===this.faction&&this.alert)));}
 attackable(c:Contact){return c.hull>0&&!['planet','salvage'].includes(c.kind);}
 get worlds(){return planetsFor(this.s.system);}
 get interactionContact(){return this.contacts.find(c=>c.id===this.interaction);}
 shipAvailable(id:ShipClass){const spec=SHIPS[id];return !!spec&&this.dockingAllowed&&(spec.price===0||id==='freighter'||(spec.faction===this.faction&&(spec.tier<2||this.standing()>=50)));}
 reputationChange(id:FactionId,amount:number){this.normalize();const before=this.standing(id);this.s.factionRep![id]=Math.max(-100,Math.min(100,before+amount));if(before>=0&&this.standing(id)<0)this.notify(FACTIONS[id].name+' declared you hostile. All their ports are closed.','error');}
 populate(){
  this.normalize();const sys=SYSTEMS[this.s.system],fleet=fleetFor(this.faction);this.interaction=null;
  this.contacts=[{id:'station',name:sys.station,kind:'station',faction:this.faction,...STATION,vx:0,vy:0,angle:0,hull:5000,maxHull:5000,shield:2000,fire:2,radius:90}];
  for(const world of this.worlds)this.contacts.push({id:world.id,planetId:world.id,name:world.name,kind:'planet',faction:this.faction,x:world.x,y:world.y,radius:world.radius,vx:0,vy:0,angle:0,hull:1,maxHull:1,shield:0,fire:0});
  for(let i=0;i<8;i++){
   const patrol=i===1||i===5||i===7;const ship=fleet[patrol?(i===7?2:1):i%3];const spec=SHIPS[ship];
   const id='traffic-'+this.s.system+'-'+i;
   this.contacts.push({id,name:(patrol?'CSV ':['MV ','SS ','TS '][i%3])+['Wayfarer','Resolute','Far Horizon','Solstice','Orison','Vigilant','Pilgrim','Aegis'][i],kind:patrol?'patrol':'trader',ship,faction:this.faction,x:STATION.x+Math.cos(this.s.time*.035+i*2.2)*(400+i*125),y:STATION.y+Math.sin(this.s.time*.035+i*2.2)*(330+i*100),vx:0,vy:0,angle:i*1.7,hull:spec.hull,maxHull:spec.hull,shield:spec.shield,fire:2+i,radius:27*spec.size,provoked:this.s.provoked!.includes(id),good:(i+this.s.system)%6,quantity:this.s.trafficStock![id]??10});
  }
  for(let i=0;i<sys.risk+1;i++)this.contacts.push({id:'pirate-'+this.s.system+'-'+i,name:['Outlaw Marauder','Corsair Raider','Rogue Talon','Dust Reaver','Void Fang'][i],kind:'hostile',ship:i%2?'talon':'razor',x:1450+250*Math.cos(i*2),y:-650+i*300,vx:0,vy:0,angle:-1,hull:70+sys.risk*12,maxHull:70+sys.risk*12,shield:0,fire:2+i,radius:26});
  this.contacts=this.contacts.filter(c=>!this.s.losses!.includes(this.contactKey(c)));
  if(this.alert||this.standing()<0)this.reinforcements();
  this.ensureBountyTargets();this.bullets=[];this.beams=[];this.particles=[];this.target='station';
  if(this.dynamic)populateDynamic(this);this.effects=[];this.shake=0;this.beamTrigger=0;this.phaserLocked=false;if(this.beamSound){this.beamSound=false;this.onSound('phaser-stop');}
  if(this.docked&&!this.dockingAllowed)this.docked=false;
 }
 ensureBountyTargets(){
  const contract=this.s.contracts.find(c=>c.type==='bounty'&&!c.done&&c.target===this.s.system);if(!contract)return;
  const missing=contract.quantity-contract.progress-this.contacts.filter(c=>c.kind==='hostile'&&c.hull>0).length;
  for(let i=0;i<missing;i++){let wave=0;let id='bounty-wave-'+this.s.system+'-'+wave;while(this.contacts.some(c=>c.id===id)||this.s.losses!.includes(id))id='bounty-wave-'+this.s.system+'-'+(++wave);this.contacts.push({id,name:'Wanted Corsair',kind:'hostile',ship:'razor',x:1450+i*150,y:-300+i*300,vx:0,vy:0,angle:-1,hull:95,maxHull:95,shield:0,fire:3,radius:26});}
 }
 reinforcements(){
  for(let i=0;i<2;i++){const id='security-'+this.s.system+'-'+i;if(this.contacts.some(c=>c.id===id)||this.s.losses?.includes(id))continue;const ship=fleetFor(this.faction)[i+1],spec=SHIPS[ship];this.contacts.push({id,name:FACTIONS[this.faction].short+' response '+(i+1),kind:'patrol',ship,faction:this.faction,x:STATION.x+480+i*240,y:STATION.y+380,vx:0,vy:0,angle:0,hull:spec.hull,maxHull:spec.hull,shield:spec.shield,fire:3+i,radius:27*spec.size,provoked:false});}
 }
 crime(c:Contact,destroyed=false){
  if(c.kind==='hostile'||c.kind==='planet'||c.kind==='salvage'||c.role==='blockade'||(c.role==='invader'&&c.faction!==this.faction))return;
  if(c.provoked&&!destroyed)return;
  c.provoked=true;c.distressed=c.kind==='trader';if(!this.s.provoked!.includes(this.contactKey(c)))this.s.provoked!.push(this.contactKey(c));
  const penalty=destroyed?(c.kind==='trader'?30:22):12;
  const local=this.s.incidents![this.s.system]??{until:0,fine:0};local.until=this.s.time+(destroyed?300:180);local.fine+=destroyed?2400:600;this.s.incidents![this.s.system]=local;
  this.notify(destroyed?'Civilian or security vessel destroyed. Faction standing −'+penalty+'.':c.name+': distress call received. Security responding.','error');
  this.reputationChange(c.faction??this.faction,-penalty);this.reinforcements();this.save();
 }
 hail(id=this.target){const c=this.contacts.find(c=>c.id===id);if(!c||c.kind==='salvage')return false;this.target=id;this.interaction=id;this.onChange();return true;}
 scanPlanet(id:string){const w=this.worlds.find(w=>w.id===id);if(!w)return false;if(distance(this.s,w)>w.radius+500){this.notify('Move within 500 m of the atmosphere to survey.','error');return false;}if(this.s.surveyed!.includes(id))return false;this.s.surveyed!.push(id);this.s.credits+=350;this.reputationChange(this.faction,2);this.save();this.notify('Survey complete. +350 cr · faction standing +2.');return true;}
 planetAction(id:string,action:'aid'|'mine'|'fuel'){
  const w=this.worlds.find(w=>w.id===id);if(!w||distance(this.s,w)>w.radius+350){this.notify('Move within 350 m of the atmosphere.','error');return false;}
  if((this.s.harvested![id]??-1e6)+120>this.s.time){this.notify('Shuttle is recharging.','error');return false;}
  if(action==='aid'){if(!w.inhabited||this.availableCargo(3)<3){this.notify('Three tonnes of unreserved medical supplies required.','error');return false;}this.s.cargo[3]-=3;this.reputationChange(this.faction,8);this.notify('Medical shuttle received. Faction standing +8.');}
  else if(action==='fuel'){if(w.type!=='gas'||this.s.fuel>=100)return false;this.s.fuel=Math.min(100,this.s.fuel+20);this.notify('Fuel skim complete. +20 jump fuel.');}
  else{if(w.inhabited||this.usedCargo+3>this.stats.cargo)return false;this.s.cargo[w.good]+=3;this.notify('Surface extraction complete. +3 t '+GOODS[w.good].name.toLowerCase()+'.');}
  this.s.harvested![id]=this.s.time;this.save();return true;
 }
 payFine(){const c=this.s.incidents?.[this.s.system];if(!c||!c.fine||this.s.credits<c.fine)return false;this.s.credits-=c.fine;c.fine=0;c.until=0;for(const ship of this.contacts){ship.provoked=false;ship.distressed=false;}this.s.provoked=this.s.provoked!.filter(id=>!this.contacts.some(c=>this.contactKey(c)===id));this.save();this.notify(this.standing()<0?'Fine paid. Faction hostility remains.':'Fine paid. Local alert cleared.');return true;}
 civilianTrade(id:string,good:number,quantity:number,buy:boolean){
  const c=this.contacts.find(c=>c.id===id);if(!c||c.kind!=='trader'||c.provoked||this.alert||this.standing(c.faction??this.faction)<0||distance(c,this.s)>300||!Number.isInteger(quantity)||quantity<1||!Number.isInteger(good)||!GOODS[good])return false;
  const price=Math.floor(this.price[good]*(buy?1.08:.78));
  if(typeof buy!=='boolean')return false;
  if(buy){if(good!==c.good||quantity>(c.quantity??0)||this.usedCargo+quantity>this.stats.cargo||this.s.credits<quantity*price)return false;c.quantity!-=quantity;if(!c.dynamic)this.s.trafficStock![c.id]=c.quantity!;}else if(this.availableCargo(good)<quantity)return false;
  this.s.cargo[good]+=buy?quantity:-quantity;this.s.credits+=price*quantity*(buy?-1:1);this.save();this.notify('Cargo transfer complete.');return true;
 }
 saveStatus:'pending'|'saved'|'blocked'='pending';
 save(){this.s.losses=this.s.losses?.filter(id=>!id.startsWith('dynamic-')).slice(-1000);this.s.provoked=this.s.provoked?.filter(id=>!id.startsWith('dynamic-')).slice(-1000);this.s.docked=this.docked;const ok=saveToCookies(this.s);this.saveStatus=ok?'saved':'blocked';return ok;}
 static validate(raw:unknown):GameState|null {
  try {
   if(!raw||typeof raw!=='object')return null;
   const s=raw as GameState;
   if(s.version!==1||!Number.isInteger(s.system)||!SYSTEMS[s.system]||!Object.prototype.hasOwnProperty.call(SHIPS,s.ship))return null;
   const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
   for(const key of ['x','y','vx','vy','angle','credits','hull','shield','fuel','energy','time','kills','profit','reputation'] as const)if(!finite(s[key]))return null;
   if(s.credits<0||s.fuel<0||s.fuel>100||s.energy<0||s.energy>100||s.shield<0||s.time<0)return null;
   if(!s.upgrades||['weapon','shield','engine','cargo'].some(key=>!Number.isInteger(s.upgrades[key as keyof typeof s.upgrades])||s.upgrades[key as keyof typeof s.upgrades]<0||s.upgrades[key as keyof typeof s.upgrades]>3))return null;
   if(!Array.isArray(s.cargo)||s.cargo.length!==6||s.cargo.some(n=>!Number.isInteger(n)||n<0))return null;
   if(s.cargo.reduce((a,b)=>a+b,0)>SHIPS[s.ship].cargo+s.upgrades.cargo*15)return null;
   if(!s.stocks||typeof s.stocks!=='object'||Object.entries(s.stocks).some(([id,v])=>!SYSTEMS[Number(id)]||!Array.isArray(v)||v.length!==6||v.some(n=>!Number.isInteger(n)||n<0)))return null;
   if(!Array.isArray(s.visited)||s.visited.some(id=>!Number.isInteger(id)||!SYSTEMS[id])||!Array.isArray(s.completed)||s.completed.some(id=>typeof id!=='string'))return null;
   if(!Array.isArray(s.contracts)||s.contracts.length>SYSTEMS.length*3||s.contracts.some(c=>!c||typeof c.id!=='string'||typeof c.title!=='string'||c.title.length>150||!['delivery','bounty','explore'].includes(c.type)||!Number.isInteger(c.target)||!SYSTEMS[c.target]||!Number.isInteger(c.origin)||!SYSTEMS[c.origin]||!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>90||!finite(c.reward)||c.reward<0||!finite(c.progress)||c.progress<0||typeof c.done!=='boolean'||(c.type==='delivery'&&(!Number.isInteger(c.good)||!GOODS[c.good!]))))return null;
   if(s.preferences&&(typeof s.preferences.muted!=='boolean'||!finite(s.preferences.zoom)||s.preferences.zoom<.5||s.preferences.zoom>1.8))return null;
   if(s.weapon&&!Object.prototype.hasOwnProperty.call(WEAPONS,s.weapon))return null;
   if(s.factionRep&&Object.entries(s.factionRep).some(([k,v])=>!factionIds.includes(k as FactionId)||!finite(v)||v!< -100||v!>100))return null;
   if(s.incidents&&Object.entries(s.incidents).some(([k,v])=>!SYSTEMS[Number(k)]||!v||!finite(v.until)||!finite(v.fine)||v.fine<0))return null;
   for(const a of [s.surveyed,s.losses,s.provoked])if(a&&(!Array.isArray(a)||a.length>1000||a.some(v=>typeof v!=='string'||v.length>80)))return null;
   if(s.harvested&&Object.entries(s.harvested).some(([k,v])=>k.length>80||!finite(v)||v<0))return null;
   if(s.trafficStock&&Object.entries(s.trafficStock).some(([k,v])=>k.length>80||!Number.isInteger(v)||v<0||v>10))return null;
   if(s.equipment&&(!Number.isInteger(s.equipment.pointDefense)||s.equipment.pointDefense<0||s.equipment.pointDefense>2||typeof s.equipment.antimatter!=='boolean'||!Number.isInteger(s.equipment.ammo)||s.equipment.ammo<0||s.equipment.ammo>3))return null;
   if(s.galaxy){const g=s.galaxy;if(!Number.isInteger(g.seed)||g.seed<0||!Number.isInteger(g.serial)||g.serial<0||!finite(g.nextEvent)||!finite(g.nextWar)||!Array.isArray(g.wars)||g.wars.length>4||g.wars.some(w=>!Number.isInteger(w.id)||!factionIds.includes(w.attacker)||!factionIds.includes(w.defender)||!SYSTEMS[w.front]||!finite(w.pressure)||!finite(w.ends)||!finite(w.next)))return null;
    if(!g.owners||Object.entries(g.owners).some(([k,v])=>!SYSTEMS[Number(k)]||!factionIds.includes(v!)))return null;
    if(!g.conditions||Object.entries(g.conditions).some(([k,v])=>!SYSTEMS[Number(k)]||!v||!['raid','convoy','blockade','siege','storm','shortage','relic'].includes(v.kind)||!finite(v.until)||!finite(v.serial)||(v.route!==undefined&&!SYSTEMS[v.route])||(v.kind==='blockade'&&v.route===undefined)||(v.kind==='siege'&&(!v.faction||!factionIds.includes(v.faction)))||(v.faction!==undefined&&!factionIds.includes(v.faction))))return null;
    for(const map of [g.supply,g.encounters])if(!map||Object.entries(map).some(([k,v])=>!SYSTEMS[Number(k)]||!finite(v)))return null;
    if(!Array.isArray(g.news)||g.news.length>12||g.news.some(n=>!finite(n.id)||!finite(n.time)||!SYSTEMS[n.system]||typeof n.text!=='string'||n.text.length>240))return null;
    if(!g.rare||Object.entries(g.rare).some(([k,v])=>!ANTIMATTER_DEPOTS.includes(Number(k))||!Number.isInteger(v.stock)||v.stock<0||v.stock>2||!finite(v.next)))return null;
   }
   return s;
  }catch{return null;}
 }
 static restore(){
  const cookieState=Universe.validate(loadCookieSave());
  if(cookieState)return cookieState;
  // One-time migration: never write saves to localStorage, and only remove the old copy after verified cookie storage.
  try{if(typeof localStorage==='undefined')return null;const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const legacy=Universe.validate(JSON.parse(raw));if(!legacy)return null;if(saveToCookies(legacy))localStorage.removeItem(SAVE_KEY);return legacy;}catch{return null;}
 }
 dock(){if(!this.dockingAllowed){this.autoDock=false;this.notify(this.standing()<0?'Docking denied: faction hostility.':'Docking denied: active security alert.','error');return false;}if(this.jump!==null)return false;if(!this.nearby){this.waypoint={...STATION};this.autoDock=true;this.notify('Docking approach set.');return false;}this.docked=true;this.autoDock=false;this.waypoint=null;this.s.vx=this.s.vy=0;this.save();this.onDock();this.onSound('dock');this.notify(`Docked at ${SYSTEMS[this.s.system].station}.`);return true;}
 undock(){this.docked=false;this.s.x=STATION.x-160;this.s.y=STATION.y-65;this.s.vx=this.s.vy=0;this.notify('Undocked.');}
 trade(good:number,quantity:number,buy:boolean){if(!this.docked||!this.dockingAllowed)return {ok:false,message:'Dock at a friendly station to trade.'};if(!Number.isInteger(good)||!GOODS[good]||!Number.isInteger(quantity)||quantity<1||typeof buy!=='boolean')return {ok:false,message:'Choose a valid item and quantity.'};const price=buy?this.price[good]:Math.floor(this.price[good]*0.85);if(buy&&(this.s.credits<price*quantity||this.usedCargo+quantity>this.stats.cargo||this.stock[good]<quantity))return {ok:false,message:'Not enough credits, cargo space, or market stock.'};if(!buy&&this.availableCargo(good)<quantity)return {ok:false,message:'Not enough unreserved cargo to sell.'};this.s.credits+=(buy?-1:1)*price*quantity;this.s.cargo[good]+=(buy?1:-1)*quantity;this.stock[good]+=(buy?-1:1)*quantity;if(!buy)this.s.profit+=price*quantity;this.onSound('trade');this.save();this.notify(`${buy?'Purchased':'Sold'} ${quantity} t of ${GOODS[good].name.toLowerCase()} for ${price*quantity} cr.`);return {ok:true,message:this.message};}
 service(type:'repair'|'fuel'){if(!this.docked||!this.dockingAllowed)return;const missing=type==='repair'?Math.ceil(this.stats.hull-this.s.hull):Math.ceil(100-this.s.fuel);const cost=missing*(type==='repair'?3:4);if(this.s.credits<cost){this.notify('Not enough credits for this service.','error');return;}this.s.credits-=cost;if(type==='repair'){this.s.hull=this.stats.hull;this.s.shield=this.stats.shield;}else this.s.fuel=100;this.save();this.notify(type==='repair'?'Hull repaired. Shields restored.':'Jump fuel replenished.');}
 upgrade(type:keyof GameState['upgrades']){if(!this.docked||!this.dockingAllowed)return;const level=this.s.upgrades[type];const cost=(level+1)*[900,750,650,600][['weapon','shield','engine','cargo'].indexOf(type)];if(level>=3||this.s.credits<cost)return;this.s.credits-=cost;this.s.upgrades[type]++;this.save();this.notify('Upgrade installed.');this.onSound('trade');}
 buyShip(ship:ShipClass){const next=SHIPS[ship];if(!this.docked||!this.shipAvailable(ship)||ship===this.s.ship||this.s.credits<next.price||this.usedCargo>next.cargo+this.s.upgrades.cargo*15)return;this.s.credits-=next.price;this.s.ship=ship;this.s.hull=this.stats.hull;this.s.shield=this.stats.shield;this.save();this.notify(`${next.name} is ready in your berth. Upgrades transferred.`);}
 startJump(id:number){if(!Number.isInteger(id)||!SYSTEMS[id]||id===this.s.system)return false;if(this.blockedRoute===id){this.notify('Jump lane interdicted. Destroy the blockade station or choose another route.','error');return false;}if(systemDistance(this.s.system,id)>5.8){this.notify('Destination exceeds jump range. Plot an intermediate stop.','error');return false;}if(this.s.fuel<fuelCost(this.s.system,id)){this.notify('Insufficient fuel.','error');return false;}if(this.docked||this.jump!==null){this.notify('Undock before engaging the jump drive.','error');return false;}this.jump=id;this.jumpTime=3;this.waypoint=null;this.autoDock=false;this.onSound('jump');this.notify(`Jump drive charging. Destination: ${SYSTEMS[id].name}.`);return true;}
 get offers():Contract[]{const origin=this.s.system;const target=(origin+1)%SYSTEMS.length;return [{id:`delivery-${origin}`,title:`Supplies for ${SYSTEMS[target].name}`,type:'delivery',origin,target,reward:1100+SYSTEMS[target].risk*250,good:0,quantity:8,progress:0,done:false},{id:`bounty-${origin}`,title:'Clear the trade lanes',type:'bounty',origin,target:origin,reward:1700+SYSTEMS[origin].risk*200,quantity:2,progress:0,done:false},{id:`explore-${origin}`,title:`Chart a route to ${SYSTEMS[(origin+2)%SYSTEMS.length].name}`,type:'explore',origin,target:(origin+2)%SYSTEMS.length,reward:750,quantity:1,progress:0,done:false}].filter(c=>!this.s.completed.includes(c.id)&&!this.s.contracts.some(a=>a.id===c.id)) as Contract[];}
 accept(id:string){const c=this.offers.find(o=>o.id===id);if(!this.docked||!c||this.s.contracts.filter(a=>!a.done).length>=3)return;if(c.type==='delivery'){if(this.usedCargo+c.quantity>this.stats.cargo){this.notify('Free up 8 t of cargo space to load the shipment.','error');return;}this.s.cargo[c.good!]+=c.quantity;}this.s.contracts.push({...c});this.ensureBountyTargets();this.save();this.notify(`Contract accepted: ${c.title}.`);}
 complete(id:string){const c=this.s.contracts.find(c=>c.id===id);if(!c||c.done||!this.docked)return;if(c.type==='delivery'){if(this.s.system!==c.target||this.s.cargo[c.good!]<c.quantity)return;this.s.cargo[c.good!]-=c.quantity;}else if(c.type==='bounty'?(c.progress<c.quantity||this.s.system!==c.origin):(this.s.system!==c.target))return;c.done=true;this.s.credits+=c.reward;this.s.reputation+=5;this.reputationChange(SYSTEMS[c.origin].factionId,5);this.s.completed.push(c.id);this.save();this.notify(`Contract complete. +${c.reward} cr. Reputation increased.`);this.onSound('trade');}
 cancelContract(id:string){const i=this.s.contracts.findIndex(c=>c.id===id&&!c.done);if(i<0)return;const c=this.s.contracts[i];if(c.type==='delivery'){const qty=Math.min(this.s.cargo[c.good!],c.quantity);this.s.cargo[c.good!]-=qty;this.s.credits=Math.max(0,this.s.credits-(c.quantity-qty)*42);}this.s.contracts.splice(i,1);this.save();this.notify('Contract abandoned. Undelivered cargo reclaimed.');}
 cycle(){const all=this.contacts.filter(c=>this.isHostile(c));if(!all.length)return;const i=all.findIndex(c=>c.id===this.target);this.target=all[(i+1)%all.length].id;this.onChange();}
 emergencyTow(){if(!this.dockingAllowed){const paused=this.paused;this.paused=false;this.s.hull=-1;this.update(.001);this.paused=paused;return;}this.s.credits=Math.max(0,this.s.credits-250);this.s.x=STATION.x-120;this.s.y=STATION.y;this.s.vx=this.s.vy=0;this.s.fuel=Math.max(this.s.fuel,25);this.s.hull=Math.max(this.s.hull,40);this.waypoint=null;this.dock();this.notify('Recovery tug dispatched. Up to 250 cr charged; reserve fuel supplied.');}
 burst(x:number,y:number,color:string,count=15){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2;const life=.3+Math.random()*.9;this.particles.push({x,y,vx:Math.cos(a)*(30+Math.random()*100),vy:Math.sin(a)*(30+Math.random()*100),life,maxLife:life,color});}}
 damageContact(c:Contact,damage:number,weapon:WeaponId='phaser',source='player'){
  if(!this.attackable(c))return;if(source==='player')this.crime(c);
  const shieldFactor=weapon==='torpedo'?1.7:weapon==='laser'?.75:1;
  const absorbed=Math.min(c.shield,damage*shieldFactor);c.shield-=absorbed;c.hull-=Math.max(0,damage-absorbed/shieldFactor);
  if(weapon!=='phaser'||Math.random()<.2)this.burst(c.x,c.y,absorbed?'#82d9ff':'#ffaf73',4);
  if(c.hull>0)return;
  this.burst(c.x,c.y,'#ffb36e',45);if(source==='player')this.s.kills++;recordLoss(this,c,source);
  if(!c.dynamic&&!this.s.losses!.includes(this.contactKey(c)))this.s.losses!.push(this.contactKey(c));
  if(source==='player'&&c.kind==='hostile'){const bounty=180+SYSTEMS[this.s.system].risk*60;this.s.credits+=bounty;this.s.reputation++;this.reputationChange(this.faction,2);for(const contract of this.s.contracts)if(!contract.done&&contract.type==='bounty'&&contract.target===this.s.system)contract.progress++;this.notify('Pirate destroyed. +'+bounty+' cr.');}else if(source==='player')this.crime(c,true);
  this.contacts.push({id:'salvage-'+this.shotId++,name:'Recoverable cargo',kind:'salvage',x:c.x,y:c.y,vx:0,vy:0,angle:0,hull:1,maxHull:1,shield:0,fire:0});this.onSound('explode');this.save();
 }
 damagePlayer(damage:number){if(this.docked)return;const absorbed=Math.min(this.s.shield,damage);this.s.shield-=absorbed;this.s.hull-=damage-absorbed;this.sinceHit=0;this.burst(this.s.x,this.s.y,absorbed?'#64d9ff':'#ffb56a',6);this.onSound('hit');}
 fire(dt=.05){
  const w=this.weapon,id=this.s.weapon??'phaser';
  if(id==='phaser')return this.firePhaser(dt);
  if(id==='antimatter'&&(!this.s.equipment!.antimatter||this.s.equipment!.ammo<1||!supportsAntimatter(this.s.ship))){this.notify('Antimatter launcher, compatible cruiser, and warhead required.','error');return false;}
  if(this.cooldown>0||this.s.energy<w.energy||this.docked||this.jump!==null||this.paused)return false;
  const selected=this.selected;let target=selected&&this.attackable(selected)&&distance(this.s,selected)<=w.range?selected:undefined;
  let a=this.s.angle;if(target)a=Math.atan2(target.y-this.s.y,target.x-this.s.x)-Math.PI/2;
  const x=this.s.x-Math.sin(a)*32,y=this.s.y+Math.cos(a)*32;
  if(id==='laser'){
   if(!target){let closest:number=w.range;for(const c of this.contacts){if(!this.attackable(c))continue;const dx=c.x-x,dy=c.y-y,along=dx*-Math.sin(a)+dy*Math.cos(a),perp=Math.abs(dx*Math.cos(a)+dy*Math.sin(a));if(along>0&&along<closest&&perp<(c.radius??27)){closest=along;target=c;}}}
   const life=.32;this.beams.push({id:this.shotId++,x,y,tx:target?.x??x-Math.sin(a)*w.range,ty:target?.y??y+Math.cos(a)*w.range,life,maxLife:life,color:w.color,enemy:false});
   if(target)this.damageContact(target,this.stats.damage*w.multiplier,id);
  }else{
   if(id==='missile')a+=(this.shotId%2?1:-1)*.8;
   const speed=id==='missile'?230:id==='antimatter'?330:430;
   this.bullets.push({id:this.shotId++,x,y,vx:-Math.sin(a)*speed,vy:Math.cos(a)*speed,enemy:false,life:id==='missile'?7:id==='antimatter'?6:3.8,damage:this.stats.damage*w.multiplier,kind:id,target:target?.id,age:0,trail:[],source:'player',side:'player',integrity:3});
  }
  if(id==='antimatter'){this.s.equipment!.ammo--;this.save();}this.s.energy-=w.energy;this.cooldown=w.cooldown;this.onSound(id);return true;
 }
 firePhaser(dt:number){
  if(this.docked||this.jump!==null||this.paused||this.phaserLocked)return false;const w=WEAPONS.phaser;
  if(this.s.energy<w.energy*dt){this.phaserLocked=true;return false;}
  const selected=this.selected;let target=selected&&this.attackable(selected)&&distance(this.s,selected)<=w.range?selected:undefined;let a=this.s.angle;
  if(target)a=Math.atan2(target.y-this.s.y,target.x-this.s.x)-Math.PI/2;
  const x=this.s.x-Math.sin(a)*34,y=this.s.y+Math.cos(a)*34;
  if(!target){let closest:number=w.range;for(const c of this.contacts){if(!this.attackable(c))continue;const dx=c.x-x,dy=c.y-y,along=dx*-Math.sin(a)+dy*Math.cos(a),perp=Math.abs(dx*Math.cos(a)+dy*Math.sin(a));if(along>0&&along<closest&&perp<(c.radius??27)){closest=along;target=c;}}}
  beam(this,-1,{x,y},{x:target?.x??x-Math.sin(a)*w.range,y:target?.y??y+Math.cos(a)*w.range},w.color,false,true);
  this.s.energy-=w.energy*dt;if(target)this.damageContact(target,this.stats.damage*w.multiplier*dt,'phaser');
  if(!this.beamSound){this.beamSound=true;this.onSound('phaser-start');}return true;
 }
 installEquipment(type:'pointDefense'|'antimatter'){
  if(!this.docked||!this.dockingAllowed)return false;const equipment=this.s.equipment!;
  if(type==='pointDefense'){const cost=(equipment.pointDefense+1)*4500;if(!supportsPointDefense(this.s.ship)||equipment.pointDefense>=2||this.s.credits<cost)return false;equipment.pointDefense++;this.s.credits-=cost;}
  else{if(!ANTIMATTER_DEPOTS.includes(this.s.system)||!supportsAntimatter(this.s.ship)||this.standing()<50||equipment.antimatter||this.s.credits<32000||!this.s.galaxy!.rare[this.s.system]?.stock)return false;this.s.credits-=32000;equipment.antimatter=true;equipment.ammo=Math.min(3,equipment.ammo+1);this.s.galaxy!.rare[this.s.system].stock--;}
  this.save();this.notify(type==='pointDefense'?'Point defence online.':'Antimatter launcher installed. One warhead loaded.');return true;
 }
 buyAntimatter(){const depot=this.s.galaxy!.rare[this.s.system],equipment=this.s.equipment!;if(!this.docked||!this.dockingAllowed||this.standing()<50||!equipment.antimatter||equipment.ammo>=3||!depot?.stock||this.s.credits<8500)return false;depot.stock--;equipment.ammo++;this.s.credits-=8500;this.save();this.notify('Antimatter warhead secured.');return true;}
 update(dt:number){
  if(this.paused){if(this.beamSound){this.beamSound=false;this.onSound('phaser-stop');}this.beams=this.beams.filter(b=>!b.continuous);return;}if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);const s=this.s;const stats=this.stats;s.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.cooldown-=dt;this.sinceHit+=dt;s.energy=Math.min(100,s.energy+dt*14);
  if(this.sinceHit>4)s.shield=Math.min(stats.shield,s.shield+dt*7);
  if(this.jump!==null){this.jumpTime-=dt;s.vx*=.94;s.vy*=.94;if(this.jumpTime<=0){const id=this.jump;s.fuel-=fuelCost(s.system,id);s.system=id;s.x=0;s.y=-80;s.vx=s.vy=0;if(!s.visited.includes(id))s.visited.push(id);this.jump=null;this.populate();this.save();this.notify(`Arrived in ${SYSTEMS[id].name}. ${SYSTEMS[id].security} space.`);}return;}
  if(!this.docked){
   const turn=(this.keys.has('a')||this.keys.has('arrowleft')?1:0)-(this.keys.has('d')||this.keys.has('arrowright')?1:0);let thrust=this.keys.has('w')||this.keys.has('arrowup');const brake=this.keys.has('s')||this.keys.has('arrowdown');if(turn||thrust||brake){this.waypoint=null;this.autoDock=false;}
   s.angle+=turn*dt*2.7;
   if(this.waypoint){const dist=distance(s,this.waypoint);if(dist<35){this.waypoint=null;s.vx*=.5;s.vy*=.5;}else{const desired=Math.atan2(this.waypoint.y-s.y,this.waypoint.x-s.x)-Math.PI/2;const diff=Math.atan2(Math.sin(desired-s.angle),Math.cos(desired-s.angle));s.angle+=Math.sign(diff)*Math.min(Math.abs(diff),dt*3);thrust=Math.abs(diff)<.45;}}
   const boost=thrust&&this.keys.has('shift')&&s.energy>8;const speed=stats.speed*(boost?1.8:1);if(boost)s.energy-=dt*28;
   if(thrust){s.vx-=Math.sin(s.angle)*dt*speed*1.4;s.vy+=Math.cos(s.angle)*dt*speed*1.4;}const drag=Math.exp(-dt*(brake?5:thrust?.75:1.6));s.vx*=drag;s.vy*=drag;const velocity=Math.hypot(s.vx,s.vy);if(velocity>speed){s.vx*=speed/velocity;s.vy*=speed/velocity;}s.x+=s.vx*dt;s.y+=s.vy*dt;
   if(Math.hypot(s.x,s.y)>5200){s.x*=.997;s.y*=.997;this.notify('System boundary. Use the galaxy map to jump.');}
   if(this.keys.has(' ')||this.keys.has('fire')||this.beamTrigger>0)this.fire(dt);this.beamTrigger=Math.max(0,this.beamTrigger-dt);
   if(this.autoDock&&this.nearby)this.dock();
  }
  if(this.dynamic)tickGalaxy(this);tickBattle(this,dt);
  if(this.phaserLocked&&s.energy>18)this.phaserLocked=false;
  if(this.beamSound&&!this.beams.some(b=>b.id===-1)){this.beamSound=false;this.onSound('phaser-stop');}
  this.contacts=this.contacts.filter(c=>c.hull>0);this.bullets=this.bullets.filter(b=>b.life>0);for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0).slice(-1024);
  if(s.hull<=0){s.credits=Math.floor(s.credits*.9);s.cargo=s.cargo.map(()=>0);s.hull=stats.hull;s.shield=stats.shield;s.fuel=Math.max(s.fuel,30);if(!this.dockingAllowed){const safe=SYSTEMS.find(sys=>this.standing(this.owner(sys.id))>=0&&(this.s.incidents?.[sys.id]?.until??0)<=s.time&&!this.s.losses?.includes('port-'+sys.id));s.system=safe?.id??0;if(!safe){this.s.factionRep![this.owner(0)]=0;delete this.s.incidents![0];this.s.losses=this.s.losses!.filter(id=>id!=='port-0');}this.populate();}s.x=STATION.x-130;s.y=STATION.y;s.vx=s.vy=0;this.waypoint=null;this.autoDock=false;this.bullets=[];this.docked=true;this.save();this.onRescue();this.notify('Escape pod recovered. Cargo lost; 10% of credits paid for recovery.','error');}
 }
}
