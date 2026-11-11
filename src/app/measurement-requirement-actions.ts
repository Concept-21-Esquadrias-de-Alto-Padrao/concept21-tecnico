"use server";
import {revalidatePath} from "next/cache";
import {requirePermissionAccess} from "@/lib/server-access";
import type {ActionState} from "@/components/action-form";
export async function saveMeasurementRequirement(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const {admin,profile,authUserId}=await requirePermissionAccess("technical.measurements.manage");
    const {data:piece,error:readError}=await admin.from("technical_contract_pieces").select("released_at").eq("company_id",profile.company_id).eq("id",String(form.get("piece_id"))).maybeSingle();
    if(readError) throw readError;
    if(!piece) throw new Error("Peça não encontrada.");
    if(piece.released_at) await requirePermissionAccess("technical.pieces.edit_released");
    const {error}=await admin.rpc("technical_set_measurement_requirement", {
      co:profile.company_id, pid:String(form.get("piece_id")), actor:authUserId,
      exempt:form.get("measurement_not_required")==="on",
      basis:String(form.get("measurement_basis")||""),
      related:nullif(String(form.get("related_piece_id")||""))
    });
    if(error) throw error;
    revalidatePath("/tecnico/contratos/"+String(form.get("contract_id")));
    revalidatePath("/tecnico/prods"); revalidatePath("/tecnico");
    return {ok:true,message:"Necessidade de medição e vínculo atualizados. Medidas existentes preservadas."};
  } catch(error) {return {ok:false,message:error instanceof Error?error.message:"Não foi possível salvar."};}
}
function nullif(value:string){return value||null;}
