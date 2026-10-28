import {describe,it,expect,vi,beforeEach} from 'vitest';
import {saveAlignmentAction} from './alignment-actions';
import {requirePermissionAccess} from '@/lib/server-access';
vi.mock('@/lib/server-access',()=>({requirePermissionAccess:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
const uuid='00000000-0000-4000-8000-000000000001';
const rpc=vi.fn();
const input=()=>({contractId:uuid,version:0,intent:'finish',draft:{date:'2026-10-28',time:'15:00',participants:'Comercial',summary:'',decisions:'',tasks:[]}});
beforeEach(()=>{vi.resetAllMocks();vi.mocked(requirePermissionAccess).mockResolvedValue({admin:{rpc},profile:{id:uuid,company_id:uuid},authUserId:uuid} as never);rpc.mockResolvedValue({data:{version:1,status:'completed'},error:null});});
describe('alignment server boundary',()=>{
 it('checks permission before any persistence and passes trusted identity',async()=>{expect((await saveAlignmentAction(input())).ok).toBe(true);expect(requirePermissionAccess).toHaveBeenCalledWith('technical.meetings.manage');expect(rpc).toHaveBeenCalledWith('technical_save_alignment',expect.objectContaining({p_profile:uuid,p_company:uuid,p_user:uuid,p_finish:true}));});
 it('does not write when the user lacks commercial permission',async()=>{vi.mocked(requirePermissionAccess).mockRejectedValue(new Error('Sem permissão'));expect((await saveAlignmentAction(input())).ok).toBe(false);expect(rpc).not.toHaveBeenCalled();});
 it('does not conclude actions with missing dates',async()=>{const value=input();const tasks=[{id:uuid,kind:'general',pieceIds:[],description:'Confirmar informação',owner:uuid,due:'',block:'none'}];const result=await saveAlignmentAction({...value,draft:{...value.draft,tasks}});expect(result.ok).toBe(false);expect(rpc).not.toHaveBeenCalled();});
 it('reports concurrency errors without reporting successful completion',async()=>{rpc.mockResolvedValue({data:null,error:new Error('Outra pessoa atualizou esta reunião.')});expect((await saveAlignmentAction(input())).ok).toBe(false);});
});
