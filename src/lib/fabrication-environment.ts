// Official activation is explicit; previews never write to the official database.
export function fabricationEnvironment(url:string|undefined, deployment:string|undefined, enabled:string|undefined):'test'|'official'|null {
 let host:string;try{host=new URL(url??'').hostname;}catch{return null;}
 if(host==='rnuanogfbhhphnnqxugf.supabase.co'&&deployment!=='production')return 'test';
 if(host==='jothuhbhlnazyobobtnn.supabase.co'&&deployment==='production'&&enabled==='true')return 'official';
 return null;
}
