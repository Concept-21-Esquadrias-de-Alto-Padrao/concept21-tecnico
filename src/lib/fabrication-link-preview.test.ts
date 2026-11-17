import {it,expect} from 'vitest';
import {initialSet,setIssues,coverageIssues} from './fabrication-link-preview';
it('agrupa cinco itens vendidos em seis recortes com origens aprovadas',()=>{expect(initialSet.contractCodes).toHaveLength(5);expect(initialSet.fabricationCodes).toHaveLength(6);expect(setIssues(initialSet)).toEqual([]);});
it('não presume atendimento completo',()=>expect(coverageIssues(initialSet)).toContain('Informe se o detalhamento do conjunto está completo ou parcial.'));
it('exige explicação de saldo no parcial',()=>{expect(coverageIssues({...initialSet,coverage:'partial'})).toContain('Descreva o que falta detalhar no conjunto.');expect(coverageIssues({...initialSet,coverage:'partial',pending:'Falta lateral do portão'})).toEqual([]);});
it('impede misturar P01 e P11 ou duplicar recortes',()=>{expect(setIssues({...initialSet,contractCodes:['P01']})).not.toEqual([]);expect(setIssues({...initialSet,fabricationCodes:['RIP 01','RIP 01']})).not.toEqual([]);});
