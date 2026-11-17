import {it,expect} from 'vitest';
import {validateSetDraft,validateFabricationReport} from './fabrication-set-validation';
import {initialSet,fabricationItems} from './fabrication-link-preview';
const report={contractNumber:'26-0651',batchNumber:'26-0651_PROD4-MADEIRA',issued:'16/11/2026',rows:fabricationItems.map(r=>({...r,quantity:1,area:1,weight:1}))};
it('aceita seis recortes e duas peças sem presumir cobertura',()=>{expect(validateSetDraft(initialSet).coverage).toBe('');expect(()=>validateFabricationReport(report,initialSet)).not.toThrow();});
it('recusa relatório de outro contrato ou outra PROD',()=>{expect(()=>validateFabricationReport({...report,contractNumber:'26-0836'},initialSet)).toThrow();expect(()=>validateFabricationReport({...report,batchNumber:'26-0651_PROD1-JAN'},initialSet)).toThrow();});
it('recusa item duplicado, ausente ou medida inválida',()=>{expect(()=>validateFabricationReport({...report,rows:[...report.rows.slice(1),report.rows[1]]},initialSet)).toThrow();expect(()=>validateFabricationReport({...report,rows:report.rows.slice(1)},initialSet)).toThrow();expect(()=>validateFabricationReport({...report,rows:report.rows.map(r=>({...r,width:0}))},initialSet)).toThrow();});
it('não aceita peças individuais no grupo nem parcial sem descrição',()=>{expect(()=>validateSetDraft({...initialSet,contractCodes:['P01']})).toThrow();expect(()=>validateSetDraft({...initialSet,coverage:'partial'})).toThrow();});
it('recusa corpo malformado',()=>{expect(()=>validateSetDraft(null)).toThrow();expect(()=>validateSetDraft({...initialSet,contractCodes:'RIP 01'})).toThrow();});
