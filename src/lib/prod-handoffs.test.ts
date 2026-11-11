import {describe,it,expect} from 'vitest';
import {documentManifest,latestDepartmentDelivery,deliveryLabel} from './prod-handoffs';
import {receiptDueAt} from './commercial-receipt';
import type {TechnicalDepartmentDelivery} from './types';
describe('repasses de documentos',()=>{
 it('preserva seleção e referência sem inventar documentos',()=>expect(documentManifest('suprimentos',['Perfis da obra','Perfis da obra'],'RV01')).toBe('Documentos enviados: Perfis da obra\nRV01'));
 it('recusa documento de outro setor',()=>expect(()=>documentManifest('producao',['Vidros'],null)).toThrow());
 it('não considera aceite anterior como aceite de novo envio',()=>{
 const rows=[{id:'1',department:'suprimentos',delivered_at:'2026-11-05T10:00:00Z',status:'confirmado'},{id:'2',department:'suprimentos',delivered_at:'2026-11-06T10:00:00Z',status:'entregue'}] as TechnicalDepartmentDelivery[];
 expect(deliveryLabel(latestDepartmentDelivery(rows,'suprimentos'))).toBe('Aguardando recebimento');expect(deliveryLabel(latestDepartmentDelivery(rows,'producao'))).toBe('Não enviado');
 });
 it('vence no próximo dia útil às 17h30, pulando feriado e fim de semana',()=>expect(receiptDueAt(new Date('2026-10-09T16:00:00-03:00'),['2026-10-12'])).toBe('2026-10-13T17:30:00-03:00'));
});
