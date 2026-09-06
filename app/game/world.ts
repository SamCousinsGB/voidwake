export type FactionId = 'union' | 'traders' | 'syndicate' | 'helios' | 'verdant' | 'forge';
export type WeaponId = 'phaser' | 'laser' | 'torpedo' | 'missile' | 'antimatter';
export const FACTIONS = {
 union: {name:'Concord Union',short:'Concord',color:'#7ecfff',secondary:'#416bc6',hull:'#a7bdcc',dark:'#233c59',symbol:'star',style:0,doctrine:'Balanced fleets · phaser arrays',capital:'Solace'},
 traders: {name:'Free Traders',short:'Free Traders',color:'#ffc879',secondary:'#b57542',hull:'#bbaa86',dark:'#433b32',symbol:'compass',style:1,doctrine:'Cargo carriers · missile racks',capital:'Carina'},
 syndicate: {name:'Ashen Syndicate',short:'Ashen',color:'#f07a94',secondary:'#622459',hull:'#625774',dark:'#211d33',symbol:'chevron',style:2,doctrine:'Fast warbirds · plasma torpedoes',capital:'Nyx'},
 helios: {name:'Helios Ascendancy',short:'Helios',color:'#f4dc92',secondary:'#ce6641',hull:'#ded6b8',dark:'#5a4a38',symbol:'sun',style:3,doctrine:'Ring vessels · focused lasers',capital:'Aurelia'},
 verdant: {name:'Pelagic Accord',short:'Pelagic',color:'#64e8c1',secondary:'#236477',hull:'#6c9e98',dark:'#193c49',symbol:'wave',style:4,doctrine:'Organic hulls · shield supremacy',capital:'Thalassa'},
 forge: {name:'Iron Dominion',short:'Dominion',color:'#ed976b',secondary:'#892e25',hull:'#897e76',dark:'#312e32',symbol:'anvil',style:5,doctrine:'Armoured gunships · siege ordnance',capital:'Ferrum'},
} as const;
export const factionIds = Object.keys(FACTIONS) as FactionId[];
export const WEAPONS = {
 phaser:{name:'Phaser array',short:'Phaser',key:'1',range:820,energy:24,cooldown:0,multiplier:3.2,color:'#80dcff',description:'Hold fire · continuous damage · 24 energy/s'},
 laser:{name:'Heavy laser',short:'Laser',key:'2',range:1050,energy:17,cooldown:.8,multiplier:2.3,color:'#f6df88',description:'Long beam · high hull damage'},
 torpedo:{name:'Siege torpedo',short:'Torpedo',key:'3',range:1550,energy:35,cooldown:2.8,multiplier:14,color:'#b59aff',description:'Devastating warhead · 180 m blast · shield breaker'},
 missile:{name:'Seeker missiles',short:'Missiles',key:'4',range:1900,energy:26,cooldown:2,multiplier:7,color:'#ffad77',description:'Heavy guided warhead · 95 m blast · vulnerable to point defence'},
 antimatter:{name:'Antimatter torpedo',short:'Antimatter',key:'5',range:1900,energy:50,cooldown:8,multiplier:9999,color:'#d9acff',description:'Rare ammunition · 350 m singularity · annihilates ships and stations'},
} as const;
export type ShipSpec = {name:string;role:string;hull:number;shield:number;cargo:number;speed:number;damage:number;price:number;faction:FactionId;tier:number;size:number;weapon:WeaponId};
const ship=(name:string,role:string,faction:FactionId,tier:number,hull:number,shield:number,cargo:number,speed:number,damage:number,price:number,size:number,weapon:WeaponId):ShipSpec=>({name,role,faction,tier,hull,shield,cargo,speed,damage,price,size,weapon});
export const SHIPS = {
 courier:ship('Peregrine','Light courier','union',0,160,100,30,240,18,0,1,'phaser'),
 interceptor:ship('Lancer','Heavy interceptor','union',1,250,170,24,300,30,7500,1.12,'phaser'),
 sentinel:ship('Sentinel','Escort cruiser','union',2,430,320,65,210,40,24000,1.55,'phaser'),
 sovereign:ship('Sovereign','Fleet command ship','union',3,850,580,100,165,58,68000,2.05,'laser'),
 hauler:ship('Nomad','Trade cutter','traders',0,190,80,50,210,17,4200,1.1,'missile'),
 freighter:ship('Atlas','Armed freighter','traders',1,320,140,90,170,23,10500,1.4,'missile'),
 caravan:ship('Caravan','Heavy transport','traders',2,550,220,170,145,35,28500,1.75,'torpedo'),
 citadel:ship('Citadel','Convoy carrier','traders',3,1000,420,240,120,49,72000,2.25,'missile'),
 razor:ship('Razor','Raiding scout','syndicate',0,140,90,22,310,21,5200,.95,'laser'),
 talon:ship('Talon','Strike corvette','syndicate',1,260,160,32,285,32,11500,1.2,'torpedo'),
 spectre:ship('Spectre','Warbird','syndicate',2,420,310,45,250,44,31000,1.6,'laser'),
 revenant:ship('Revenant','Assault flagship','syndicate',3,750,500,75,210,63,76000,2,'torpedo'),
 needle:ship('Pilgrim','Solar scout','helios',0,150,130,25,250,20,4800,1,'laser'),
 aureole:ship('Aureole','Ring frigate','helios',1,240,230,40,225,31,12000,1.3,'laser'),
 seraph:ship('Seraph','Beam cruiser','helios',2,400,410,60,190,47,33000,1.65,'laser'),
 apotheon:ship('Apotheon','Solar dreadnought','helios',3,720,760,95,145,65,80000,2.15,'phaser'),
 wisp:ship('Wisp','Reef scout','verdant',0,130,170,32,265,16,4600,1,'phaser'),
 manta:ship('Manta','Shield frigate','verdant',1,230,310,50,240,28,12500,1.35,'phaser'),
 nautilus:ship('Nautilus','Survey cruiser','verdant',2,380,520,85,200,39,32000,1.7,'torpedo'),
 leviathan:ship('Leviathan','Deepwater carrier','verdant',3,690,940,130,145,54,82000,2.2,'missile'),
 mule:ship('Mule','Industrial tug','forge',0,270,60,45,185,22,4300,1.1,'torpedo'),
 anvil:ship('Anvil','Armoured destroyer','forge',1,440,110,50,180,36,13000,1.35,'missile'),
 bastion:ship('Bastion','Siege cruiser','forge',2,760,210,80,150,52,34500,1.7,'torpedo'),
 dreadnought:ship('Behemoth','Siege dreadnought','forge',3,1400,380,120,110,72,85000,2.2,'missile'),
};
export type ShipClass = keyof typeof SHIPS;
export const supportsPointDefense=(id:ShipClass)=>SHIPS[id].tier>=2||['freighter','anvil','aureole'].includes(id);
export const supportsAntimatter=(id:ShipClass)=>SHIPS[id].tier>=2;
export const ANTIMATTER_DEPOTS=[6,12,32,40];
export const fleetFor=(faction:FactionId)=>(Object.keys(SHIPS) as ShipClass[]).filter(id=>SHIPS[id].faction===faction);
export type SystemSpec={id:number;name:string;region:string;faction:string;factionId:FactionId;kind:string;security:string;risk:number;x:number;y:number;color:string;planet:string;station:string;prices:number[]};
const system=(id:number,name:string,factionId:FactionId,kind:string,risk:number,x:number,y:number,planet:string,station:string,prices:number[],color?:string):SystemSpec=>({id,name,factionId,faction:FACTIONS[factionId].name,region:['CONCORD FRONTIER','MERCHANT REACH','THE ASHEN VEIL','SOLAR SANCTUM','PELAGIC EXPANSE','THE IRON MARCH'][FACTIONS[factionId].style],kind,risk,security:risk===1?'Secure':risk===2?'Patrolled':risk===3?'Contested':'Lawless',x,y,planet,station,prices,color:color??FACTIONS[factionId].color});
export const SYSTEMS:SystemSpec[] = [
 system(0,'Solace','union','Agricultural',1,24,55,'Solace Prime','Port Meridian',[42,112,210,76,340,165],'#6bc4ee'),
 system(1,'Cinder','traders','Industrial',2,42,70,'Cinder IV','Foundry Nine',[88,58,295,120,250,200],'#e89d6b'),
 system(2,'Vesper','union','High tech',1,47,34,'Vesper II','Kepler Exchange',[73,145,140,180,480,98],'#a69aef'),
 system(3,'Aster','traders','Agricultural',2,68,52,'Aster Reach','Verdant Anchorage',[32,128,240,68,370,185],'#67cbb0'),
 system(4,'Nyx','syndicate','Extraction',4,75,22,'Nyx Umbra','Blackwater Terminal',[102,46,315,195,175,280],'#ca879f'),
 system(5,'Kestrel','traders','Frontier',3,85,78,'Kestrel Minor','Last Light',[122,160,365,210,550,240],'#d7bd7e'),
 system(6,'Halo','union','High tech',2,23,17,'Halo Oceanus','Watchtower',[89,120,155,148,465,82],'#8bbcd5'),
 system(7,'Eos','union','Research',1,9,36,'Eos Nova','Dawn Array',[70,135,122,142,400,130]),
 system(8,'Carina','traders','Commerce',1,62,94,'Carina Haven','Grand Exchange',[64,90,192,100,320,145]),
 system(9,'Moros','syndicate','Industrial',3,103,10,'Moros Furnace','Obsidian Forge',[130,52,250,210,195,165]),
 system(10,'Erebus','syndicate','Frontier',4,117,35,'Erebus Night','Shadow Anchorage',[116,80,280,155,160,235]),
 system(11,'Lethe','syndicate','Extraction',3,91,48,'Lethe Shroud','Redoubt Seven',[90,40,310,175,148,290]),
 system(12,'Aurelia','helios','High tech',1,137,16,'Aurelia Sanctum','Crown of Dawn',[95,135,130,160,370,98]),
 system(13,'Icarus','helios','Energy',2,162,30,'Icarus Ember','Solar Reliquary',[125,86,205,200,105,175]),
 system(14,'Solis','helios','Agricultural',1,171,57,'Solis Eden','Golden Harbour',[35,153,270,57,410,245]),
 system(15,'Phaeton','helios','Research',3,141,51,'Phaeton Archive','Heliograph',[115,148,108,155,320,110]),
 system(16,'Thalassa','verdant','Agricultural',1,28,113,'Thalassa Deep','Tidal Sanctuary',[28,145,245,50,405,200]),
 system(17,'Nereid','verdant','Research',2,9,87,'Nereid Bloom','Coral Spire',[60,158,118,68,345,180]),
 system(18,'Cetus','verdant','Frontier',3,48,132,'Cetus Blue','Drift Anchorage',[85,130,305,90,300,265]),
 system(19,'Ophir','verdant','Extraction',2,81,120,'Ophir Shoal','Pearl Exchange',[48,65,290,72,135,210]),
 system(20,'Ferrum','forge','Industrial',2,123,103,'Ferrum Anvil','Iron Throne',[145,38,250,225,260,78]),
 system(21,'Vulcanis','forge','Energy',3,155,85,'Vulcanis Magma','Crucible Station',[160,58,280,185,100,145]),
 system(22,'Styx','forge','Extraction',4,169,120,'Styx Chasm','Gate of Ash',[130,30,325,215,120,185]),
 system(23,'Kronos','forge','Fortress',3,112,133,'Kronos Bulwark','Bastion Prime',[135,95,235,245,310,125]),
];
// The Far Reach shares the same traversable jump graph, with established colonies
// and contested border systems rather than disconnected menu destinations.
const farNames=['Ardent','Caldera','Orionis','Lacuna','Nox','Waymark','Polaris','Hesper','Talassa Gate','Umbriel','Mordant','Shade','Empyrean','Corona','Daybreak','Solstice','Triton','Nacre','Undertow','Azurite','Adamant','Emberfall','Acheron','Gorgon'];
const originalSystems=[...SYSTEMS];
for(let i=0;i<24;i++){
 const base=originalSystems[i],id=i+24,name=farNames[i];
 SYSTEMS.push(system(id,name,base.factionId,base.kind,Math.min(4,base.risk+1),base.x+180,base.y,`${name} ${['Prime','Reach','Haven','Major'][i%4]}`,`${name} ${['Anchorage','Exchange','Citadel','Relay'][i%4]}`,base.prices.map((price,j)=>Math.round(price*(.88+((i+j*3)%7)*.045)))));
}
export const GOODS = [
 {name:'Food supplies',unit:'t',desc:'Staples & hydroponics',icon:'food'},
 {name:'Titanium ore',unit:'t',desc:'Raw industrial material',icon:'ore'},
 {name:'Microcircuits',unit:'t',desc:'Precision electronics',icon:'tech'},
 {name:'Medical supplies',unit:'t',desc:'Frontier essentials',icon:'med'},
 {name:'Void crystals',unit:'t',desc:'Rare reactor material',icon:'crystal'},
 {name:'Starship parts',unit:'t',desc:'Machined components',icon:'parts'},
];
export type PlanetSpec={id:string;name:string;type:'terran'|'ice'|'barren'|'gas'|'lava';x:number;y:number;radius:number;color:string;population:string;economy:string;inhabited:boolean;ring:boolean;good:number};
export function planetsFor(id:number):PlanetSpec[]{
 const s=SYSTEMS[id];const types=['terran','lava','ice','terran','barren','barren'] as const;
 return [
  {id:`world-${id}-0`,name:s.planet,type:types[FACTIONS[s.factionId].style],x:-425,y:320,radius:206,color:s.color,population:`${(1.2+id*.19).toFixed(1)} billion`,economy:s.kind,inhabited:true,ring:false,good:s.kind==='Agricultural'?0:s.kind==='Extraction'?1:2},
  {id:`world-${id}-1`,name:`${s.name} ${['Selene','Rime','Hush','Sable'][id%4]}`,type:id%2?'ice':'barren',x:700,y:-400,radius:72,color:id%2?'#9bcfe6':'#999caa',population:'18,000',economy:'Mining colony',inhabited:true,ring:false,good:1},
  {id:`world-${id}-2`,name:`${s.name} ${['Titan','Watcher','Zephyr','Tempest'][id%4]}`,type:'gas',x:-1050,y:-1000,radius:230,color:['#c59e72','#829ed1','#bb8bba','#86b8ac'][id%4],population:'Orbital platforms',economy:'Fuel harvesting',inhabited:true,ring:true,good:4},
  {id:`world-${id}-3`,name:`${s.name} ${['Vita','Bruma','Tethys','Arcadia'][id%4]}`,type:id%3===0?'terran':'ice',x:1800,y:1150,radius:150,color:id%3===0?'#79b6ab':'#aacbd9',population:'Uninhabited',economy:'Survey frontier',inhabited:false,ring:id%3===1,good:3},
  {id:`world-${id}-4`,name:`${s.name} ${['Scoria','Fumarole','Cinder','Pyre'][id%4]}`,type:'lava',x:-2150,y:1500,radius:110,color:'#de7b48',population:'Uninhabited',economy:'Volcanic deposits',inhabited:false,ring:false,good:5},
 ];
}
