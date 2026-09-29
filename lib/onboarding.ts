import {database} from './store';
export async function getOnboarding(owner:string){
 const row=await database().prepare('SELECT configuredAt,agentSeenAt FROM onboarding WHERE owner=?').bind(owner).first<{configuredAt:string|null;agentSeenAt:string|null}>();
 const previous=await database().prepare('SELECT value FROM preferences WHERE owner=?').bind(owner).first<{value:string}>();
 // Existing configured installations keep their data and do not get reset by the wizard.
 const legacy=previous?JSON.parse(previous.value).companies?.some((c:{enabled:boolean})=>c.enabled):false;
 return {configured:!!row?.configuredAt||!!legacy,configuredAt:row?.configuredAt||null,agentSeenAt:row?.agentSeenAt||null};
}
