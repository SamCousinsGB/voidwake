import { FACTIONS,type FactionId } from './world.ts';
import type { Contact } from './engine.ts';
const names=[['Amara Okonkwo','Ren Takeda'],['Mara Solano','Rook Calder'],['Veyra Senn','Khar Vos'],['Auriel Sen','Kaelis Or'],['Neris Thal','Oru Venn'],['Drazh Korr','Unit IX-7']];
const races=[['Human','Human'],['Human','Augmented human'],['Ashen','Ashen'],['Solari','Solari'],['Pelagic','Pelagic'],['Ferrite','Synthetic']];
export function captainFor(contact:Pick<Contact,'id'|'faction'|'kind'>,fallback:FactionId){
 const faction=contact.faction??(contact.kind==='hostile'?'syndicate':fallback);let hash=0;for(const ch of contact.id)hash=(hash*31+ch.charCodeAt(0))>>>0;const variant=hash%2,index=FACTIONS[faction].style*2+variant;
 return {index,faction,name:names[FACTIONS[faction].style][variant],race:races[FACTIONS[faction].style][variant],column:index%4,row:Math.floor(index/4)};
}
