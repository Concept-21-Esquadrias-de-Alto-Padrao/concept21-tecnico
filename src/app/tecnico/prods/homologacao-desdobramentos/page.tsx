import {notFound,redirect} from 'next/navigation';
import {fabricationEnvironment} from '@/lib/fabrication-environment';
import {getCurrentPermissionFlags} from '@/lib/server-access';
import {SplitRehearsal} from '@/components/split-rehearsal';
export default async function Page(){
 if(fabricationEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.VERCEL_ENV,undefined)!=='test')notFound();
 const access=await getCurrentPermissionFlags(['technical.prods.manage']);
 if(!access.isMaster&&!access.permissions['technical.prods.manage'])redirect('/login');
 return <SplitRehearsal/>;
}
