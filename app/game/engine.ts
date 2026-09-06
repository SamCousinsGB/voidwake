import { loadCookieSave, saveToCookies } from './cookies.ts';
export const SYSTEMS = [
 {id:0,name:'Solace',region:'THE INNER FRONTIER',faction:'Concord Union',kind:'Agricultural',security:'Secure',risk:1,x:24,y:55,color:'#6bc4ee',planet:'Solace Prime',station:'Port Meridian',prices:[42,112,210,76,340,165]},
 {id:1,name:'Cinder',region:'THE ASHEN BELT',faction:'Free Traders',kind:'Industrial',security:'Contested',risk:2,x:42,y:70,color:'#e89d6b',planet:'Cinder IV',station:'Foundry Nine',prices:[88,58,295,120,250,200]},
 {id:2,name:'Vesper',region:'THE INNER FRONTIER',faction:'Concord Union',kind:'High tech',security:'Secure',risk:1,x:47,y:34,color:'#a69aef',planet:'Vesper II',station:'Kepler Exchange',prices:[73,145,140,180,480,98]},
 {id:3,name:'Aster',region:'THE EMERALD EXPANSE',faction:'Free Traders',kind:'Agricultural',security:'Patrolled',risk:2,x:68,y:52,color:'#67cbb0',planet:'Aster Reach',station:'Verdant Anchorage',prices:[32,128,240,68,370,185]},
 {id:4,name:'Nyx',region:'THE OUTER REACH',faction:'Ashen Syndicate',kind:'Extraction',security:'Hostile',risk:4,x:75,y:22,color:'#ca879f',planet:'Nyx Umbra',station:'Blackwater Terminal',prices:[102,46,315,195,175,280]},
 {id:5,name:'Kestrel',region:'THE OUTER REACH',faction:'Free Traders',kind:'Frontier',security:'Lawless',risk:3,x:85,y:78,color:'#d7bd7e',planet:'Kestrel Minor',station:'Last Light',prices:[122,160,365,210,550,240]},
 {id:6,name:'Halo',region:'THE SILENT VEIL',faction:'Concord Union',kind:'High tech',security:'Patrolled',risk:2,x:23,y:17,color:'#8bbcd5',planet:'Halo Oceanus',station:'Watchtower',prices:[89,120,155,148,465,82]},
];
export const GOODS = [
 {name:'Food supplies',unit:'t',desc:'Staples & hydroponics',icon:'food'},
 {name:'Titanium ore',unit:'t',desc:'Raw industrial material',icon:'ore'},
 {name:'Microcircuits',unit:'t',desc:'Precision electronics',icon:'tech'},
 {name:'Medical supplies',unit:'t',desc:'Frontier essentials',icon:'med'},
 {name:'Void crystals',unit:'t',desc:'Rare reactor material',icon:'crystal'},
 {name:'Starship parts',unit:'t',desc:'Machined components',icon:'parts'},
];
export type ShipClass = 'courier' | 'interceptor' | 'freighter';
export const SHIPS = {
 courier: {name:'Peregrine',role:'Light courier',hull:160,shield:100,cargo:30,speed:240,damage:18,price:0},
 interceptor:{name:'Lancer',role:'Heavy interceptor',hull:250,shield:170,cargo:24,speed:300,damage:30,price:7500},
 freighter:{name:'Atlas',role:'Armed freighter',hull:320,shield:140,cargo:90,speed:170,damage:23,price:10500},
};
export type Contact = {id:string,name:string,kind:'station'|'hostile'|'trader'|'patrol'|'salvage',x:number,y:number,vx:number,vy:number,angle:number,hull:number,maxHull:number,shield:number,fire:number};
export type Bullet = {id:number,x:number,y:number,vx:number,vy:number,life:number,enemy:boolean,damage:number};
export type Particle = {x:number,y:number,vx:number,vy:number,life:number,maxLife:number,color:string};
export type Contract = {id:string,title:string,type:'delivery'|'bounty'|'explore',target:number,reward:number,good?:number,quantity:number,progress:number,done:boolean,origin:number};
export type GameState = {
 version:1; system:number; x:number;y:number;vx:number;vy:number;angle:number; hull:number;shield:number;energy:number;fuel:number;credits:number;
 ship:ShipClass; upgrades:{weapon:number;shield:number;engine:number;cargo:number}; cargo:number[];stocks:Record<number,number[]>;
 kills:number;profit:number;visited:number[];contracts:Contract[];completed:string[];reputation:number;time:number;docked?:boolean;preferences?:{muted:boolean;zoom:number};
};
export const STATION = {x:300,y:20};
export const SAVE_KEY = 'voidwake-save-v1';
export const distance = (a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export const systemDistance = (a:number,b:number)=>distance(SYSTEMS[a],SYSTEMS[b])/9;
export const fuelCost = (a:number,b:number)=>Math.ceil(systemDistance(a,b)*4);
export function initialState():GameState { return {version:1,system:0,x:0,y:-80,vx:0,vy:0,angle:0.5,hull:160,shield:100,energy:100,fuel:80,credits:2400,ship:'courier',upgrades:{weapon:0,shield:0,engine:0,cargo:0},cargo:[0,0,0,0,0,0],stocks:{},kills:0,profit:0,visited:[0],contracts:[],completed:[],reputation:0,time:0}; }
export class Universe {
 s:GameState=initialState(); contacts:Contact[]=[];bullets:Bullet[]=[];particles:Particle[]=[];
 keys=new Set<string>(); target:string='station'; waypoint:{x:number;y:number}|null=null;
 paused=false;docked=false;autoDock=false;jump:number|null=null;jumpTime=0;cooldown=0;sinceHit=10;shotId=0;
 zoom=1;message='';messageTime=0;toastKind='info';
 onChange:()=>void=()=>{}; onDock:()=>void=()=>{};onRescue:()=>void=()=>{};onSound:(type:string)=>void=()=>{};
 onRestore:()=>void=()=>{};
 constructor(state?:GameState) { if(state)this.s=state;this.populate(); }
 get stats(){const b=SHIPS[this.s.ship];return {...b,hull:b.hull,shield:b.shield+this.s.upgrades.shield*40,cargo:b.cargo+this.s.upgrades.cargo*15,speed:b.speed+this.s.upgrades.engine*25,damage:b.damage+this.s.upgrades.weapon*8};}
 get usedCargo(){return this.s.cargo.reduce((a,b)=>a+b,0);}
 reservedCargo(good:number){return this.s.contracts.filter(c=>!c.done&&c.type==='delivery'&&c.good===good).reduce((n,c)=>n+c.quantity,0);}
 availableCargo(good:number){return Math.max(0,this.s.cargo[good]-this.reservedCargo(good));}
 get selected(){return this.contacts.find(c=>c.id===this.target);}
 get nearby(){return distance(this.s,STATION)<185;}
 get stock(){return this.s.stocks[this.s.system]??(this.s.stocks[this.s.system]=[80,60,45,70,30,55]);}
 get price(){return SYSTEMS[this.s.system].prices;}
 notify(message:string,kind='info'){this.message=message;this.messageTime=3.5;this.toastKind=kind;this.onChange();}
 populate(){
  const sys=SYSTEMS[this.s.system];this.contacts=[{id:'station',name:sys.station,kind:'station',...STATION,vx:0,vy:0,angle:0,hull:5000,maxHull:5000,shield:2000,fire:0}];
  for(let i=0;i<3;i++)this.contacts.push({id:`trader-${i}`,name:['MV Wayfarer','CSV Resolute','MV Far Horizon'][i],kind:i===1?'patrol':'trader',x:320-i*260,y:-280+i*420,vx:0,vy:0,angle:i*1.7,hull:180,maxHull:180,shield:80,fire:0});
  for(let i=0;i<sys.risk+1;i++)this.contacts.push({id:`pirate-${i}`,name:['Ashen Marauder','Syndicate Raider','Outlaw Corsair','Ashen Reaver','Syndicate Fang'][i],kind:'hostile',x:1050+250*Math.cos(i*2),y:-500+i*300,vx:0,vy:0,angle:-1,hull:70+sys.risk*12,maxHull:70+sys.risk*12,shield:0,fire:2+i});
  this.bullets=[];this.particles=[];this.target='station';
 }
 saveStatus:'pending'|'saved'|'blocked'='pending';
 save(){this.s.docked=this.docked;const ok=saveToCookies(this.s);this.saveStatus=ok?'saved':'blocked';return ok;}
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
   if(!Array.isArray(s.contracts)||s.contracts.length>21||s.contracts.some(c=>!c||typeof c.id!=='string'||typeof c.title!=='string'||c.title.length>150||!['delivery','bounty','explore'].includes(c.type)||!Number.isInteger(c.target)||!SYSTEMS[c.target]||!Number.isInteger(c.origin)||!SYSTEMS[c.origin]||!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>90||!finite(c.reward)||c.reward<0||!finite(c.progress)||c.progress<0||typeof c.done!=='boolean'||(c.type==='delivery'&&(!Number.isInteger(c.good)||!GOODS[c.good!]))))return null;
   if(s.preferences&&(typeof s.preferences.muted!=='boolean'||!finite(s.preferences.zoom)||s.preferences.zoom<.5||s.preferences.zoom>1.8))return null;
   return s;
  }catch{return null;}
 }
 static restore(){
  const cookieState=Universe.validate(loadCookieSave());
  if(cookieState)return cookieState;
  // One-time migration: never write saves to localStorage, and only remove the old copy after verified cookie storage.
  try{if(typeof localStorage==='undefined')return null;const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const legacy=Universe.validate(JSON.parse(raw));if(!legacy)return null;if(saveToCookies(legacy))localStorage.removeItem(SAVE_KEY);return legacy;}catch{return null;}
 }
 dock(){if(this.jump!==null)return false;if(!this.nearby){this.waypoint={...STATION};this.autoDock=true;this.notify('Docking approach set.');return false;}this.docked=true;this.autoDock=false;this.waypoint=null;this.s.vx=this.s.vy=0;this.save();this.onDock();this.onSound('dock');this.notify(`Docked at ${SYSTEMS[this.s.system].station}.`);return true;}
 undock(){this.docked=false;this.s.x=STATION.x-160;this.s.y=STATION.y-65;this.s.vx=this.s.vy=0;this.notify('Undocked.');}
 trade(good:number,quantity:number,buy:boolean){if(!this.docked)return {ok:false,message:'Dock at a station to trade.'};if(!Number.isInteger(good)||!GOODS[good]||!Number.isInteger(quantity)||quantity<1||typeof buy!=='boolean')return {ok:false,message:'Choose a valid item and quantity.'};const price=buy?this.price[good]:Math.floor(this.price[good]*0.85);if(buy&&(this.s.credits<price*quantity||this.usedCargo+quantity>this.stats.cargo||this.stock[good]<quantity))return {ok:false,message:'Not enough credits, cargo space, or market stock.'};if(!buy&&this.availableCargo(good)<quantity)return {ok:false,message:'Not enough unreserved cargo to sell.'};this.s.credits+=(buy?-1:1)*price*quantity;this.s.cargo[good]+=(buy?1:-1)*quantity;this.stock[good]+=(buy?-1:1)*quantity;if(!buy)this.s.profit+=price*quantity;this.onSound('trade');this.save();this.notify(`${buy?'Purchased':'Sold'} ${quantity} t of ${GOODS[good].name.toLowerCase()} for ${price*quantity} cr.`);return {ok:true,message:this.message};}
 service(type:'repair'|'fuel'){if(!this.docked)return;const missing=type==='repair'?Math.ceil(this.stats.hull-this.s.hull):Math.ceil(100-this.s.fuel);const cost=missing*(type==='repair'?3:4);if(this.s.credits<cost){this.notify('Not enough credits for this service.','error');return;}this.s.credits-=cost;if(type==='repair'){this.s.hull=this.stats.hull;this.s.shield=this.stats.shield;}else this.s.fuel=100;this.save();this.notify(type==='repair'?'Hull repaired. Shields restored.':'Jump fuel replenished.');}
 upgrade(type:keyof GameState['upgrades']){if(!this.docked)return;const level=this.s.upgrades[type];const cost=(level+1)*[900,750,650,600][['weapon','shield','engine','cargo'].indexOf(type)];if(level>=3||this.s.credits<cost)return;this.s.credits-=cost;this.s.upgrades[type]++;this.save();this.notify('Upgrade installed.');this.onSound('trade');}
 buyShip(ship:ShipClass){const next=SHIPS[ship];if(!this.docked||ship===this.s.ship||this.s.credits<next.price||this.usedCargo>next.cargo+this.s.upgrades.cargo*15)return;this.s.credits-=next.price;this.s.ship=ship;this.s.hull=this.stats.hull;this.s.shield=this.stats.shield;this.save();this.notify(`${next.name} is ready in your berth. Upgrades transferred.`);}
 startJump(id:number){if(!Number.isInteger(id)||!SYSTEMS[id]||id===this.s.system)return false;if(systemDistance(this.s.system,id)>5.8){this.notify('Destination exceeds jump range. Plot an intermediate stop.','error');return false;}if(this.s.fuel<fuelCost(this.s.system,id)){this.notify('Insufficient fuel.','error');return false;}if(this.docked||this.jump!==null){this.notify('Undock before engaging the jump drive.','error');return false;}this.jump=id;this.jumpTime=3;this.waypoint=null;this.autoDock=false;this.onSound('jump');this.notify(`Jump drive charging. Destination: ${SYSTEMS[id].name}.`);return true;}
 get offers():Contract[]{const origin=this.s.system;const target=(origin+1)%SYSTEMS.length;return [{id:`delivery-${origin}`,title:`Supplies for ${SYSTEMS[target].name}`,type:'delivery',origin,target,reward:1100+SYSTEMS[target].risk*250,good:0,quantity:8,progress:0,done:false},{id:`bounty-${origin}`,title:'Clear the trade lanes',type:'bounty',origin,target:origin,reward:1700+SYSTEMS[origin].risk*200,quantity:2,progress:0,done:false},{id:`explore-${origin}`,title:`Chart a route to ${SYSTEMS[(origin+2)%7].name}`,type:'explore',origin,target:(origin+2)%7,reward:750,quantity:1,progress:0,done:false}].filter(c=>!this.s.completed.includes(c.id)&&!this.s.contracts.some(a=>a.id===c.id)) as Contract[];}
 accept(id:string){const c=this.offers.find(o=>o.id===id);if(!this.docked||!c||this.s.contracts.filter(a=>!a.done).length>=3)return;if(c.type==='delivery'){if(this.usedCargo+c.quantity>this.stats.cargo){this.notify('Free up 8 t of cargo space to load the shipment.','error');return;}this.s.cargo[c.good!]+=c.quantity;}this.s.contracts.push({...c});this.save();this.notify(`Contract accepted: ${c.title}.`);}
 complete(id:string){const c=this.s.contracts.find(c=>c.id===id);if(!c||c.done||!this.docked)return;if(c.type==='delivery'){if(this.s.system!==c.target||this.s.cargo[c.good!]<c.quantity)return;this.s.cargo[c.good!]-=c.quantity;}else if(c.type==='bounty'?(c.progress<c.quantity||this.s.system!==c.origin):(this.s.system!==c.target))return;c.done=true;this.s.credits+=c.reward;this.s.reputation+=5;this.s.completed.push(c.id);this.save();this.notify(`Contract complete. +${c.reward} cr. Reputation increased.`);this.onSound('trade');}
 cancelContract(id:string){const i=this.s.contracts.findIndex(c=>c.id===id&&!c.done);if(i<0)return;const c=this.s.contracts[i];if(c.type==='delivery'){const qty=Math.min(this.s.cargo[c.good!],c.quantity);this.s.cargo[c.good!]-=qty;this.s.credits=Math.max(0,this.s.credits-(c.quantity-qty)*42);}this.s.contracts.splice(i,1);this.save();this.notify('Contract abandoned. Undelivered cargo reclaimed.');}
 cycle(){const all=this.contacts.filter(c=>c.kind==='hostile');if(!all.length)return;const i=all.findIndex(c=>c.id===this.target);this.target=all[(i+1)%all.length].id;this.onChange();}
 emergencyTow(){this.s.credits=Math.max(0,this.s.credits-250);this.s.x=STATION.x-120;this.s.y=STATION.y;this.s.vx=this.s.vy=0;this.s.fuel=Math.max(this.s.fuel,25);this.s.hull=Math.max(this.s.hull,40);this.waypoint=null;this.dock();this.notify('Recovery tug dispatched. Up to 250 cr charged; reserve fuel supplied.');}
 burst(x:number,y:number,color:string,count=15){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2;const life=.3+Math.random()*.9;this.particles.push({x,y,vx:Math.cos(a)*(30+Math.random()*100),vy:Math.sin(a)*(30+Math.random()*100),life,maxLife:life,color});}}
 fire(){if(this.cooldown>0||this.s.energy<6||this.docked||this.jump!==null)return;let a=this.s.angle;const target=this.selected;if(target?.kind==='hostile'&&distance(this.s,target)<800)a=Math.atan2(target.y-this.s.y,target.x-this.s.x)-Math.PI/2;this.bullets.push({id:this.shotId++,x:this.s.x-Math.sin(a)*30,y:this.s.y+Math.cos(a)*30,vx:-Math.sin(a)*650+this.s.vx,vy:Math.cos(a)*650+this.s.vy,enemy:false,life:1.45,damage:this.stats.damage});this.s.energy-=6;this.cooldown=.24;this.onSound('fire');}
 update(dt:number){
  if(this.paused)return;dt=Math.min(dt,.05);const s=this.s;const stats=this.stats;s.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.cooldown-=dt;this.sinceHit+=dt;s.energy=Math.min(100,s.energy+dt*14);
  if(this.sinceHit>4)s.shield=Math.min(stats.shield,s.shield+dt*7);
  if(this.jump!==null){this.jumpTime-=dt;s.vx*=.94;s.vy*=.94;if(this.jumpTime<=0){const id=this.jump;s.fuel-=fuelCost(s.system,id);s.system=id;s.x=0;s.y=-80;s.vx=s.vy=0;if(!s.visited.includes(id))s.visited.push(id);this.jump=null;this.populate();this.save();this.notify(`Arrived in ${SYSTEMS[id].name}. ${SYSTEMS[id].security} space.`);}return;}
  if(!this.docked){
   const turn=(this.keys.has('a')||this.keys.has('arrowleft')?1:0)-(this.keys.has('d')||this.keys.has('arrowright')?1:0);let thrust=this.keys.has('w')||this.keys.has('arrowup');const brake=this.keys.has('s')||this.keys.has('arrowdown');if(turn||thrust||brake){this.waypoint=null;this.autoDock=false;}
   s.angle+=turn*dt*2.7;
   if(this.waypoint){const dist=distance(s,this.waypoint);if(dist<35){this.waypoint=null;s.vx*=.5;s.vy*=.5;}else{const desired=Math.atan2(this.waypoint.y-s.y,this.waypoint.x-s.x)-Math.PI/2;const diff=Math.atan2(Math.sin(desired-s.angle),Math.cos(desired-s.angle));s.angle+=Math.sign(diff)*Math.min(Math.abs(diff),dt*3);thrust=Math.abs(diff)<.45;}}
   const boost=thrust&&this.keys.has('shift')&&s.energy>8;const speed=stats.speed*(boost?1.8:1);if(boost)s.energy-=dt*28;
   if(thrust){s.vx-=Math.sin(s.angle)*dt*speed*1.4;s.vy+=Math.cos(s.angle)*dt*speed*1.4;}const drag=Math.exp(-dt*(brake?5:thrust?.75:1.6));s.vx*=drag;s.vy*=drag;const velocity=Math.hypot(s.vx,s.vy);if(velocity>speed){s.vx*=speed/velocity;s.vy*=speed/velocity;}s.x+=s.vx*dt;s.y+=s.vy*dt;
   if(Math.hypot(s.x,s.y)>3000){s.x*=.997;s.y*=.997;this.notify('System boundary. Use the galaxy map to jump.');}
   if(this.keys.has(' ')||this.keys.has('fire'))this.fire();
   if(this.autoDock&&this.nearby)this.dock();
  }
  for(const c of this.contacts){
   if(c.kind==='hostile'){
    c.fire-=dt;const d=distance(c,s);const active=d<(SYSTEMS[s.system].risk===1?700:1000)&&!this.docked&&distance(s,STATION)>240;
    if(active){const desired=Math.atan2(s.y-c.y,s.x-c.x)-Math.PI/2;const diff=Math.atan2(Math.sin(desired-c.angle),Math.cos(desired-c.angle));c.angle+=Math.sign(diff)*Math.min(Math.abs(diff),dt*1.3);const speed=d<230?-28:72+SYSTEMS[s.system].risk*6;c.x-=Math.sin(c.angle)*speed*dt;c.y+=Math.cos(c.angle)*speed*dt;if(d<650&&c.fire<=0){const a=Math.atan2(s.y-c.y,s.x-c.x);this.bullets.push({id:this.shotId++,x:c.x,y:c.y,vx:Math.cos(a)*290,vy:Math.sin(a)*290,enemy:true,life:2.3,damage:9+SYSTEMS[s.system].risk*2});c.fire=1.3+Math.random()*.6;}}
    else{c.x+=Math.cos(s.time*.1+Number(c.id.at(-1)))*dt*20;c.y+=Math.sin(s.time*.1+Number(c.id.at(-1)))*dt*20;}
   }else if(c.kind==='trader'||c.kind==='patrol'){const i=Number(c.id.at(-1));c.x=STATION.x+Math.cos(s.time*.055+i*2.2)*(320+i*120);c.y=STATION.y+Math.sin(s.time*.055+i*2.2)*(250+i*80);c.angle=s.time*.055+i*2.2;}
   else if(c.kind==='salvage'&&distance(c,s)<65&&this.usedCargo<stats.cargo){this.s.cargo[1]++;this.s.credits+=100;c.hull=0;this.notify('Salvage recovered: 1 t titanium and 100 cr.');}
  }
  for(const b of this.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.enemy){if(!this.docked&&distance(b,s)<22){b.life=0;const absorbed=Math.min(s.shield,b.damage);s.shield-=absorbed;s.hull-=b.damage-absorbed;this.sinceHit=0;this.burst(s.x,s.y,absorbed?'#64d9ff':'#ffb56a',6);this.onSound('hit');}}
   else{for(const c of this.contacts){if(c.kind==='hostile'&&c.hull>0&&distance(b,c)<27){b.life=0;c.hull-=b.damage;this.burst(c.x,c.y,'#ffb56a',6);if(c.hull<=0){this.burst(c.x,c.y,'#ffa968',40);s.kills++;const bounty=180+SYSTEMS[s.system].risk*60;s.credits+=bounty;s.reputation++;for(const contract of s.contracts)if(!contract.done&&contract.type==='bounty'&&contract.target===s.system)contract.progress++;this.contacts.push({id:`salvage-${this.shotId++}`,name:'Recoverable cargo',kind:'salvage',x:c.x,y:c.y,vx:0,vy:0,angle:0,hull:1,maxHull:1,shield:0,fire:0});this.notify(`Hostile destroyed. +${bounty} cr bounty. Salvage available.`);this.onSound('explode');this.save();}break;}}}
  }
  this.contacts=this.contacts.filter(c=>c.hull>0);this.bullets=this.bullets.filter(b=>b.life>0);for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);
  if(s.hull<=0){s.credits=Math.floor(s.credits*.9);s.cargo=s.cargo.map(()=>0);s.hull=stats.hull;s.shield=stats.shield;s.fuel=Math.max(s.fuel,30);s.x=STATION.x-130;s.y=STATION.y;s.vx=s.vy=0;this.waypoint=null;this.autoDock=false;this.bullets=[];this.docked=true;this.save();this.onRescue();this.notify('Escape pod recovered. Cargo lost; 10% of credits paid for recovery.','error');}
 }
}
