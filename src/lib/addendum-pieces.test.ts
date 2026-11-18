import {it,expect} from 'vitest';
import {releasePlan} from './release-planning';
import {calculateReleaseProgress} from './technical-rules';
import {physicalPieces} from './addendum-pieces';
import type {TechnicalPiece} from './types';
it('counts a fulfilled principal once and retains the commercial complement separately',()=>{
 const base={id:'base',quantity:1,status:'em_prod',active_prod_batch_id:'prod',fulfilled_by_addendum_piece_id:'extra'} as TechnicalPiece;
 const extra={id:'extra',quantity:1,status:'em_prod',active_prod_batch_id:'prod',complements_piece_id:'base'} as TechnicalPiece;
 const independent={id:'new',quantity:1,status:'avaliada'} as TechnicalPiece;
 const pieces=[base,extra,independent];
 expect(physicalPieces(pieces).map(p=>p.id)).toEqual(['base','new']);
 const plan=releasePlan(pieces,'2026-11-18');
 expect(plan.reduce((sum,p)=>sum+p.units,0)).toBe(2);
 expect(plan.filter(p=>p.released&&!p.emitted)).toHaveLength(0);
 expect(calculateReleaseProgress(pieces)).toMatchObject({total:2,released:1,balance:1});
 expect(extra.active_prod_batch_id).toBe('prod');
});
