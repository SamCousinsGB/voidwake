import { FACTIONS,type FactionId } from './world';
import type { Contact } from './engine';
import { captainFor } from './captains';
export default function CaptainPortrait({contact,faction}:{contact:Contact;faction:FactionId}){
 const captain=captainFor(contact,faction);
 return <div className="captain-channel"><div className="captain-avatar" role="img" aria-label={`${captain.name}, ${captain.race} captain`} style={{backgroundImage:'url(./assets/captains.png)',backgroundPosition:`${captain.column/3*100}% ${captain.row/2*100}%`}}><span>LIVE</span></div><div className="captain-identity"><span>{contact.kind==='station'?'COMMAND CHANNEL':contact.kind==='planet'?'SURFACE LIAISON':'CAPTAIN'}</span><h3>{captain.name}</h3><p>{captain.race} · {contact.kind==='hostile'?'Unaligned':FACTIONS[captain.faction].name}</p><div className="signal-bars">{[4,7,13,9,17,24,12,8,20,15,7,13,5,16,11].map((h,i)=><i key={i} style={{height:h,animationDelay:`${i*.08}s`}}/>)}</div></div></div>;
}
