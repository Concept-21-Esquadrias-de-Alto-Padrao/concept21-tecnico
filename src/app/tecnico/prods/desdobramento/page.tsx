import {fabricationEnvironment} from '@/lib/fabrication-environment';
import {notFound,redirect} from 'next/navigation';
import {getCurrentPermissionFlags} from '@/lib/server-access';
import {FabricationLinkPreview} from '@/components/fabrication-link-preview';
export default async function Page(){
 const environment=fabricationEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.VERCEL_ENV,process.env.FABRICATION_SETS_ENABLED);
 if(!environment)notFound();
 const access=await getCurrentPermissionFlags(['technical.prods.manage']);
 if(!access.isMaster&&!access.permissions['technical.prods.manage'])redirect('/login');
 return <FabricationLinkPreview isTest={environment==='test'}/>;
}
