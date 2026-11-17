import {it,expect} from 'vitest';import {precontractMeasurement as check} from './precontract-measurement';
const input={contractDate:'2026-11-03',today:'2026-11-12',surveyor:'Ali',pieces:[{code:'P01',sale_width_mm:710,sale_height_mm:2109,measured_width_mm:710,measured_height_mm:2109}]};
it('usa data contratual e documenta origem sem inventar data de visita',()=>{const r=check(input);expect(r.date).toBe('2026-11-03');expect(r.basis).toContain('Ali');expect(r.basis).toContain('não informada');});
it('exige data real e responsável',()=>{expect(()=>check({...input,contractDate:null})).toThrow();expect(()=>check({...input,contractDate:'2027-01-01'})).toThrow();expect(()=>check({...input,surveyor:''})).toThrow();});
it('não substitui campo divergente nem aceita contrato sem dimensões',()=>{expect(()=>check({...input,pieces:[{...input.pieces[0],measured_width_mm:704}]})).toThrow();expect(()=>check({...input,pieces:[{...input.pieces[0],sale_width_mm:null}]})).toThrow();});
