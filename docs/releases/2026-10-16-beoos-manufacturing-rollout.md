# Publicacao isolada: medidas de fabricacao/CEM

## Escopo

- Fila central de solicitacoes de alteracao de pecas e autorizacao com auditoria.
- Sincronizacao da descricao exibida quando uma edicao autorizada altera o tipo da peca.
- Medidas efetivas de fabricacao/CEM por peca, separadas das medidas de venda e de campo.
- Revisoes imutaveis, motivo obrigatorio e historico por PROD.
- Conferencia e aprovacao da PROD condicionadas a uma revisao completa de fabricacao.
- Snapshot da aprovacao contendo a revisao e as medidas de fabricacao vigentes.
- Layout responsivo e mensagem especifica quando todas as pecas ja pertencem a uma PROD.

Funcionalidades M1 ainda em homologacao nao fazem parte desta publicacao.

## Ordem da janela

Duracao prevista: 20 a 30 minutos, apos autorizacao expressa.

1. Ativar manutencao e confirmar bloqueio de novos lancamentos.
2. Gerar backup final do banco e registrar o deployment atual da Vercel para rollback.
3. Aplicar, nesta ordem, as tres migrations `20261015165821`, `20261015170555` e `20261015183314`.
4. Executar `supabase/manual/20261016_beoos_manufacturing_baseline.sql`.
5. Conferir os quatro registros, a revisao atual da PROD e a preservacao do status, vinculos e datas de aprovacao.
6. Publicar a branch isolada e executar os testes de fumaca com Administrador e perfis somente consulta.
7. Reabrir o sistema somente apos a conferencia final.

## Idempotencia da carga Beoos

A carga localiza contrato, PROD e pecas por chaves de negocio, normalizando espacos dos codigos. Antes de gravar, ela exige:

- exatamente um contrato `26-0715` e uma PROD ativa `26-0715_PROD1`;
- PROD ainda aprovada e exatamente quatro pecas vinculadas;
- medidas de venda e de campo iguais aos valores conferidos;
- ausencia de revisoes anteriores, ou uma revisao 1 ja identica.

Na primeira execucao, os quatro registros e um marcador de auditoria sao inseridos na mesma transacao. Em repeticoes, uma revisao 1 identica gera apenas um aviso e nenhuma gravacao. Estado parcial, valores divergentes ou revisao posterior interrompem a transacao. Portanto, repetir o procedimento nao duplica medidas nem auditoria.

## Preservacao

A carga altera somente `current_revision` da PROD e insere as quatro medidas de fabricacao. Ela nao altera medidas de venda/campo, pecas, liberacoes, vinculos, status, CEM, responsaveis, datas de conferencia/aprovacao ou o snapshot da aprovacao original.

## Recuperacao

- Falha antes do `commit`: o PostgreSQL desfaz toda a carga automaticamente.
- Falha da aplicacao: promover novamente o deployment anterior da Vercel. As migrations sao aditivas e compativeis com a versao anterior.
- Falha da carga apos o `commit`, antes de uso do novo fluxo: executar o rollback manual guardado. Ele se recusa a operar se existir revisao posterior ou quantidade inesperada de registros.
- Divergencia grave: manter a manutencao ativa e restaurar o backup final do banco.

Os arquivos existentes nao sao modificados por este escopo. A recuperacao de arquivos permanece pela copia/rotina de backup ja definida para a janela geral.

## Validacao posterior

- P1: venda/campo `1063 x 3454`; fabricacao `1057 x 3450`.
- FIXO 1: venda/campo `4920 x 4020`; fabricacao `4920 x 4020`.
- FIXO 2: venda/campo `520 x 4020`; fabricacao `520 x 4020`.
- FIXO 3: venda `2200 x 806`, campo `2200 x 810`; fabricacao `2200 x 810`.
- PROD `26-0715_PROD1` permanece aprovada, sem duplicacao de pecas, liberacoes ou atividades.
