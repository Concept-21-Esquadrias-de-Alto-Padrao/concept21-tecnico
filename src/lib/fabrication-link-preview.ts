export const contractItems = [
 {code:'P01',environment:'Hall',sale:'1180 × 2800',field:'1220 × 2821',project:false},
 {code:'P11',environment:'Portão · ambiente não informado',sale:'5000 × 2300',field:null,project:true},
 {code:'RIP 01',environment:'Acima P1',sale:'1180 × 200',field:null,project:true},
 {code:'RIP 02',environment:'Lateral P01',sale:'3180 × 3000',field:null,project:true},
 {code:'RIP 03',environment:'Lateral',sale:'500 × 3000',field:null,project:true},
 {code:'RIP 04',environment:'Lateral portão',sale:'510 × 3000',field:null,project:true},
 {code:'RIP 05',environment:'Acima portão',sale:'5000 × 700',field:null,project:true},
];
export const fabricationItems = [
 {code:'P11',environment:'Garagem',width:4500,height:2500},
 {code:'P01',environment:'Hall',width:1214,height:2817},
 {code:'RIP 03',environment:'Lateral',width:100,height:3290},
 {code:'RIP 04',environment:'Acima da P01',width:1221,height:510},
 {code:'RIP 05',environment:'Lateral da P01',width:3138,height:3290},
 {code:'RIP 06',environment:'Parede lateral',width:530,height:3290},
 {code:'RIP 07',environment:'Parede lateral',width:500,height:3290},
 {code:'RIP 08',environment:'Acima do P11',width:4910,height:890},
];
export const approvedLinks = [
 {contractCode:'RIP 01',fabricationCode:'RIP 04'},
 {contractCode:'RIP 02',fabricationCode:'RIP 05'},
 {contractCode:'RIP 02',fabricationCode:'RIP 03'},
 {contractCode:'RIP 03',fabricationCode:'RIP 07'},
 {contractCode:'RIP 04',fabricationCode:'RIP 06'},
 {contractCode:'RIP 05',fabricationCode:'RIP 08'},
];
export type SetDraft={links:typeof approvedLinks;name:string;contractCodes:string[];fabricationCodes:string[];coverage:''|'total'|'partial';pending:string;projectReference:string};
export const initialSet:SetDraft={links:approvedLinks,name:'Ripados · Rafael / MADEIRA',contractCodes:contractItems.filter(i=>i.code.startsWith('RIP')).map(i=>i.code),fabricationCodes:fabricationItems.filter(i=>i.code.startsWith('RIP')).map(i=>i.code),coverage:'',pending:'',projectReference:''};
export function setIssues(d:SetDraft){const issues:string[]=[];
 if(!d.name.trim())issues.push('Informe o nome do conjunto.');
 if(!d.contractCodes.length)issues.push('Selecione os itens contratados do conjunto.');
 if(!d.fabricationCodes.length)issues.push('Selecione os recortes de fabricação.');
 if(new Set(d.contractCodes).size!==d.contractCodes.length||new Set(d.fabricationCodes).size!==d.fabricationCodes.length)issues.push('Há itens repetidos no conjunto.');
 if(d.contractCodes.some(c=>!contractItems.some(i=>i.code===c&&c.startsWith('RIP')))||d.fabricationCodes.some(c=>!fabricationItems.some(i=>i.code===c&&c.startsWith('RIP'))))issues.push('P01 e P11 permanecem separados; selecione apenas ripados válidos.');
 if(!Array.isArray(d.links)||d.links.length!==d.fabricationCodes.length||new Set(d.links.map(l=>l.fabricationCode)).size!==d.fabricationCodes.length||d.links.some(l=>!d.contractCodes.includes(l.contractCode)||!d.fabricationCodes.includes(l.fabricationCode))||d.contractCodes.some(c=>!d.links.some(l=>l.contractCode===c)))issues.push('Confira a origem de cada recorte e a cobertura dos itens contratados.');
 return issues;
}
export function coverageIssues(d:SetDraft){return [...setIssues(d),...(!['total','partial'].includes(d.coverage)?['Informe se o detalhamento do conjunto está completo ou parcial.']:[]),...(d.coverage==='partial'&&!d.pending.trim()?['Descreva o que falta detalhar no conjunto.']:[])];}
