# Entrada comercial — primeira entrega de cadastro

28/10/2026. Branch codex/recebimento-comercial, baseada no oficial 2f08a15. Destino: somente Preview.

## Implementado nesta entrega
- Cadastro manual e confirmação de novo PDF: múltiplos responsáveis autorizados com nome, função e contato.
- Sem os campos autorização registrada/referência da autorização.
- Sem seleção de técnico do orçamento ou responsável genérico pelo acompanhamento no cadastro novo. Os valores legados não são apagados.
- Previsão de entrega comercial: data de necessidade de instalação concluída. Não modifica prazo contratual.
- Alternativa explícita de data desconhecida, com orientação para pauta da primeira visita.
- Dados visíveis em Dados da obra; autoria e dados iniciais registrados na auditoria.
- Reprocessamento de PDF preserva contatos e planejamento já registrados.
- Validação no servidor de contatos completos, alinhamento dos campos repetidos e datas reais.
- Nenhuma migration, alteração de permissão ou escrita em banco oficial necessária para preparar este Preview.

## Limites e próximos incrementos
Esta entrega é o cadastro, não o fluxo completo de recebimento. A obrigação automática de conferir recebimento, sua deduplicação, prazo do próximo dia útil às 17h30, checklist de conclusão e encaminhamento à pauta ainda precisam de implementação/integração e homologação específicas. Não afirmar que essa obrigação foi criada só porque o contrato foi salvo.
Também ficam para sequência: edição da previsão por Anna com histórico antes/depois, atividade de planejamento sem data, integração Comercial, análise inicial de Igor em 5 dias úteis, reunião e pasta. Texto orientativo não equivale a atividade automática.

## Como usar — roteiro para Comercial
1. Somente em homologação, abrir Contratos e escolher Importar PDF ou Novo contrato (conforme acesso).
2. Conferir número, cliente, obra, endereço e prazo do contrato. No PDF, revisar as peças da prévia.
3. Incluir cada responsável autorizado pela obra: nome, função e telefone/contato. Usar Acrescentar responsável quando necessário.
4. Informar quando o cliente precisa das peças instaladas. Caso não saiba, marcar Data de necessidade ainda não informada pelo cliente.
5. Salvar. Reabrir a obra e conferir a previsão e a relação de responsáveis em Dados da obra.
6. Havendo erro, corrigir o campo indicado. Não criar outro número de contrato para contornar erro.

## Conferência com Eduardo e Comercial (10–15 minutos)
- Obra fictícia com dois responsáveis e data conhecida; reabrir e verificar dados.
- Obra fictícia sem data, explicitamente marcada; verificar aviso da primeira visita.
- Tentar salvar um responsável incompleto; deve impedir a gravação.
- Incluir/remover pessoa e confirmar que os demais dados permanecem.
- Reenviar PDF de cenário existente; contatos e previsão precisam permanecer.
- Verificar tela estreita, nomes compridos, campos e fechamento com dados não salvos.
- Não usar obras reais como teste; a publicação oficial será tratada após aceite.

## Validação técnica
Testes cobrem contatos múltiplos, ausência de contato, data inválida/bissexta, desconhecida, conflito de opções, gravação das ações e preservação de dados no reprocessamento. Compilação local usa --webpack por incompatibilidade do Turbopack com junction local de dependências; Vercel deve validar build padrão com dependências próprias.
