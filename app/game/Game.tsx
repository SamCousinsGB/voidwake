'use client';
import { useEffect, useState, useRef } from 'react';
import { Crosshair, Orbit, Compass, Package, Radio, Shield, Volume2, VolumeX, Pause, Play, CircleHelp, ArrowUpRight, Anchor, Navigation, ScanLine, Zap, Map, Rocket, Cookie, ChevronDown, X, Minus, Plus, Fuel, Check, AlertTriangle } from 'lucide-react';
import { Universe, SYSTEMS, FACTIONS, WEAPONS, SHIPS, distance, type WeaponId, type GameState } from './engine';
import { decodeSave } from './cookies';
import SpaceView from './SpaceView';
import { GalaxyMap, StationPanel, CargoPanel, LogPanel, FlightManual } from './Panels';
import { FactionPanel,InteractionPanel } from './Interactions';
import FactionFlag from './FactionFlag';
import { GalacticNews,WorldTicker } from './LivingWorld';
import { FlightAudio } from './FlightAudio';
import { registerGameTools } from './webmcp';

type Tab = 'flight' | 'map' | 'cargo' | 'log' | 'station' | 'factions' | 'news';
const NAV = [{ id: 'flight', label: 'Flight', icon: Navigation }, { id: 'map', label: 'Galaxy', icon: Map }, { id: 'cargo', label: 'Cargo', icon: Package }, { id: 'factions', label: 'Factions', icon: Shield }, { id: 'news', label: 'Dispatches', icon: Radio }, { id: 'log', label: 'Log', icon: Compass }] as const;

