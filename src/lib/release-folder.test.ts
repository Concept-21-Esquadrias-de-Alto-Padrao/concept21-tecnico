import {describe,it,expect} from 'vitest';
import {releaseFolderDeadlines} from './release-folder';
describe('repasse da pasta por lote',()=>{
 it('liberação inicia somente o envio, não emissão',()=>{const d=releaseFolderDeadlines({release_date:'2026-11-05',folder_handoff:null});expect(d.sendDue).toBe('2026-11-10');expect(d.issueDue).toBeNull();expect(d.status).toBe('pending');});
 it('envio não inicia prazo do Igor',()=>{expect(releaseFolderDeadlines({release_date:'2026-11-05',folder_handoff:{sent_date:'2026-11-06',sent_by:'a',sent_recorded_at:'x',recipient:'i'}}).issueDue).toBeNull();});
 it('recebimento inicia cinco dias úteis e considera feriado',()=>{const h={sent_date:'2026-11-06',sent_by:'a',sent_recorded_at:'x',recipient:'i',received_date:'2026-11-09'};expect(releaseFolderDeadlines({release_date:'2026-11-05',folder_handoff:h},[{date:'2026-11-10'}]).issueDue).toBe('2026-11-17');});
 it('lotes diferentes preservam prazos diferentes',()=>{const base={sent_date:'2026-11-05',sent_by:'a',sent_recorded_at:'x',recipient:'i'};const one=releaseFolderDeadlines({release_date:'2026-11-05',folder_handoff:{...base,received_date:'2026-11-05'}});const two=releaseFolderDeadlines({release_date:'2026-11-05',folder_handoff:{...base,received_date:'2026-11-06'}});expect(one.issueDue).toBe('2026-11-12');expect(two.issueDue).toBe('2026-11-13');});
});
