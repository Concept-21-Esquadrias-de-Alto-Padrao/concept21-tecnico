import {describe,it,expect} from "vitest";
import {fieldMeasurementProblem} from "./measurement-requirement";
import {canReleasePiece,canAddPieceToProd} from "./technical-rules";
describe("itens sem medição individual",()=>{
 const piece={measurement_not_required:true,project_only:false,measured_width_mm:null,measured_height_mm:null,released_at:"2026-10-19",cem_registered:true,cem_checked:true,status:"liberada" as const};
 it("permite complemento definido sem inventar medida",()=>{expect(fieldMeasurementProblem(piece)).toBeNull();expect(canAddPieceToProd({piece,corrections:[]}).ok).toBe(true);expect(canReleasePiece({piece,corrections:[]}).ok).toBe(true);});
 it("mantém bloqueio de projeto ainda indefinido",()=>{expect(fieldMeasurementProblem({...piece,measurement_not_required:false,project_only:true})).toContain("Projeto pendente");});
 it("dispensa não equivale a liberação",()=>{expect(canAddPieceToProd({piece:{...piece,released_at:null},corrections:[]}).ok).toBe(false);});
 it("preserva bloqueios, cancelamento e vínculo ativo",()=>{expect(canAddPieceToProd({piece,corrections:[{blocking:true,status:"aberta"}]}).ok).toBe(false);expect(canAddPieceToProd({piece,activeProdBatchId:"outra",corrections:[]}).ok).toBe(false);expect(canAddPieceToProd({piece:{...piece,status:"cancelada"},corrections:[]}).ok).toBe(false);});
});