export default function Game() {
  const [game] = useState(() => new Universe());
  const [, render] = useState(0);
  const refresh = () => render(v => v + 1);
  const [tab, setTab] = useState<Tab>('flight');
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [rescued, setRescued] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<GameState | null>(null);
  const uiRef = useRef({ tab, help, paused, muted });
  uiRef.current = { tab, help, paused, muted };
  const audioRef = useRef<AudioContext | null>(null);
  const flightAudio=useRef<FlightAudio | null>(null);
  const loaded = useRef(false);
  const closePanel = () => { if (game.jump !== null) setPaused(false); setTab(game.docked ? 'station' : 'flight'); };
  const closeStation = () => { game.undock(); setTab('flight'); };
  const navigate = (next: Tab) => { game.interaction=null; setContactsOpen(false); setTab(next === 'flight' && game.docked ? 'station' : next); };
  const toggleAudio = () => { if (!audioRef.current) audioRef.current = new AudioContext(); void audioRef.current.resume(); setMuted(v => !v); };

  useEffect(()=>{if(tab==='station'&&!game.docked)setTab('flight');},[tab,game.docked]);
  useEffect(() => { game.paused = paused || help || ['map', 'cargo', 'log', 'factions', 'news'].includes(tab) || !!game.interaction || rescued || !!pendingTransfer; game.keys.clear(); game.beamTrigger=0; if(game.paused){flightAudio.current?.stopBeam();game.beamSound=false;} }, [game, paused, help, tab, rescued, pendingTransfer, game.interaction]);
  useEffect(() => { if(muted){flightAudio.current?.stopBeam();game.beamSound=false;} if (loaded.current) { game.s.preferences = { muted, zoom: game.zoom }; game.save(); } }, [game, muted]);
  useEffect(() => {
    let saved = Universe.restore();
    if (window.location.hash.startsWith('#save=')) {
      try {
        const incoming = Universe.validate(decodeSave(window.location.hash.slice(6)));
        if (incoming) { if (saved && (saved.time > 10 || saved.credits !== 2400)) setPendingTransfer(incoming); else saved = incoming; }
        else game.notify('Save transfer is invalid.', 'error');
      } catch { game.notify('Save transfer is invalid.', 'error'); }
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (saved) {
      game.s = saved; game.docked = !!saved.docked; game.populate();
      if (saved.preferences) { game.zoom = saved.preferences.zoom; setMuted(saved.preferences.muted); }
      if (game.docked) setTab('station');
    }
    loaded.current = true;
    game.onChange = refresh;
    game.onDock = () => { game.interaction=null; setTab('station'); setContactsOpen(false); };
    game.onRescue = () => { setTab('station'); setRescued(true); };
    game.onRestore = () => { if (game.s.preferences) { setMuted(game.s.preferences.muted); game.zoom = game.s.preferences.zoom; } };
    game.onSound = type => {
      if(type==='phaser-stop'){flightAudio.current?.stopBeam();return;}
      const ctx=audioRef.current;if(!ctx||uiRef.current.muted)return;
      flightAudio.current??=new FlightAudio(ctx);flightAudio.current.play(type);
    };
    const armAudio = () => { if (!uiRef.current.muted) { if (!audioRef.current) audioRef.current = new AudioContext(); void audioRef.current.resume(); } };
    const down = (e: KeyboardEvent) => {
      armAudio();
      if ((e.target as HTMLElement)?.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if ((key === ' ' || key === 'enter') && (e.target as HTMLElement)?.closest('button,a,[role="button"]')) return;
      if (key === 'escape' && !e.repeat) {
        if (game.interaction) {game.interaction=null;refresh();}
        else if (uiRef.current.help) setHelp(false);
        else if (uiRef.current.tab === 'station') { game.undock(); setTab('flight'); }
        else if (uiRef.current.tab !== 'flight') setTab(game.docked ? 'station' : 'flight');
        else setPaused(v => !v);
        return;
      }
      if (key === 'm' && !e.repeat) { game.interaction=null; setTab(v => v === 'map' ? (game.docked ? 'station' : 'flight') : 'map'); return; }
      if (key === '?' && !e.repeat) { setHelp(v => !v); return; }
      if (uiRef.current.tab !== 'flight' || uiRef.current.help || uiRef.current.paused || game.interaction) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(key)) { e.preventDefault(); game.keys.add(key); }
      if (e.repeat) return;
      if (key === 't') game.cycle();
      if (key === 'h') game.hail();
      if (['1','2','3','4','5'].includes(key)) game.setWeapon((Object.keys(WEAPONS) as WeaponId[])[Number(key)-1]);
      if (key === 'e') game.dock();
    };
    const up = (e: KeyboardEvent) => game.keys.delete(e.key.toLowerCase());
    const blur = () => {game.keys.clear();game.beamTrigger=0;flightAudio.current?.stopBeam();game.beamSound=false;};
    const persist = () => { game.s.preferences = { muted: uiRef.current.muted, zoom: game.zoom }; game.save(); };
    const visibility = () => { if (document.hidden) { persist(); game.keys.clear(); setPaused(true); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    window.addEventListener('pointerdown', armAudio);
    window.addEventListener('pagehide', persist); document.addEventListener('visibilitychange', visibility);
    const save = setInterval(persist, 5000); const unregister = registerGameTools(game, refresh);
    persist();
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      window.removeEventListener('pointerdown', armAudio);
      window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', visibility);
      clearInterval(save); unregister(); persist();flightAudio.current?.stopBeam();
    };
  }, [game]);

  const s = game.s, sys = SYSTEMS[s.system], stats = game.stats, selected = game.selected;
  const speed = Math.round(Math.hypot(s.vx, s.vy));
  const hostiles = game.contacts.filter(c => game.isHostile(c));
  const inFlight = tab === 'flight' && !help && !rescued && !game.interaction;
  const saveBlocked = game.saveStatus === 'blocked';
  const targetAction = () => {
    if (!selected) return;
    if (game.isHostile(selected)) {game.fire();if(s.weapon==='phaser')game.beamTrigger=.25;}
    else if (selected.id === 'station') {if(game.dockingAllowed)game.dock();else game.hail();}
    else if (selected.kind !== 'salvage') game.hail();
    else { game.waypoint = { x: selected.x, y: selected.y }; game.autoDock = false; }
  };

  return <main className={`game-shell ${!inFlight ? 'has-workspace' : ''}`}>
    <section className="universe"><SpaceView game={game} onTick={refresh}/><div className="space-vignette"/></section>
    <header className="topbar">
      <a className="brand" href="#" aria-label="Voidwake flight deck" onClick={e => { e.preventDefault(); navigate('flight'); }}><Orbit size={27}/><span>VOIDWAKE</span></a>
      <nav aria-label="Game navigation">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id || (id === 'flight' && tab === 'station') ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={16}/><span>{label}</span></button>)}</nav>
      <div className="top-wallet"><span className="credit-symbol">◈</span><strong>{s.credits.toLocaleString()}<small>cr</small></strong><span className="wallet-divider"/><Fuel size={15}/><span>{Math.floor(s.fuel)}<small>/100</small></span></div>
      <div className="top-actions"><button aria-label={saveBlocked ? 'Cookies blocked: view save options' : 'Saved in cookies: view save options'} title={saveBlocked ? 'Cookies blocked — progress is not saved' : 'Cookie save'} className={saveBlocked ? 'save-blocked' : 'save-indicator'} onClick={() => navigate('log')}>{saveBlocked ? <AlertTriangle size={17}/> : <Cookie size={17}/>}</button><button aria-label={muted ? 'Enable sound' : 'Mute sound'} title={muted ? 'Enable sound' : 'Mute sound'} onClick={toggleAudio}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button><button aria-label={paused ? 'Resume game' : 'Pause game'} title={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(v => !v)}>{paused ? <Play size={17}/> : <Pause size={17}/>}</button><button aria-label="Controls" title="Controls" onClick={() => setHelp(true)}><CircleHelp size={17}/></button></div>
    </header>

    {inFlight && <>
      <div className="system-heading"><span className="system-coordinate">{String(s.system + 1).padStart(2, '0')} <i/> {sys.region}</span><h1>{sys.name}<span className={`security-dot risk-${sys.risk}`}/></h1><div><FactionFlag faction={game.faction}/><span>{FACTIONS[game.faction].name}</span><span className={`security-text risk-${game.alert||game.standing()<0?4:sys.risk}`}>{game.standing()<0?'Hostile territory':game.alert?'Security alert':sys.security}</span></div></div>
      <WorldTicker game={game} open={()=>navigate('news')}/><div className="side-tools"><button className={contactsOpen ? 'selected' : ''} aria-label="Local contacts" title="Contacts" aria-expanded={contactsOpen} onClick={() => setContactsOpen(v => !v)}><ScanLine size={19}/>{hostiles.length > 0 && <i/>}</button><button aria-label="Dock at station" title="Dock · E" onClick={() => game.dock()}><Anchor size={19}/></button><div className="tool-separator"/><button aria-label="Zoom in" title="Zoom in" onClick={() => game.zoom = Math.min(1.8, game.zoom + .15)}><Plus size={17}/></button><button aria-label="Zoom out" title="Zoom out" onClick={() => game.zoom = Math.max(.5, game.zoom - .15)}><Minus size={17}/></button></div>
      {contactsOpen && <aside className="contacts-drawer"><div className="section-title"><span>Contacts <small>{game.contacts.length}</small></span><button aria-label="Close contacts" onClick={() => setContactsOpen(false)}><X size={17}/></button></div>{game.contacts.map(c => <button key={c.id} className={`contact ${game.target === c.id ? 'selected' : ''} ${c.kind}`} onClick={() => { game.target = c.id; if(c.kind==='planet')game.hail(c.id); refresh(); }}><span className="contact-icon">{c.kind === 'station' ? <Orbit size={20}/> : c.kind === 'hostile' ? <Crosshair size={18}/> : c.kind === 'salvage' ? <Package size={18}/> : <Navigation size={18}/>}</span><span><strong>{c.name}</strong><small>{game.isHostile(c) ? (c.kind==='hostile'?'Outlaw':'Hostile security') : c.role==='invader'?'Assault fleet':c.role==='battery'?'Planetary defence':c.role==='convoy'?'Relief convoy':c.kind==='planet'?'Planet' : c.kind === 'station' ? 'Station' : c.kind === 'salvage' ? 'Salvage' : c.kind === 'patrol' ? 'Patrol' : 'Trader'}</small></span><em>{(distance(c, s) / 1000).toFixed(1)} <small>km</small></em></button>)}</aside>}
      {selected && <aside className={`target-lock ${game.isHostile(selected)?'hostile':selected.kind}`}>
       <div className="lock-heading"><Crosshair size={14}/><span>{game.isHostile(selected)?'HOSTILE':selected.kind.toUpperCase()}</span><strong>{(distance(selected,s)/1000).toFixed(2)}<small>km</small></strong></div><h2>{selected.name}</h2>
       {selected.ship&&<div className="target-class">{SHIPS[selected.ship].name} class {selected.faction&&<FactionFlag faction={selected.faction}/>}</div>}
       {game.attackable(selected)&&<div className="target-hull"><i style={{width:`${selected.hull/selected.maxHull*100}%`}}/></div>}
       <button className={game.isHostile(selected)?'danger':'primary'} onPointerDown={e=>{if(game.isHostile(selected)){e.currentTarget.setPointerCapture(e.pointerId);game.keys.add('fire');}}} onPointerUp={()=>game.keys.delete('fire')} onPointerCancel={()=>game.keys.delete('fire')} onClick={targetAction}>{game.isHostile(selected)?<Crosshair size={15}/>:selected.id==='station'?<Anchor size={15}/>:<Radio size={15}/>} {game.isHostile(selected)?'Fire '+game.weapon.short:selected.id==='station'?(game.dockingAllowed?'Approach & dock':'Request clearance'):selected.kind==='salvage'?'Recover':'Hail'}<kbd>{game.isHostile(selected)?'SPACE':selected.id==='station'?'E':'H'}</kbd></button>
       {selected.kind!=='salvage'&&<button className="target-comms" onClick={()=>game.hail()}><Radio size={13}/>Open channel</button>}
      </aside>}
      {(game.alert||game.standing()<0)&&<button className="security-alert" onClick={()=>game.hail('station')}><Shield size={16}/>{game.standing()<0?'FACTION HOSTILE':'SECURITY RESPONSE'}<span>Standing {game.standing()} · {game.s.incidents?.[s.system]?.fine??0} cr fine</span></button>}
      <div className="weapons-rack" aria-label="Weapon selection">{(Object.entries(WEAPONS) as [WeaponId,typeof WEAPONS.phaser][]).map(([id,w])=><button key={id} style={{'--weapon-color':w.color} as React.CSSProperties} className={s.weapon===id?'selected':''} aria-pressed={s.weapon===id} title={w.description+' · '+w.energy+' energy · '+w.range+' m'} disabled={id==='antimatter'&&(!s.equipment?.antimatter||!s.equipment.ammo||SHIPS[s.ship].tier<2)} onClick={()=>game.setWeapon(id)}><kbd>{w.key}</kbd><span>{w.short}</span><small>{id==='antimatter'?s.equipment?.antimatter?(s.equipment.ammo+' loaded'):'Locked':w.energy+(id==='phaser'?' E/s':' E')}</small></button>)}</div>
      {!!s.equipment?.pointDefense&&<div className="pd-status"><Shield size={13}/>{SHIPS[s.ship].tier>=2||['freighter','anvil','aureole'].includes(s.ship)?'PD '+s.equipment.pointDefense+' online':'PD incompatible'}<span>{game.interceptions} intercepted</span></div>}<div className="radar-hud"><svg viewBox="0 0 180 180" role="img" aria-label="Local radar"><defs><clipPath id="radar-clip"><circle cx="90" cy="90" r="75"/></clipPath></defs><g fill="none" stroke="currentColor" strokeWidth=".6"><circle cx="90" cy="90" r="75"/><circle cx="90" cy="90" r="50"/><circle cx="90" cy="90" r="25"/><path d="M15 90h150M90 15v150"/></g><g clipPath="url(#radar-clip)">{game.contacts.map(c => <circle key={c.id} cx={90 + (c.x - s.x) / 22} cy={90 - (c.y - s.y) / 22} r={c.kind === 'station' ? 3 : 2} fill={game.isHostile(c) ? '#e88c79' : c.kind === 'station' ? '#8fd5bd' : '#8aafcc'}/>)}</g><path d="m90 85 4 10-4-2-4 2Z" fill="#d8eff7" transform={`rotate(${-s.angle * 180 / Math.PI} 90 90)`}/></svg><span>{Math.round(s.x)} / {Math.round(s.y)}</span></div>
      <div className="cockpit"><div className="vessel-block"><Rocket size={24}/><div><strong>{stats.name}</strong><span>{stats.role}</span></div></div><div className="cockpit-meters">{[{ name: 'Hull', value: s.hull, max: stats.hull, style: 'hull' }, { name: 'Shield', value: s.shield, max: stats.shield, style: 'shield' }, { name: 'Energy', value: s.energy, max: 100, style: 'energy' }].map(m => <div className={`meter ${m.style}`} key={m.name}><div><span>{m.name}</span><strong>{Math.round(m.value / m.max * 100)}<small>%</small></strong></div><div className="bar"><i style={{ width: `${Math.max(0, m.value / m.max * 100)}%` }}/></div></div>)}</div><div className="velocity"><strong>{speed}<small>m/s</small></strong><span>{game.waypoint ? 'AUTOPILOT' : game.keys.has('shift') && speed > stats.speed ? 'BOOST' : 'IMPULSE'}</span></div><button className="cargo-chip" title="Cargo" onClick={() => navigate('cargo')}><Package size={16}/><span>{game.usedCargo}<small>/{stats.cargo} t</small></span></button></div>
      <div className="flight-shortcuts"><span><kbd>W A S D</kbd> Fly</span><span><kbd>SPACE</kbd> Fire</span><span><kbd>T</kbd> Target</span><span><kbd>H</kbd> Hail</span><span><kbd>SHIFT</kbd> Boost</span></div>
      <div className="touch-controls">{[['a', '↶'], ['w', '↑'], ['d', '↷'], ['s', '↓'], ['fire', '◎']].map(([key, label]) => <button key={key} aria-label={key === 'fire' ? 'Fire weapons' : key === 'w' ? 'Thrust' : key === 's' ? 'Brake' : key === 'a' ? 'Turn left' : 'Turn right'} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); game.keys.add(key); }} onPointerUp={() => game.keys.delete(key)} onPointerCancel={() => game.keys.delete(key)}>{label}</button>)}</div>
    </>}

    {game.interaction&&<InteractionPanel game={game} close={()=>{game.interaction=null;refresh();}}/>}
    {tab === 'news'&&<GalacticNews game={game} close={closePanel}/>}
    {tab === 'factions'&&<FactionPanel game={game} close={closePanel}/>}
    {tab === 'map' && <GalaxyMap game={game} close={closePanel}/>}
    {tab === 'station' && game.docked && <StationPanel game={game} close={closeStation}/>}
    {tab === 'cargo' && <CargoPanel game={game} close={closePanel}/>}
    {tab === 'log' && <LogPanel game={game} close={closePanel}/>}
    {help && <FlightManual game={game} close={() => setHelp(false)}/>}
    {paused && inFlight && <div className="center-overlay"><Pause size={26}/><h2>Paused</h2><button className="primary" onClick={() => setPaused(false)}><Play size={15}/> Resume</button></div>}
    {rescued && <div className="center-overlay rescue"><Shield size={30}/><h2>Recovered at station</h2><p>Cargo lost · 10% recovery fee</p><button className="primary" onClick={() => setRescued(false)}>Continue</button></div>}
    {pendingTransfer && <div className="center-overlay rescue" role="dialog" aria-modal="true" aria-label="Import saved voyage"><Cookie size={28}/><h2>Import this voyage?</h2><p>{SYSTEMS[pendingTransfer.system].name} · {pendingTransfer.credits.toLocaleString()} cr</p><p>This replaces the voyage saved here.</p><button className="primary" onClick={() => { game.s = pendingTransfer; game.docked = !!pendingTransfer.docked; game.waypoint = null; game.jump = null; game.autoDock = false; game.populate(); game.onRestore(); game.save(); setPendingTransfer(null); setPaused(false); setTab(game.docked ? 'station' : 'flight'); }}>Import</button><button className="secondary" onClick={() => setPendingTransfer(null)}>Keep current voyage</button></div>}
    {game.jump !== null && <div className="jump-overlay"><div className="jump-lines"/><span>JUMPING TO</span><h2>{SYSTEMS[game.jump].name}</h2><strong>{Math.ceil(game.jumpTime)}</strong></div>}
    {game.messageTime > 0 && game.message && <div className={`transmission ${game.toastKind}`} role="status">{game.toastKind === 'error' ? <AlertTriangle size={15}/> : <Check size={15}/>}<span>{game.message}</span></div>}
    {saveBlocked && <button className="cookie-alert" onClick={() => navigate('log')}><AlertTriangle size={14}/> Cookies blocked · save unavailable</button>}
  </main>;
}
