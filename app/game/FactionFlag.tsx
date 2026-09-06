import { FACTIONS, type FactionId } from './world';
export default function FactionFlag({faction,large=false}:{faction:FactionId;large?:boolean}){
 const f=FACTIONS[faction];
 return <svg className={`faction-flag ${large?'large':''}`} viewBox="0 0 64 40" role="img" aria-label={`${f.name} flag`}><rect width="64" height="40" rx="3" fill={f.dark}/><path d="M0 0h18L64 32v8H47L0 8Z" fill={f.secondary} opacity=".7"/><g transform="translate(32 20)" stroke={f.color} fill="none" strokeWidth="1.6">
 {f.symbol==='star'?<><circle r="12"/><path d="m0-11 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill={f.color} stroke="none"/></>:f.symbol==='compass'?<><path d="m0-14 6 9 10 5-10 5-6 9-6-9-10-5 10-5Z"/><path d="M-8 0H8M0-8V8"/><circle r="3"/></>:f.symbol==='chevron'?<><path d="m-16-8 16 9 16-9-8 16-8-4-8 4Z" fill={f.color}/><path d="m-6-11 6 3 6-3"/></>:f.symbol==='sun'?<><circle r="7"/><circle r="11" strokeWidth=".6"/>{Array.from({length:8},(_,i)=><path key={i} d="M0-12v-4" transform={`rotate(${i*45})`}/>)}</>:f.symbol==='wave'?<><path d="M-16-1Q-8-12 0-1T16-1M-16 6Q-8-5 0 6T16 6M-9-9Q0-19 9-9"/><circle r="2" cy="-5" fill={f.color}/></>:<><path d="M-15-10h30L8-2H3v7l7 7h-20l7-7v-7h-5Z" fill={f.color}/><path d="M-18-13h36"/></>}
 </g><path d="M1 1h62v38H1Z" fill="none" stroke={f.color} opacity=".2"/></svg>;
}
