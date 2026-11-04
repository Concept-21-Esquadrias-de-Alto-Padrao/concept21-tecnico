import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type CemItem = {code:string; quantity:number; width:number; height:number; environment:string; area:number; weight:number};
type Cell = {str:string; transform:number[]};
const decimal = (value:string) => /^\d+(?:,\d+)?$/.test(value) ? Number(value.replace(",", ".")) : NaN;

export function readCemPages(pages: Cell[][]) {
  const rows:CemItem[] = [];
  let header = "", issued = "", total:number|undefined;
  const first = pages[0] ?? [];
  if (!first.some(c=>c.str.trim()==="Itens da Obra")) throw new Error("Selecione o relatório Itens da Obra do CEM.");
  const label = first.find(c=>c.str.trim()==="Obra:");
  if (label) header = first.filter(c=>Math.abs(c.transform[5]-label.transform[5])<2 && c.transform[4]>label.transform[4]+10)
    .sort((a,b)=>a.transform[4]-b.transform[4]).map(c=>c.str).join("").trim();
  const match = header.match(/^(\d{2,4}-\d{3,5})(?=[\s_-]|$)/);
  if (!match || /\bCOMPRA\b/i.test(header)) throw new Error("O cabeçalho não identifica uma obra de fabricação válida.");
  const order = header.split(/\s+-\s+/)[0].trim();
  issued = first.map(c=>c.str.trim()).find(s=>/^\d{2}\/\d{2}\/\d{4}$/.test(s)) ?? "";
  if (!issued) throw new Error("Data de emissão não identificada.");
  for (const cells of pages) {
    if (!cells.some(c=>c.str.trim())) continue;
    const x = (name:string) => cells.find(c=>c.str.trim()===name)?.transform[4];
    const type=x("Tipo"), qty=x("Qtde"), location=x("Localização"), area=x("Área Tot. (m²)"), weight=x("Peso (kg)");
    if ([type,qty,location,area,weight].some(v=>v===undefined)) throw new Error("Layout de colunas não reconhecido em uma página.");
    const lines = new Map<number,Cell[]>();
    for (const c of cells) { const y=Math.round(c.transform[5]); const line=lines.get(y) ?? []; line.push(c); lines.set(y,line); }
    for (const line of lines.values()) {
      line.sort((a,b)=>a.transform[4]-b.transform[4]);
      const column=(a:number,b:number)=>line.filter(c=>c.transform[4]>=a && c.transform[4]<b).map(c=>c.str.trim()).join(" ").trim();
      const code=column(type!-3,qty!-10);
      const dims=column(qty!-10,location!-3);
      const kg=decimal(column(weight!-4,Infinity));
      if (!Number.isFinite(kg)) continue;
      if (!code && /^\d+$/.test(dims)) {total=Number(dims);continue;}
      const numbers=dims.match(/^(\d+)\s+(\d+)\s+(\d+)(?:\s+\d+)*$/);
      const sqm=decimal(column(area!-4,(x("Peso Unit.") ?? weight!)-4));
      if (!code || !numbers || !Number.isFinite(sqm)) throw new Error("Linha de peça incompleta. Confira o modelo do relatório.");
      const [,q,w,h]=numbers.map(Number);
      if (!(q>0 && w>0 && h>0)) throw new Error("Quantidade ou dimensão inválida.");
      rows.push({code,quantity:q,width:w,height:h,environment:column(location!-3,area!-4),area:sqm,weight:kg});
    }
  }
  if (!rows.length || total!==rows.reduce((sum,r)=>sum+r.quantity,0)) throw new Error("A soma das peças lidas não confere com o total impresso. Importação interrompida.");
  if (new Set(rows.map(r=>r.code.toUpperCase())).size!==rows.length) throw new Error("Há códigos repetidos no relatório. Confira o desdobramento antes de importar.");
  return {contractNumber:match[1],batchNumber:/PROD[\s_-]*\d+/i.test(order)?order:"",issued,rows};
}

export async function readCemPdf(buffer:Buffer) {
  const pages:Cell[][]=[];
  // PDF.js expects slice() to copy bytes; Node Buffer.slice() shares its backing memory.
  const pdf=await pdfParse(Uint8Array.from(buffer),{pagerender:async page=>{pages.push((await page.getTextContent()).items);return "";}});
  if(pages.length!==pdf.numpages) throw new Error("Não foi possível ler todas as páginas do PDF.");
  return readCemPages(pages);
}
