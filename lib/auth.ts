import {headers} from 'next/headers';
export async function getCurrentUser(){
 // Production fails closed. Replace with verified session/JWT authentication
 // before hosting; never trust a client-supplied user-id header in production.
 if(!import.meta.env.DEV)return null;
 const h=await headers();
 return h.get('x-applydesk-local-user')==='local-user'?{userId:'local-user'}:null;
}
