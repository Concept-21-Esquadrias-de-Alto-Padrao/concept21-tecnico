# Recebimento comercial — três etapas em homologação

28/10/2026. Branch codex/recebimento-comercial. Somente Preview e banco TESTE. Não publicar no oficial sem aceite.

## Fluxo implementado
1. Adicionar obra: escolher Importar PDF ou Cadastrar manualmente. Preencher os dados aprovados, contatos e previsão de entrega comercial; dias corridos como padrão manual. PDF com dias úteis explícitos preserva a informação.
2. Dados da obra: confirmar os dados para continuar. Guardar e continuar depois cria/preserva o recebimento pendente, sem declarar a conferência concluída. O primeiro registro exige os dados cadastrais obrigatórios.
3. Peças e desenhos: revisar código, ambiente, modelo, quantidade e medidas comerciais, informar a referência externa do desenho e conferir peças/desenho. O cadastro manual permite acrescentar peças; o PDF aproveita as importadas.
4. Concluir conferência: revisar resumo, incluir observações para alinhamento e concluir explicitamente. A conclusão encerra a atividade e disponibiliza a reunião; não libera fabricação.

## Guardar e retomar
O progresso fica no banco, incluindo etapa, peças, marcações e observações. Retomar por Meu trabalho ou Obras. Uma atividade por recebimento, atribuída ao cadastrador/importador, vence às 17h30 do próximo dia útil conforme calendário cadastrado. Obra pendente aparece como Conferência pendente; reunião e pasta são bloqueadas no servidor até a conclusão. Registros legados sem recebimento não são reinterpretados.

## Segurança e recuperação
Versão do rascunho impede sobrescrever outra sessão. Conclusão repetida é idempotente; IDs estáveis preservam peças. Falha durante aplicação deixa estado explícito e permite repetir a mesma conclusão. Permissões e empresa são verificadas no servidor; peças que já avançaram para medição/CEM/liberação/PROD não são regravadas por este fluxo. Não há nova migration.

## Validação realizada
- Cadastro manual fictício TESTE-REC-2810-C: guardar dados, tentar avançar sem confirmação (recusado), cadastrar J1/Sala/Janela de correr, quantidade 2, 1000 x 1200 mm.
- Guardar etapa 2, sair para Meu trabalho e retomar: valores e etapa preservados.
- Guardar etapa 3, recarregar, concluir: observação preservada no contrato, atividade encerrada e reunião disponível.
- Testes automatizados: conclusão incompleta, empresa divergente, peças avançadas, concorrência, repetição, recuperação de falha, bloqueios, proprietário da atividade e prazo às 17h30.

## Próximas etapas fora desta entrega
Edição de previsão pela Anna com histórico antes/depois; atividade de planejamento sem data; integração com Comercial; análise inicial de Igor; automatização da pauta/reunião/pasta. Orientação de primeira visita não significa atividade automática dessas etapas. Os documentos continuam no servidor; a tela guarda sua referência.
