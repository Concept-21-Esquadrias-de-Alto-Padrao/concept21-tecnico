"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const groups = [
  {name:"Visão geral",links:[["visao-geral","Peças da obra"]]},
  {name:"Comercial",links:[["dados-obra","Cadastro e contatos"],["reuniao","Reunião e ata"],["entrada","Entrega da pasta"]]},
  {name:"Obras",links:[["visitas","Visitas e relatórios"],["pecas","Medições e liberações"],["lotes","Lotes de liberação"]]},
  {name:"PRODs",links:[["prods","Ordens e repasses"]]},
  {name:"Acompanhamento",links:[["acoes","Ações e correções"],["duvidas","Dúvidas"],["historico","Histórico"],["administracao","Administração"]]},
];
const CurrentSection=createContext("visao-geral");
export function WorkArea({id,children}:{id:string;children:ReactNode}){
  return <div data-work-area={id} hidden={useContext(CurrentSection)!==id}>{children}</div>;
}
export function WorkWorkspace({admin,children}:{admin:boolean;children:ReactNode}){
  const [active,setActive]=useState("visao-geral");
  useEffect(()=>{
    function sync(){
      const target=document.getElementById(window.location.hash.slice(1));
      const area=target?.closest<HTMLElement>("[data-work-area]")?.dataset.workArea;
      setActive(area || "visao-geral");
      if(area && target) requestAnimationFrame(()=>{
        for(let p:HTMLElement|null=target;p;p=p.parentElement){if(p instanceof HTMLDetailsElement)p.open=true;}
        if(target.id===area) document.getElementById("work-nav")?.scrollIntoView({block:"start"});
        else target.scrollIntoView({block:"center"});
      });
    }
    sync();window.addEventListener("hashchange",sync);
    return ()=>window.removeEventListener("hashchange",sync);
  },[]);
  const current=groups.find(g=>g.links.some(([id])=>id===active)) ?? groups[0];
  return <CurrentSection.Provider value={active}>
    <nav id="work-nav" aria-label="Áreas da obra" className="scroll-mt-20 rounded-xl border border-border bg-white">
      <div className="flex flex-wrap gap-1 p-2">{groups.map(g=><a key={g.name} href={"#"+g.links[0][0]}
        className={"rounded-md px-3 py-2 text-sm font-semibold "+(g===current?"bg-charcoal text-white":"text-charcoal hover:bg-muted")}>{g.name}</a>)}</div>
      {groups.filter(g=>g.links.length>1).map(g=><div key={g.name} hidden={current!==g} className="border-t border-border px-2 py-1">
        {g.links.filter(([id])=>admin||id!=="administracao").map(([id,label])=><a key={id} href={"#"+id} aria-current={active===id?"page":undefined}
          className={"inline-block rounded-md px-3 py-2 text-sm "+(active===id?"bg-orange-50 font-semibold text-orange-900":"hover:underline")}>{label}</a>)}
      </div>)}
    </nav>
    {children}
  </CurrentSection.Provider>;
}
