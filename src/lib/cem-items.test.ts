import {describe,expect,it} from "vitest";
import {readCemPages} from "./cem-items";
const cell=(str:string,x:number,y:number)=>({str,transform:[1,0,0,1,x,y]});
const columns=[cell("Tipo",30,638),cell("Qtde",105,638),cell("Localização",262,638),cell("Área Tot. (m²)",400,638),cell("Peso Unit.",467,638),cell("Peso (kg)",527,638)];
const header=[cell("Itens da Obra",300,781),cell("08/10/2026",453,745),cell("Obra:",72,704),cell("26-0715_PROD1 - CLIENTE",101,704)];
const row=(code:string)=>[cell(code,30,410),cell("1  1057  3450",119,410),cell("Hall",262,410),cell("3,65",432,410),cell("65,331",538,410)];
const total=(n:string)=>[cell(n,118,345),cell("7,30",432,345),cell("130,662",535,345)];
describe("Itens da Obra",()=>{
  it("mantém códigos, medidas CEM e total em várias páginas",()=>{
    const data=readCemPages([[...header,...columns,...row("FIXO 1")],[...columns,...row("J15_A"),...total("2")],[]]);
    expect(data.batchNumber).toBe("26-0715_PROD1");
    expect(data.rows.map(r=>r.code)).toEqual(["FIXO 1","J15_A"]);
    expect(data.rows[0]).toMatchObject({width:1057,height:3450,weight:65.331,area:3.65});
  });
  it("recusa um relatório incompleto ou duplicado",()=>{
    expect(()=>readCemPages([[...header,...columns,...row("P1"),...total("2")]])).toThrow(/total impresso/);
    expect(()=>readCemPages([[...header,...columns,...row("P1")],[...columns,...row("P1"),...total("2")]])).toThrow(/repetidos/);
  });
});

it('separa área/local e pesos iguais concatenados em PDF CEM com quantidade um',()=>{
 const combined=[cell('P11',30,410),cell('1  4500  2500',119,410),cell('11,25GARAGEM',432,410),cell('83,51783,517',538,410)];
 const result=readCemPages([[...header,...columns,...combined,...total('1')]]);
 expect(result.rows[0]).toMatchObject({environment:'GARAGEM',area:11.25,weight:83.517,width:4500,height:2500});
});
it('não adivinha pesos concatenados divergentes',()=>{
 const bad=[cell('P11',30,410),cell('1  4500  2500',119,410),cell('11,25GARAGEM',432,410),cell('83,51782,517',538,410)];
 expect(()=>readCemPages([[...header,...columns,...bad,...total('1')]])).toThrow();
});

it.each([['28,03328',',033',28.033],['88,64088,6','40',88.640]])('recompõe peso igual fragmentado sem perder itens: %s', (raw,tail,expected)=>{
 const fragmented=[cell('BZ01',30,410),cell('1  3800  3053',119,410),cell('11,60LATERAL',432,410),cell(String(tail),491,410),cell(String(raw),538,410)];
 expect(readCemPages([[...header,...columns,...fragmented,...total('1')]]).rows[0].weight).toBe(expected);
});
it('rejeita fragmentos de peso que não coincidem',()=>{
 const bad=[cell('BZ01',30,410),cell('1  3800  3053',119,410),cell('11,60LATERAL',432,410),cell('41',491,410),cell('88,64088,6',538,410)];
 expect(()=>readCemPages([[...header,...columns,...bad,...total('1')]])).toThrow();
});
