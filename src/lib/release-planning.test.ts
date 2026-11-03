import { expect, it } from "vitest";
import {releasePlan} from "./release-planning";
import type {TechnicalPiece} from "./types";

it("moves only actual releases into the effective workload and flags the rest of their forecast group",()=>{
  const pieces = [
    {id:"a",status:"liberada",quantity:2,released_at:"2026-11-05",forecast_date:"2026-11-04",forecast_group:"group"},
    {id:"b",status:"medida",quantity:1,forecast_date:"2026-11-04",forecast_group:"group"},
    {id:"c",status:"avaliada",quantity:3,forecast_date:"2026-11-10",forecast_group:"other"},
    {id:"d",status:"cancelada"},
  ] as TechnicalPiece[];
  const [a,b,c,...rest]=releasePlan(pieces,"2026-11-03",[]);
  expect([a.released,a.units,a.prodDue]).toEqual([true,2,"2026-11-12"]);
  expect([b.released,b.replan,b.prodDue]).toEqual([false,true,null]);
  expect([c.released,c.replan,c.prodDue]).toEqual([false,false,"2026-11-17"]);
  expect(rest).toHaveLength(0);
});
