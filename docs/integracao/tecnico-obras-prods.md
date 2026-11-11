# PRODs e Obras — preparação de integração

Referência consultada: chat Auditar Sistema Obras (01a0b049-e603-7ad3-8285-2c772f95c070), 06/11/2026.

Obras já possui recebimentos locais parciais, aceites por quantidade e divergências com pendências. Apontamento por unidade física ainda precisa ser alinhado. Não duplicar esse fluxo no Técnico.

## Identidade e responsabilidades
- Preservar company_id, contract_id, piece_id, parent_piece_id, release_id e prod_batch_id. Não usar apenas código/nome para sincronizar.
- Técnico é a origem de contrato, peças, medidas, liberações e PRODs. Obras acrescenta recebimento físico, instalação, ocorrências e execução.
- Uma PROD pode consumir peças de mais de um lote; um lote pode gerar várias PRODs.
- Quantidade de item não equivale a uma unidade física. Preparar recebimentos parciais sem concluir o item inteiro.
- Confirmação de documentos departamentais não é chegada de material, recebimento na obra ou início de instalação.
- Datas comercial, liberação, recebimento da pasta, emissão, entrega prevista e instalação permanecem distintas.

## Próxima integração (não implementada nesta prévia)
Payload versionado por empresa, contrato, PROD/revisão e peça, com quantidade, ambiente, modelo, medidas de campo e fabricação separadas. Importação idempotente pelo identificador de origem + revisão, mantendo vínculos e histórico. Eventos de alteração/cancelamento exigem análise de impacto antes de modificar item já recebido/instalado. Atividades devem referenciar a origem, sem duplicar obrigações. Testar uma unidade recebida de um item com três unidades, desmembramento e revisão.

## Entrega desta rodada
Tela PRODs e repasses com pastas/prazos, busca, detalhes, lotes, datas, unidades, medidas do relatório e repasses por setor. Seleção real de documentos persistida nas observações do envio, preservando envios anteriores. Sem armazenamento de PDFs, sem compras ou ligação ativa com banco de Obras. Nenhuma migration.
