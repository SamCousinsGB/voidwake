import { SHIPS,WEAPONS,FACTIONS,supportsPointDefense,type WeaponId } from './world.ts';
import { atWar,ownerOf,conditionAt,report } from './galaxy.ts';
import type { Universe,Contact,Bullet } from './engine.ts';
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const pirate=(c:Contact)=>c.kind==='hostile'||c.role==='blockade';
export function enemies(g:Universe,a:Contact,b:Contact|'player'){
 if(b==='player')return (g.isHostile(a)||(a.kind==='trader'&&(a.provoked||g.standing(a.faction)<0||g.alert)))&&!g.docked;
 if(a.id===b.id||b.hull<=0||['planet','salvage'].includes(b.kind))return false;
 if(pirate(a)!==pirate(b)&&(pirate(a)||pirate(b)))return true;
 if(a.faction&&b.faction&&atWar(g,a.faction,b.faction))return true;
 return a.faction!==b.faction&&((a.role==='invader'&&b.faction===ownerOf(g,g.s.system))||(b.role==='invader'&&a.faction===ownerOf(g,g.s.system)));
}
function position(g:Universe,v:Contact|'player'){return v==='player'?g.s:v;}
export function chooseTarget(g:Universe,c:Contact):Contact|'player'|undefined{
 if(!g.dynamic)return enemies(g,c,'player')?'player':undefined;
 let best:Contact|'player'|undefined,score=Infinity;
 for(const target of g.contacts){if(!enemies(g,c,target))continue;let d=dist(c,target);if(c.kind==='hostile'&&target.kind==='trader')d*=.55;if(d<score&&dist(c,target)<1900){score=d;best=target;}}
 if(enemies(g,c,'player')&&dist(c,g.s)<Math.min(score,1500))best='player';return best;
}
export function beam(g:Universe,id:number,source:{x:number;y:number},target:{x:number;y:number},color:string,enemy:boolean,continuous=false){
 let b=g.beams.find(b=>b.id===id);if(!b){b={id,x:source.x,y:source.y,tx:target.x,ty:target.y,life:.14,maxLife:.14,color,enemy,continuous};g.beams.push(b);}Object.assign(b,{x:source.x,y:source.y,tx:target.x,ty:target.y,life:continuous?.14:.24,maxLife:continuous?.14:.24});
}
export function shootNPC(g:Universe,c:Contact,target:Contact|'player',dt:number){
 const victim=position(g,target),d=dist(c,victim);const weapon:WeaponId=c.role==='battery'?'missile':c.role==='blockade'?'torpedo':c.kind==='station'?'laser':SHIPS[c.ship??'razor'].weapon;
 const w=WEAPONS[weapon];if(d>w.range||c.fire>0)return;
 const base=c.kind==='station'?30:SHIPS[c.ship??'razor'].damage*.5+8;
 const color=c.faction?FACTIONS[c.faction].color:'#ff8264';
 if(weapon==='phaser'){
  if((c.energy??100)<dt*21){c.fire=1.5;return;}c.energy=(c.energy??100)-dt*21;
  const id=c.beamId??(c.beamId=g.shotId++);beam(g,id,c,victim,color,true,true);
  if(target==='player')g.damagePlayer(base*dt);else g.damageContact(target,base*dt,'phaser',c.id);return;
 }
 if(weapon==='laser'){beam(g,g.shotId++,c,victim,color,true);if(target==='player')g.damagePlayer(base*1.2);else g.damageContact(target,base*1.2,'laser',c.id);c.fire=1.6;return;}
 const count=c.role==='battery'?3:1;
 for(let i=0;i<count;i++){const a=Math.atan2(victim.y-c.y,victim.x-c.x)+(weapon==='missile'?(i-(count-1)/2)*.35+.6:0);g.bullets.push({id:g.shotId++,x:c.x,y:c.y,vx:Math.cos(a)*250,vy:Math.sin(a)*250,life:7,enemy:true,damage:base*(weapon==='torpedo'?5:3.5),kind:weapon,target:target==='player'?'player':target.id,source:c.id,side:pirate(c)?'pirate':c.faction,age:0,trail:[],integrity:3});}
 c.fire=c.role==='battery'?7:weapon==='torpedo'?4.5:3.5;
}
function projectileEnemy(g:Universe,b:Bullet,c:Contact|'player'){
 if(c==='player')return b.enemy&&(b.target==='player'||!b.source);
 if(c.id===b.source||!g.attackable(c))return false;
 if(b.source==='player'||!b.enemy)return true;
 if(b.target===c.id)return true;
 if(b.side==='pirate')return !pirate(c);
 if(b.side&&b.side!=='player')return pirate(c)||(!!c.faction&&atWar(g,b.side,c.faction));
 return false;
}
export function pointDefense(g:Universe,dt:number){
 const defenders:(Contact|'player')[]=['player',...(g.dynamic?g.contacts.filter(c=>c.hull>0&&(c.kind==='station'||(c.ship&&supportsPointDefense(c.ship)&&SHIPS[c.ship].tier>=2))):[])];
 for(const c of defenders){
  const player=c==='player',level=player?(supportsPointDefense(g.s.ship)?g.s.equipment!.pointDefense:0):c.role==='battery'?1:2;if(!level||player&&g.docked)continue;
  const cooldown=player?g.pdCooldown:c.pdCooldown??0;if(cooldown>0){if(player)g.pdCooldown-=dt;else c.pdCooldown=cooldown-dt;continue;}
  const pos=position(g,c),range=level===1?330:470;
  const missile=g.bullets.filter(b=>b.kind==='missile'&&b.life>0&&projectileEnemy(g,b,c)&&(player||b.source!=='player'||g.isHostile(c)||b.target===c.id)&&dist(pos,b)<range).sort((a,b)=>dist(pos,a)-dist(pos,b))[0];
  if(!missile||player&&g.s.energy<5)continue;
  if(player){g.s.energy-=5;g.pdCooldown=level===1?.6:.3;}else c.pdCooldown=.65;
  beam(g,g.shotId++,pos,missile,'#b0fff0',!player);missile.life=0;
  g.effects.push({id:g.shotId++,x:missile.x,y:missile.y,radius:30,life:.35,maxLife:.35,kind:'intercept',color:'#acfff0'});g.burst(missile.x,missile.y,'#b6fff0',8);if(player){g.interceptions++;g.onSound('intercept');}
 }
}
export function detonate(g:Universe,b:Bullet){
 if(b.detonated)return;b.detonated=true;b.life=0;
 const kind=b.kind??'torpedo',singularity=kind==='antimatter',radius=singularity?350:kind==='torpedo'?180:95;
 g.effects.push({id:g.shotId++,x:b.x,y:b.y,radius,life:singularity?3.5:1,maxLife:singularity?3.5:1,kind:singularity?'singularity':'explosion',color:WEAPONS[kind].color});
 g.burst(b.x,b.y,WEAPONS[kind].color,singularity?90:kind==='torpedo'?55:36);
 const cameraDistance=dist(g.s,b);if(cameraDistance<1200)g.shake=Math.min(24,g.shake+(singularity?22:kind==='torpedo'?15:9)*(1-cameraDistance/1500));
 g.onSound(singularity?'singularity':kind==='torpedo'?'torpedo-impact':'missile-impact');
 const source=b.source??(b.enemy?'npc':'player');
 for(const c of [...g.contacts]){if(!g.attackable(c)||c.id===source)continue;const d=dist(c,b);if(d>radius)continue;
  const damage=singularity?c.hull+c.shield+1:b.damage*(1-.6*d/radius);g.damageContact(c,damage,kind,source);if(c.kind!=='station'&&c.hull>0){const force=(1-d/radius)*120;c.vx+=(c.x-b.x)/(d||1)*force;c.vy+=(c.y-b.y)/(d||1)*force;}
 }
 if(b.enemy&&!g.docked&&dist(g.s,b)<radius)g.damagePlayer(singularity?g.s.hull+g.s.shield+1:b.damage*(1-.6*dist(g.s,b)/radius));
}
export function tickBattle(g:Universe,dt:number){
 const s=g.s;
 for(const c of [...g.contacts]){
  if(c.hull<=0||c.kind==='planet')continue;c.fire-=dt;c.energy=Math.min(100,(c.energy??100)+dt*10);
  if(c.departing){c.x+=dt*300;if(dist(c,s)>2000)c.hull=0;continue;}
  if(c.kind==='salvage'){
   if(dist(c,s)<65){if(c.role==='relic'){s.equipment!.ammo=Math.min(3,s.equipment!.ammo+1);s.credits+=900;c.hull=0;const event=g.s.galaxy!.conditions[s.system];if(event?.serial===c.encounter)event.resolved=true;report(g,'Research cache recovered: one antimatter warhead and 900 cr.');g.save();}
    else if(g.usedCargo<g.stats.cargo){s.cargo[1]++;s.credits+=100;c.hull=0;g.notify('Salvage recovered · 1 t titanium · 100 cr.');}}
   continue;
  }
  const target=chooseTarget(g,c);if(c.kind==='patrol')c.distressed=!!target;
  if(c.kind==='trader'){
   let goal=c.routeGoal??{x:300+Math.cos(s.time*.035+(Number(c.id.at(-1))||0)*2.2)*850,y:20+Math.sin(s.time*.035+(Number(c.id.at(-1))||0)*2.2)*600};
   if(target&&dist(c,position(g,target))<900){const danger=position(g,target),a=Math.atan2(c.y-danger.y,c.x-danger.x);goal={x:c.x+Math.cos(a)*1000,y:c.y+Math.sin(a)*1000};if(!c.distressed&&c.role==='convoy')report(g,c.name+': taking fire. Requesting escort.');c.distressed=true;}else c.distressed=false;
   const a=Math.atan2(goal.y-c.y,goal.x-c.x),speed=c.distressed?175:c.role==='convoy'?45:65;c.angle=a-Math.PI/2;c.vx=Math.cos(a)*speed;c.vy=Math.sin(a)*speed;c.x+=c.vx*dt;c.y+=c.vy*dt;
   if(c.role==='convoy'&&!c.distressed&&dist(c,goal)<75){g.s.galaxy!.supply[s.system]=Math.min(60,(g.s.galaxy!.supply[s.system]??0)+10);for(let i=0;i<6;i++)g.stock[i]=Math.min(300,g.stock[i]+8);report(g,'Relief convoy docked. Markets resupplied.');c.hull=0;const e=g.s.galaxy!.conditions[s.system];if(e?.serial===c.encounter&&(e.kind==='convoy'||!g.contacts.some(x=>x.role==='raider'&&x.encounter===e.serial&&x.hull>0)))e.resolved=true;g.save();}
   continue;
  }
  if(target){const pos=position(g,target),d=dist(c,pos);if(c.kind!=='station'){const a=Math.atan2(pos.y-c.y,pos.x-c.x),desired=a-Math.PI/2,diff=Math.atan2(Math.sin(desired-c.angle),Math.cos(desired-c.angle));c.angle+=Math.sign(diff)*Math.min(Math.abs(diff),dt*1.8);const speed=d<280?-25:c.role==='invader'?90:125;c.vx=Math.cos(a)*speed;c.vy=Math.sin(a)*speed;c.x+=c.vx*dt;c.y+=c.vy*dt;}shootNPC(g,c,target,dt);}
  else if(c.kind!=='station'){const a=s.time*.04+(Number(c.id.at(-1))||0);c.vx=Math.cos(a)*35;c.vy=Math.sin(a)*35;c.x+=c.vx*dt;c.y+=c.vy*dt;}
 }
 pointDefense(g,dt);
 for(const b of g.bullets){
  if(b.life<=0)continue;const oldX=b.x,oldY=b.y;b.age=(b.age??0)+dt;
  if(b.kind==='missile'&&b.target){const target=b.target==='player'?s:g.contacts.find(c=>c.id===b.target&&c.hull>0);if(target&&b.age>.2){const lead=Math.min(.65,dist(b,target)/640),desired=Math.atan2(target.y+Math.max(-350,Math.min(350,target.vy))*lead-b.y,target.x+Math.max(-350,Math.min(350,target.vx))*lead-b.x),angle=Math.atan2(b.vy,b.vx),diff=Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle)),next=angle+Math.max(-dt*2.6,Math.min(dt*2.6,diff)),speed=Math.min(680,Math.hypot(b.vx,b.vy)+dt*210);b.vx=Math.cos(next)*speed;b.vy=Math.sin(next)*speed;}}
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.trail){b.trail.push({x:b.x,y:b.y});if(b.trail.length>35)b.trail.shift();}
  const segmentDistance=(c:{x:number;y:number})=>{const dx=b.x-oldX,dy=b.y-oldY,t=Math.max(0,Math.min(1,((c.x-oldX)*dx+(c.y-oldY)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(c.x-oldX-dx*t,c.y-oldY-dy*t);};
  let impact=g.contacts.find(c=>projectileEnemy(g,b,c)&&segmentDistance(c)<(c.radius??27));
  if(impact){b.x=impact.x;b.y=impact.y;detonate(g,b);}else if(projectileEnemy(g,b,'player')&&segmentDistance(s)<25*SHIPS[s.ship].size){b.x=s.x;b.y=s.y;if(!b.kind){b.life=0;g.damagePlayer(b.damage);}else detonate(g,b);}else if(b.life<=0&&b.kind)detonate(g,b);
 }
 if(conditionAt(g)?.kind==='storm'){s.shield=Math.max(0,s.shield-dt*2.5);s.energy=Math.max(0,s.energy-dt*3);}
 g.effects=g.effects.filter(e=>(e.life-=dt)>0).slice(-40);g.shake=Math.max(0,g.shake-dt*22);g.beams=g.beams.filter(b=>(b.life-=dt)>0).slice(-80);g.bullets=g.bullets.filter(b=>b.life>0).slice(-200);g.contacts=g.contacts.filter(c=>c.hull>0).slice(0,60);
}
