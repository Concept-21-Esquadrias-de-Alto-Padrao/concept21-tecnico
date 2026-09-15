import { redirect } from "next/navigation";

export default function TechnicalCorrectionsPage() {
  redirect("/tecnico/acoes?tipo=correcao");
}
