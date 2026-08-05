# Manual de Uso - Concept21 Aluminium - Modulo Tecnico

Versao do manual: 05/08/2026
Sistema: Concept21 Aluminium - Modulo Tecnico
Ambiente de producao: https://concept21-tecnico.vercel.app
Repositorio: https://github.com/igorconcept/concept21-tecnico

## Sumario

1. Objetivo do sistema
2. Conceitos principais
3. Acesso ao sistema
4. Cadastro, confirmacao de e-mail e liberacao pelo Administrador
5. Perfis e permissoes
6. Navegacao geral
7. Notificacoes
8. Painel Tecnico
9. Contratos Tecnicos
10. Importacao de contrato por PDF
11. Cadastro manual autorizado
12. Pagina tecnica do contrato
13. Entrada comercial e pasta
14. Reuniao de fechamento e ata
15. Acoes tecnicas
16. Agenda tecnica e visitas
17. Pecas, medicoes, desdobramentos e liberacoes
18. Correcoes tecnicas
19. PRODs tecnicos
20. Entregas para Suprimentos e Producao
21. Base de duvidas
22. Indicadores e relatorios
23. Configuracoes tecnicas
24. Seguranca e acessos
25. Cadastros e parametros
26. Uso em celular
27. Rotinas recomendadas
28. Regras de negocio importantes
29. Solucao de problemas
30. Glossario
31. Matriz resumida de permissoes
32. Procedimentos rapidos
33. Observacoes finais

## 1. Objetivo do Sistema

O Modulo Tecnico controla o fluxo operacional do contrato tecnico da Concept21 Aluminium desde o recebimento do contrato fechado ate o repasse tecnico para Suprimentos e Producao.

O contrato e a entidade central do sistema. Todas as visitas, acoes, pecas, correcoes, PRODs, duvidas, entregas, confirmacoes e indicadores ficam vinculados a um contrato.

O sistema foi criado para substituir controles paralelos, planilhas soltas e acompanhamentos dispersos, mantendo os dados estruturados, pesquisaveis, auditaveis e protegidos por permissao.

O Tecnico encerra sua atividade operacional principal quando:

- as listas de materiais sao entregues a Suprimentos;
- as ordens de producao sao entregues a Producao.

Depois desse repasse, o Modulo Tecnico continua sendo usado para:

- responder duvidas da Producao durante a fabricacao;
- responder duvidas de Obras/Instalacoes;
- consultar historico;
- acompanhar correcoes;
- consultar indicadores e rastreabilidade.

## 2. Conceitos Principais

### Contrato

Representa o contrato central da plataforma. No Modulo Tecnico ele recebe dados complementares como responsavel tecnico, responsavel por acompanhamento, status tecnico, prazo, risco e dados de recebimento da pasta comercial.

### Peca

Representa cada item tecnico extraido ou cadastrado no contrato. A peca possui dados comerciais, dados de medicao, status tecnico, liberacao, controles de CEM e vinculo com PROD.

### Pasta comercial

Registro de que o material comercial necessario ao Tecnico foi entregue. A primeira visita depende desse registro.

### Reuniao de fechamento

Reuniao inicial obrigatoria do fluxo tecnico. Deve ser registrada antes do avanco do contrato para a primeira visita.

### Acao tecnica

Pendencia ou tarefa vinculada ao contrato, normalmente originada na reuniao de fechamento ou no acompanhamento tecnico-operacional. Pode ser bloqueante e pode impedir uma etapa configurada.

### Visita tecnica

Agendamento e registro de ida tecnica a obra. Pode estar ligada a uma ou varias pecas. Toda visita realizada exige relatorio.

### Medicao

Registro das medidas tecnicas reais da peca. A peca precisa estar medida para ser liberada.

### Liberacao

Registro de que uma peca medida esta liberada para seguir no fluxo tecnico. A liberacao inicia o controle de prazo da peca.

### CEM

Nesta primeira versao, o sistema nao integra automaticamente com o ERP CEM. O usuario registra manualmente que a peca foi cadastrada e conferida no CEM.

### PROD

Lote tecnico composto por pecas liberadas, cadastradas e conferidas no CEM. O PROD passa por conferencia, aprovacao e entrega dos documentos para os departamentos responsaveis.

### Correcao

Registro de problema, ajuste ou pendencia tecnica que pode bloquear liberacao, PROD ou entrega. Pode ser marcada como bloqueante e/ou critica.

### Base de duvidas

Repositorio separado para duvidas da Producao e duvidas de Obras/Instalacoes.

### Auditoria

Historico de eventos relevantes do modulo. O sistema registra alteracoes, criacoes, transicoes, aprovacoes, confirmacoes e observacoes importantes.

## 3. Acesso ao Sistema

O sistema em producao fica em:

https://concept21-tecnico.vercel.app

Para acessar:

1. Abra o endereco no navegador.
2. Informe o e-mail.
3. Informe a senha.
4. Clique em **Entrar**.

Se o login for valido, o sistema direciona o usuario para o Modulo Tecnico ou para a primeira tela permitida pelo perfil.

Se o usuario nao tiver perfil liberado, ele nao conseguira acessar as telas operacionais ate que um Administrador vincule um nivel de acesso.

## 4. Cadastro, Confirmacao de E-mail e Liberacao pelo Administrador

O cadastro segue tres etapas:

1. O usuario cria o cadastro.
2. O usuario confirma o e-mail.
3. O Administrador libera o nivel de acesso.

### 4.1 Criar Cadastro

Na tela de login:

1. Clique em **Criar acesso**.
2. Preencha **Nome completo**.
3. Preencha **E-mail**.
4. Opcionalmente preencha **Telefone**.
5. Crie uma senha com pelo menos 6 caracteres.
6. Repita a senha em **Confirmar senha**.
7. Clique em **Criar cadastro**.

O sistema cria o usuario de autenticacao e exibe uma mensagem orientando a confirmacao por e-mail.

### 4.2 Confirmar E-mail

Depois de criar o cadastro:

1. Abra a caixa de entrada do e-mail informado.
2. Localize o e-mail enviado pelo Supabase/Auth.
3. Clique no link de confirmacao.
4. Volte para a tela de login.

Quando o e-mail e confirmado, o sistema registra a solicitacao de acesso.

### 4.3 Aguardar Liberacao

Apos confirmar o e-mail, o usuario ainda nao possui acesso operacional. Ele fica pendente ate que o Administrador vincule um perfil.

O Administrador recebe uma notificacao informando que existe cadastro aguardando liberacao.

### 4.4 Liberar Usuario como Administrador

Com uma conta administradora:

1. Acesse **Configuracoes**.
2. Abra a area **Seguranca e acessos**.
3. Localize o usuario com status **Pendente**.
4. No campo **Selecionar nivel de acesso**, escolha o perfil adequado.
5. Clique em **Liberar acesso**.

A partir desse momento o usuario passa a acessar as telas permitidas pelo perfil.

### 4.5 Recusar ou Excluir Cadastro

Na mesma tela de **Seguranca e acessos**, o Administrador pode:

- recusar um cadastro pendente;
- excluir um usuario que nao deve permanecer na base;
- inativar um usuario ativo;
- reativar um usuario inativo;
- remover um nivel de acesso ja vinculado.

O proprio usuario atual nao deve ser inativado enquanto estiver usando o sistema.

## 5. Perfis e Permissoes

O sistema usa permissoes granulares. Isso significa que a tela pode aparecer ou nao aparecer de acordo com o perfil, e as acoes tambem sao validadas no servidor.

O Administrador possui acesso absoluto.

### Administrador

Pode:

- acessar todas as telas;
- liberar usuarios;
- gerenciar niveis de acesso;
- gerenciar parametros;
- cadastrar contrato manualmente;
- importar contrato por PDF;
- registrar pasta;
- registrar reuniao;
- criar, atualizar e validar acoes;
- criar visitas, registrar realizacao e cancelar visitas;
- medir e liberar pecas;
- registrar e encerrar correcoes;
- montar, conferir, aprovar e alterar PRODs;
- entregar documentos a Suprimentos e Producao;
- confirmar recebimentos quando necessario;
- responder duvidas;
- consultar auditoria;
- executar acoes de qualquer perfil.

### Gestor Tecnico

Perfil indicado para lideranca tecnica.

Pode:

- visualizar painel e contratos;
- cadastrar contratos manualmente;
- editar dados tecnicos autorizados;
- visualizar informacoes financeiras quando liberado;
- registrar recebimento de pasta;
- registrar reuniao de fechamento;
- criar e gerenciar acoes;
- reabrir acoes quando aplicavel;
- criar e cancelar visitas;
- registrar medicoes;
- liberar pecas;
- editar pecas ja liberadas quando autorizado;
- gerar relatorios;
- registrar e encerrar correcoes;
- montar, conferir e aprovar PRODs;
- alterar PROD aprovado quando autorizado;
- consultar auditoria;
- gerenciar parametros tecnicos.

### Tecnico

Perfil indicado para execucao tecnica em obra e preparacao do repasse.

Pode:

- visualizar painel e contratos;
- importar contrato por PDF;
- visualizar acoes;
- visualizar acompanhamento;
- criar e cancelar visitas;
- registrar medicoes;
- liberar pecas;
- gerar relatorios;
- visualizar correcoes;
- montar e conferir PRODs;
- criar e responder duvidas;
- consultar bases de duvidas.

Nao deve:

- aprovar PROD;
- visualizar informacoes financeiras quando nao autorizado;
- alterar PROD aprovado;
- administrar parametros;
- administrar usuarios.

### Acompanhamento Tecnico-Operacional

Perfil indicado para registro de ata, acoes, agenda e acompanhamento.

Pode:

- visualizar painel e contratos;
- registrar pasta comercial;
- registrar reuniao e ata;
- criar e atualizar acoes;
- visualizar e registrar acompanhamento;
- criar e cancelar visitas;
- consultar base de duvidas.

Nao deve:

- medir pecas;
- liberar pecas;
- aprovar PROD;
- administrar parametros;
- administrar usuarios.

### Suprimentos

Perfil indicado para recebimento das listas de materiais.

Pode:

- visualizar painel;
- visualizar PRODs;
- confirmar recebimento de listas de materiais;
- consultar base de duvidas.

### Producao

Perfil indicado para recebimento das ordens de producao e duvidas de fabricacao.

Pode:

- visualizar painel;
- visualizar PRODs;
- confirmar recebimento de ordens de producao;
- consultar base de duvidas;
- registrar e responder duvidas quando liberado.

### Obras/Instalacoes

Perfil preparado para uso futuro.

Pode:

- consultar base de duvidas quando liberado.

## 6. Navegacao Geral

A navegacao principal do Modulo Tecnico possui:

- **Painel Tecnico**
- **Contratos**
- **Agenda Tecnica**
- **Acoes**
- **Correcoes**
- **PRODs**
- **Base de Duvidas**
- **Indicadores**
- **Configuracoes**

Em computadores, a navegacao aparece em menu lateral. Em celulares, a navegacao se adapta para uma barra superior horizontal com rolagem.

O usuario visualiza somente os itens permitidos pelo seu nivel de acesso.

## 7. Notificacoes

O sino de notificacoes fica no topo da aplicacao.

Quando existem notificacoes nao lidas, o sistema exibe um contador vermelho.

Para usar:

1. Clique no sino.
2. Leia as notificacoes exibidas.
3. Clique na notificacao desejada.

Ao clicar em uma notificacao:

- o sistema abre o destino relacionado, quando houver;
- a notificacao e marcada como lida;
- ela sai da lista local.

Exemplos de notificacao:

- cadastro aguardando liberacao;
- pendencias de acesso;
- eventos operacionais configurados;
- entregas ou confirmacoes pendentes, quando aplicavel.

## 8. Painel Tecnico

Tela: **Painel Tecnico**
Rota: `/tecnico`

O Painel Tecnico e a visao operacional inicial. Ele mostra indicadores de risco e atalhos para os pontos que precisam de atencao.

### Indicadores exibidos

- **Aguardando pasta**: contratos sem pasta comercial registrada.
- **Aguardando reuniao**: contratos com pasta recebida, mas sem reuniao de fechamento concluida.
- **Acoes bloqueantes vencidas**: acoes bloqueantes cujo prazo venceu.
- **Visitas hoje**: visitas agendadas para a data atual.
- **Proximas visitas**: visitas agendadas para os proximos sete dias.
- **Visitas aguardando relatorio**: visitas realizadas que ainda precisam de relatorio.
- **Pecas aguardando liberacao**: pecas avaliadas ou medidas que ainda nao foram liberadas.
- **Correcoes abertas**: correcoes ainda nao encerradas ou canceladas.
- **PRODs aguardando conferencia**: lotes que precisam ser conferidos.
- **PRODs aguardando aprovacao**: lotes que precisam de aprovacao.
- **Confirmacoes pendentes**: entregas a departamentos ainda nao confirmadas.
- **Duvidas sem resposta**: duvidas abertas nas bases.

### Atividades prioritarias

A secao **Atividades prioritarias** lista contratos com:

- acao vencida;
- correcao critica;
- saldo de pecas a liberar.

Cada item pode ser aberto diretamente para a pagina tecnica do contrato.

### Agenda proxima

Mostra visitas previstas para os proximos sete dias, com data, tipo de visita, contrato e tecnico.

### Como usar no dia a dia

1. Comece pelo Painel Tecnico.
2. Verifique cards em vermelho ou amarelo.
3. Abra contratos com pendencias criticas.
4. Resolva acoes vencidas antes de avancar visitas ou liberacoes.
5. Acompanhe visitas e relatorios pendentes.

## 9. Contratos Tecnicos

Tela: **Contratos**
Rota: `/tecnico/contratos`

A tela de contratos concentra:

- importacao de contrato por PDF;
- cadastro manual autorizado;
- busca e filtros;
- lista operacional dos contratos cadastrados.

### Busca

O campo de busca localiza contratos por:

- numero do contrato;
- nome do cliente;
- nome da obra;
- endereco.

### Filtro de situacao

O filtro **Todas as situacoes** permite restringir por status tecnico:

- Aguardando pasta;
- Aguardando reuniao;
- Em acompanhamento;
- Aguardando visita;
- Em medicao;
- Em liberacao;
- Em PROD;
- Repassado;
- Concluido.

### Lista de contratos

Em desktop, a tela mostra tabela com:

- contrato;
- cliente e obra;
- situacao;
- proxima visita;
- pecas;
- correcoes;
- PRODs;
- risco;
- acao para abrir.

Em celular, cada contrato aparece em card com os mesmos dados principais e botao **Abrir**.

## 10. Importacao de Contrato por PDF

Disponivel para usuarios com permissao de importacao por PDF.

O sistema nunca grava automaticamente os dados extraidos do PDF. Sempre existe uma etapa de conferencia humana antes da gravacao.

### Passo a passo

1. Acesse **Contratos**.
2. Na area **Importar contrato por PDF**, clique no campo **PDF do contrato**.
3. Selecione o arquivo PDF.
4. Clique em **Conferir extracao**.
5. Aguarde a leitura.
6. Revise os dados do contrato.
7. Revise a lista de pecas extraidas.
8. Corrija qualquer informacao incorreta.
9. Adicione pecas faltantes, se necessario.
10. Remova pecas indevidas, se necessario.
11. Clique em **Confirmar e gravar contrato**.

### Dados do contrato revisados na importacao

- numero do contrato;
- cliente;
- data do contrato;
- prazo contratual;
- unidade do prazo, em dias uteis ou dias corridos;
- obra;
- endereco da obra;
- descricao.

### Dados das pecas revisados na importacao

- codigo;
- tipo;
- quantidade;
- largura de venda;
- altura de venda;
- ambiente;
- vidro;
- cor;
- linha.

### Alertas da importacao

O sistema pode exibir avisos quando:

- o contrato parece duplicado;
- existem codigos de peca duplicados;
- o PDF nao contem informacoes suficientes;
- algum dado foi extraido com baixa confianca.

Quando houver alerta, revise antes de gravar.

## 11. Cadastro Manual Autorizado

Disponivel para Gestor Tecnico, Administrador ou perfil com permissao especifica.

Use o cadastro manual quando:

- o PDF ainda nao esta disponivel;
- o PDF nao foi lido adequadamente;
- o contrato precisa ser criado durante testes;
- o Gestor precisa registrar um contrato diretamente.

### Campos do cadastro manual

- numero do contrato;
- cliente;
- data do contrato;
- prazo;
- unidade do prazo;
- obra;
- endereco da obra;
- cidade;
- UF;
- tecnico responsavel;
- acompanhamento;
- descricao ou observacoes.

### Passo a passo

1. Acesse **Contratos**.
2. Localize a area **Cadastro manual autorizado**.
3. Preencha os campos obrigatorios.
4. Defina tecnico e acompanhamento, se ja souber.
5. Clique em **Salvar contrato**.

O contrato criado passa a aparecer na lista de contratos cadastrados.

## 12. Pagina Tecnica do Contrato

Tela: detalhe do contrato
Rota: `/tecnico/contratos/[id]`

A pagina tecnica do contrato e o centro operacional do modulo.

### Cabecalho

O topo exibe:

- numero do contrato;
- cliente;
- obra;
- endereco;
- status tecnico;
- percentual liberado;
- risco;
- prazo;
- tecnico responsavel;
- responsavel por acompanhamento;
- proxima visita;
- proxima acao.

### Abas/atalhos internos

A pagina possui atalhos para:

- Visao geral;
- Entrada comercial;
- Reuniao e ata;
- Acoes;
- Visitas;
- Pecas;
- Correcoes;
- PRODs;
- Duvidas;
- Historico.

### Visao geral

Mostra cards com:

- pecas contratadas;
- pecas liberadas;
- saldo;
- correcoes abertas;
- PRODs ativos.

Use essa area para entender rapidamente o estado do contrato.

## 13. Entrada Comercial e Pasta

Secao: **Entrada comercial**

A pasta comercial e obrigatoria antes do avanco para a primeira visita.

### Informacoes exibidas

- se a pasta esta entregue ou pendente;
- data da entrega;
- responsavel pela entrega.

### Registrar pasta

Usuarios autorizados devem:

1. Abrir o contrato.
2. Ir ate **Entrada comercial**.
3. Preencher **Data da entrega**.
4. Preencher **Responsavel pela entrega**.
5. Informar uma observacao, se necessario.
6. Clicar em **Registrar pasta**.

Depois disso, o contrato deixa de ficar como pendencia de pasta.

## 14. Reuniao de Fechamento e Ata

Secao: **Reuniao e ata**

A reuniao de fechamento tambem e pre-requisito do fluxo tecnico.

### Informacoes registradas

- data;
- horario;
- participantes;
- resumo;
- decisoes;
- acao bloqueante inicial, quando houver;
- prazo da acao.

### Passo a passo para registrar reuniao

1. Abra o contrato.
2. Va ate **Reuniao e ata**.
3. Preencha **Data**.
4. Preencha **Horario**, se aplicavel.
5. Informe os **Participantes**.
6. Registre o **Resumo**.
7. Registre as **Decisoes**.
8. Se houver pendencia inicial bloqueante, preencha **Acao bloqueante inicial**.
9. Informe o **Prazo da acao**, se houver.
10. Clique em **Registrar reuniao**.

### Regra operacional

O contrato nao deve avancar para a primeira visita enquanto:

- a pasta comercial nao estiver registrada;
- a reuniao de fechamento nao estiver registrada;
- existir acao bloqueante inicial aberta.

## 15. Acoes Tecnicas

Tela geral: **Acoes**
Secao no contrato: **Acoes**

As acoes tecnicas controlam pendencias da reuniao e do acompanhamento tecnico-operacional.

### Campos de uma acao

- contrato;
- titulo;
- descricao;
- responsavel;
- prazo;
- prioridade;
- indicador de bloqueio;
- etapa bloqueada;
- status.

### Status de acao

- Aberta;
- Em andamento;
- Concluida;
- Validada;
- Cancelada.

### Criar acao pela tela geral

1. Acesse **Acoes**.
2. Na area **Nova acao**, selecione o contrato.
3. Informe o titulo.
4. Informe a descricao, se necessario.
5. Escolha o responsavel.
6. Informe o prazo.
7. Marque **Bloqueante** se a acao impedir alguma etapa.
8. Clique em **Criar acao**.

### Criar acao dentro do contrato

1. Abra o contrato.
2. Va ate **Acoes**.
3. Preencha os dados da nova acao.
4. Se necessario, informe a etapa bloqueada.
5. Clique em **Criar acao**.

### Atualizar status

Na lista de acoes, usuarios autorizados podem mover a acao para:

- em andamento;
- concluida;
- validada.

Quando uma acao estiver vencida, o sistema destaca a pendencia.

## 16. Agenda Tecnica e Visitas

Tela geral: **Agenda Tecnica**
Secao no contrato: **Visitas**

A agenda controla visitas, realizacao, cancelamento, relatorio e vinculo com pecas.

### Campos de uma visita

- contrato;
- tipo;
- data;
- horario;
- tecnicos;
- objetivos;
- pecas vinculadas;
- acompanhada por;
- resultado;
- motivo de cancelamento, quando cancelada.

### Status de visita

- Agendada;
- Realizada;
- Aguardando relatorio;
- Relatorio emitido;
- Cancelada.

### Agendar visita

1. Acesse **Agenda Tecnica** ou abra o contrato e va ate **Visitas**.
2. Se estiver na tela geral, selecione o contrato.
3. Informe o **Tipo** de visita.
4. Informe a **Data**.
5. Informe o **Horario**, se aplicavel.
6. Informe os **Tecnicos**.
7. Descreva os **Objetivos**.
8. Selecione as **Pecas** relacionadas, quando aplicavel.
9. Clique em **Agendar visita**.

### Registrar realizacao

1. Localize uma visita com status **Agendada**.
2. Clique/preencha a area **Registrar realizacao**.
3. Informe **Realizada em**.
4. Informe **Acompanhada por**, se aplicavel.
5. Preencha o **Resultado**.
6. Clique em **Registrar realizacao**.

Depois da realizacao, a visita passa a exigir relatorio.

### Gerar relatorio de visita

1. Localize uma visita com status **Aguardando relatorio**.
2. Clique em **Gerar relatorio**.
3. O sistema registra o snapshot estruturado do relatorio.
4. Quando o botao de PDF estiver disponivel, clique para baixar/gerar o arquivo localmente.

O sistema nao armazena o PDF final no Supabase. Ele armazena os dados estruturados que permitiram gerar o documento.

### Cancelar visita

1. Localize uma visita com status **Agendada**.
2. Preencha o **Motivo** ou **Motivo do cancelamento**.
3. Clique em **Cancelar visita**.

Visitas canceladas permanecem no historico.

## 17. Pecas, Medicoes, Desdobramentos e Liberacoes

Secao: **Pecas, medicoes e liberacoes**

Essa secao lista todas as pecas ativas do contrato.

### Dados exibidos

- codigo;
- ambiente;
- medida de venda;
- medicao real;
- status;
- status no CEM;
- prazo;
- acoes disponiveis.

### Status de peca

- Aguardando avaliacao;
- Avaliada;
- Medida;
- Liberada;
- Em correcao;
- Em PROD;
- Entregue;
- Cancelada.

### Registrar medicao

Usuarios autorizados devem:

1. Abrir o contrato.
2. Ir ate **Pecas**.
3. Localizar a peca.
4. No formulario **Medir**, informar largura e altura medidas.
5. Clicar em **Medir**.

Uma peca precisa ter largura e altura medidas para ser liberada.

### Liberar peca

1. Localize a peca medida.
2. No formulario **Liberar**, informe uma previsao excepcional somente se houver necessidade.
3. Clique em **Liberar**.

Regras:

- peca sem medicao nao pode ser liberada;
- peca cancelada nao pode ser liberada;
- correcao bloqueante aberta impede liberacao;
- a liberacao inicia o controle de prazo da peca.

### Atualizar CEM

Antes de entrar em um PROD, a peca precisa estar:

- cadastrada no CEM;
- conferida no CEM.

Para atualizar:

1. Localize a peca.
2. Marque **Cadastrada** quando o cadastro no CEM estiver concluido.
3. Marque **Conferida** quando a conferencia estiver concluida.
4. Clique em **Atualizar CEM**.

### Desdobrar peca

Use o desdobramento quando uma peca inicialmente unica precisar virar uma variacao independente.

1. Localize a peca original.
2. Informe o sufixo, por exemplo `A`, `B` ou outro padrao interno.
3. Clique em **Desdobrar**.

Exemplo:

- peca original: `J01`;
- peca desdobrada: `J01_A`.

A peca desdobrada passa a ter controle independente.

## 18. Correcoes Tecnicas

Tela geral: **Correcoes**
Secao no contrato: **Correcoes**

Correcoes registram pendencias, ajustes ou problemas tecnicos que precisam ser tratados.

### Campos de uma correcao

- contrato;
- peca, se houver;
- tipo;
- descricao;
- responsavel;
- prazo;
- prioridade;
- bloqueante;
- critica;
- status.

### Status de correcao

- Aberta;
- Em andamento;
- Aguardando validacao;
- Encerrada;
- Cancelada.

### Registrar correcao

1. Acesse **Correcoes** ou abra o contrato.
2. Se estiver na tela geral, selecione o contrato.
3. Selecione a peca, se a correcao for especifica.
4. Informe o tipo.
5. Descreva o problema ou ajuste.
6. Informe o prazo.
7. Marque **Bloqueante** se a correcao impedir avanco.
8. Marque **Critica** se exigir atencao imediata.
9. Clique em **Registrar correcao**.

### Encerrar correcao

1. Localize uma correcao aberta.
2. Verifique se a pendencia foi resolvida.
3. Clique em **Encerrar** ou **Encerrar correcao**.

### Impacto de correcao bloqueante

Uma correcao bloqueante pode impedir:

- liberacao da peca;
- entrada da peca no PROD;
- continuidade do fluxo operacional.

## 19. PRODs Tecnicos

Tela geral: **PRODs**
Secao no contrato: **PRODs**

O PROD e o lote tecnico que agrupa pecas liberadas e conferidas para seguir ao fluxo de Suprimentos e Producao.

### Condicoes para uma peca entrar no PROD

A peca precisa:

- estar liberada;
- estar cadastrada no CEM;
- estar conferida no CEM;
- nao estar em outro PROD ativo;
- nao estar cancelada;
- nao possuir correcao bloqueante aberta.

### Campos para montar PROD

- contrato;
- numero do PROD;
- descricao;
- pecas liberadas e conferidas.

### Montar PROD

1. Acesse **PRODs** ou abra o contrato.
2. Va ate **Montar PROD**.
3. Selecione o contrato, quando estiver na tela geral.
4. Informe o **Numero do PROD**.
5. Informe uma descricao, se necessario.
6. Selecione uma ou mais pecas liberadas e conferidas.
7. Clique em **Montar PROD**.

### Status de PROD

- Rascunho;
- Aguardando CEM;
- Aguardando conferencia;
- Aguardando aprovacao;
- Aprovado;
- Devolvido;
- Entregue a Suprimentos;
- Entregue a Producao;
- Concluido;
- Cancelado.

### Conferir PROD

Disponivel para usuario com permissao de conferencia.

1. Localize o PROD com status **Aguardando conferencia**.
2. Clique em **Conferir**.

Depois da conferencia, o PROD avanca para aprovacao.

### Aprovar PROD

Disponivel para Gestor Tecnico, Administrador ou usuario com permissao especifica.

1. Localize o PROD com status **Aguardando aprovacao**.
2. Clique em **Aprovar**.

Regras:

- somente PROD aguardando aprovacao pode ser aprovado;
- PROD sem cadastro e conferencia no CEM nao deve avancar;
- aprovacao e etapa de controle gerencial.

## 20. Entregas para Suprimentos e Producao

Depois que o PROD esta aprovado, o sistema libera a entrega dos documentos aos departamentos.

### Entregar lista para Suprimentos

1. Localize o PROD aprovado.
2. Clique em **Entregar lista**.

O sistema registra uma entrega do tipo `lista_materiais` para o departamento `suprimentos`.

### Entregar ordem para Producao

1. Localize o PROD aprovado.
2. Clique em **Entregar ordem**.

O sistema registra uma entrega do tipo `ordem_producao` para o departamento `producao`.

### Confirmar recebimento

Usuarios de Suprimentos ou Producao visualizam as entregas pendentes na tela de PRODs.

Suprimentos pode confirmar somente listas de materiais.
Producao pode confirmar somente ordens de producao.

Para confirmar:

1. Acesse **PRODs**.
2. Localize a entrega com status **entregue**.
3. Clique em **Confirmar**.

## 21. Base de Duvidas

Tela geral: **Base de Duvidas**
Secao no contrato: **Duvidas**

O sistema mantem duas bases separadas:

- duvidas da Producao;
- duvidas de Obras/Instalacoes.

### Consultar duvidas

1. Acesse **Base de Duvidas**.
2. Consulte a base desejada.
3. Quando a duvida estiver vinculada a contrato, clique em **Abrir contrato** para navegar ao contexto.

### Registrar duvida

1. Acesse **Base de Duvidas** ou abra um contrato.
2. Na area **Nova duvida**, selecione a base.
3. Se desejar, vincule a um contrato.
4. Informe a categoria.
5. Escreva a duvida.
6. Clique em **Registrar duvida**.

### Responder duvida

1. Localize uma duvida aberta.
2. Preencha **Resposta**.
3. Marque **Publicar como frequente** se a resposta deve virar referencia recorrente.
4. Clique em **Responder**.

## 22. Indicadores e Relatorios

Tela: **Indicadores**
Rota: `/tecnico/relatorios`

Essa tela apresenta uma visao gerencial do modulo.

### Indicadores principais

- contratos;
- pecas contratadas;
- percentual liberado;
- PRODs devolvidos.

### Painel gerencial por contrato

Exibe por contrato:

- numero do contrato;
- cliente;
- percentual liberado;
- quantidade de correcoes;
- quantidade de duvidas.

Em celular, os dados aparecem em cards. Em desktop, aparecem em tabela.

### Planilha-resumo

O botao de planilha-resumo gera o arquivo a partir dos dados estruturados do sistema.

O arquivo final nao fica armazenado no Supabase. O sistema preserva os dados estruturados usados para gerar a saida quando aplicavel.

## 23. Configuracoes Tecnicas

Tela: **Configuracoes**
Rota: `/tecnico/configuracoes`

Restrita a usuarios com permissao de parametros ou permissoes.

A tela contem:

- **Seguranca e acessos**;
- **Cadastros e parametros**.

## 24. Seguranca e Acessos

Secao: **Seguranca e acessos**

Usada para liberar, inativar, reativar, excluir usuarios e vincular niveis de acesso.

### O que a tela mostra

- nome do usuario;
- e-mail;
- cargo/titulo, quando existir;
- identificador de autenticacao;
- status: ativo, inativo ou pendente;
- niveis de acesso vinculados;
- data da solicitacao de acesso, quando aplicavel.

### Liberar usuario pendente

1. Abra **Configuracoes**.
2. Localize o usuario pendente.
3. Escolha o nivel no seletor.
4. Clique em **Liberar acesso**.

### Remover nivel de acesso

1. Localize o usuario.
2. Em **Niveis vinculados**, clique no chip do perfil que deseja remover.
3. O sistema remove aquele vinculo.

### Inativar usuario

1. Localize o usuario.
2. Clique em **Inativar**.

Usuario inativo nao deve operar o sistema.

### Reativar usuario

1. Localize o usuario inativo.
2. Clique em **Reativar**.

### Excluir usuario

1. Localize o usuario.
2. Clique em **Excluir**.

Use exclusao apenas quando o cadastro realmente nao deve permanecer disponivel.

## 25. Cadastros e Parametros

Secao: **Cadastros e parametros**

Os parametros permitem ajustar listas e regras operacionais sem alterar o codigo da aplicacao.

### Tipos de visita

Define classificacoes usadas em visitas tecnicas.

Padrao inicial:

- Inicial;
- Medicao;
- Conferencia;
- Retorno;
- Correcao.

### Tipos de acao

Define classificacoes internas para acoes e pendencias.

Padrao inicial:

- Pendencia tecnica;
- Validacao;
- Acompanhamento;
- Solicitacao interna.

### Tipos de correcao

Define classificacoes usadas em correcoes.

Padrao inicial:

- Medida;
- Material;
- Projeto;
- Instalacao;
- Acabamento.

### Impactos

Define impactos possiveis para correcoes, bloqueios e riscos.

Padrao inicial:

- Baixo;
- Medio;
- Alto;
- Bloqueia producao;
- Bloqueia instalacao.

### Motivos de cancelamento

Define motivos padronizados para cancelamento de visitas e acoes.

Padrao inicial:

- Cliente indisponivel;
- Equipe indisponivel;
- Condicao de obra;
- Replanejamento interno.

### Prioridades

Define rotulos operacionais de prioridade.

Padrao inicial:

- baixa;
- normal;
- alta;
- urgente.

### Categorias de duvidas

Permite cadastrar categorias separadas por area:

- Producao;
- Obras/Instalacoes.

Cada categoria possui:

- area;
- nome;
- ordem;
- status ativo/inativo.

### Tipos de materiais

Define materiais usados em documentos e acompanhamento tecnico.

Padrao inicial:

- Aluminio;
- Vidro;
- Ferragens;
- Vedacao;
- Acessorios.

### Prazos internos

Parametros numericos usados para calculo e acompanhamento:

- Prazo Tecnico em dias uteis;
- Prazo Suprimentos em dias uteis;
- Prazo Producao em dias uteis.

Padrao inicial:

- Tecnico: 10 dias uteis;
- Suprimentos: 35 dias uteis;
- Producao: 15 dias uteis.

### Percentuais de risco

Define faixas de acompanhamento do contrato:

- Atencao;
- Risco;
- Atrasado.

Padrao inicial:

- Atencao: 70%;
- Risco: 90%;
- Atrasado: 100%.

### Feriados

Permite cadastrar feriados usados em calculos de dias uteis.

Campos:

- data;
- nome;
- escopo;
- cidade;
- UF;
- ativo/inativo.

Escopos:

- nacional;
- estadual;
- municipal.

### Parametros de relatorios

Define categorias de documentos e saidas tecnicas.

Padrao inicial:

- lista_materiais;
- ordem_producao;
- planilha_resumo;
- relatorio_visita.

### Parametros de notificacao

Define preferencias gerais de alerta.

Campos:

- intervalo de reenvio em horas;
- notificar pendencias de entrega.

### Como salvar listas

Para parametros em lista:

1. Abra o parametro desejado.
2. Edite os itens, normalmente um por linha.
3. Clique em **Salvar**.

### Como salvar prazos

1. Ajuste os valores numericos.
2. Clique em **Salvar prazos**.

### Como salvar percentuais de risco

1. Ajuste os percentuais.
2. Clique em **Salvar percentuais**.

### Como adicionar categoria de duvida

1. Selecione a area.
2. Informe a nova categoria.
3. Informe a ordem.
4. Marque **Ativa** se a categoria deve ser usada.
5. Clique em **Adicionar categoria**.

### Como adicionar feriado

1. Informe a data.
2. Informe o nome.
3. Selecione o escopo.
4. Preencha cidade e UF quando necessario.
5. Marque **Ativo**.
6. Clique em **Adicionar feriado**.

## 26. Uso em Celular

O sistema esta adaptado para visualizacao em celular.

### O que muda no mobile

- a navegacao principal vira barra superior rolavel;
- listas extensas aparecem em cards;
- tabelas permanecem disponiveis em telas maiores;
- botoes e campos usam altura adequada para toque;
- a tela de contratos mostra cards com resumo;
- pecas no detalhe do contrato aparecem como cards;
- o painel de seguranca mostra usuarios em cards;
- indicadores e relatorios aparecem em cards.

### Recomendacoes no celular

- use o celular preferencialmente em navegadores atualizados;
- para formularios longos, revise antes de salvar;
- em seletores multiplos, confirme se todos os itens desejados ficaram selecionados;
- em telas com muitos dados, use busca e filtros antes de rolar;
- apos salvar, aguarde o retorno visual do sistema antes de sair da tela.

## 27. Rotinas Recomendadas

### Rotina diaria do Tecnico

1. Abrir **Painel Tecnico**.
2. Verificar visitas do dia.
3. Verificar visitas aguardando relatorio.
4. Conferir pecas aguardando liberacao.
5. Verificar correcoes abertas.
6. Verificar PRODs aguardando conferencia.
7. Responder duvidas abertas.

### Rotina diaria do Gestor Tecnico

1. Abrir **Painel Tecnico**.
2. Priorizar acoes bloqueantes vencidas.
3. Avaliar correcoes criticas.
4. Conferir PRODs aguardando aprovacao.
5. Verificar contratos em risco.
6. Ajustar parametros quando houver mudanca operacional.

### Rotina do Administrador

1. Verificar notificacoes de cadastro pendente.
2. Acessar **Configuracoes**.
3. Liberar, recusar ou inativar usuarios.
4. Revisar perfis vinculados.
5. Conferir se parametros continuam coerentes com a operacao.

### Rotina de Suprimentos

1. Acessar **PRODs**.
2. Verificar listas entregues.
3. Confirmar recebimento das listas.
4. Registrar duvidas quando autorizado.

### Rotina da Producao

1. Acessar **PRODs**.
2. Verificar ordens entregues.
3. Confirmar recebimento das ordens.
4. Abrir duvidas na base de Producao quando necessario.

## 28. Regras de Negocio Importantes

### Primeira visita

A primeira visita depende de:

- pasta comercial recebida;
- reuniao de fechamento registrada;
- ausencia de acao bloqueante inicial aberta.

### Liberacao de peca

A peca so pode ser liberada quando:

- possui largura medida;
- possui altura medida;
- nao esta cancelada;
- nao possui correcao bloqueante aberta.

### Entrada no PROD

A peca so entra em PROD quando:

- esta liberada;
- esta cadastrada no CEM;
- esta conferida no CEM;
- nao esta em outro PROD ativo;
- nao possui correcao bloqueante aberta;
- nao esta cancelada.

### Aprovacao de PROD

Somente perfil autorizado pode aprovar PROD.

O PROD precisa estar aguardando aprovacao.

### Confirmacao por departamento

Suprimentos confirma listas de materiais.
Producao confirma ordens de producao.

### Arquivos que nao sao armazenados no Supabase

O sistema nao armazena no Supabase Storage:

- cadernos tecnicos digitalizados;
- fotos de obra;
- videos de obra;
- PDFs finais de listas geradas no CEM;
- PDFs finais de ordens de producao geradas no CEM;
- PDFs finais de relatorios de visita;
- arquivos finais de planilha-resumo.

O sistema armazena os dados estruturados e eventos operacionais, preservando rastreabilidade sem duplicar o servidor interno de arquivos.

## 29. Solucao de Problemas

### Nao consigo entrar

Verifique:

- se o e-mail esta correto;
- se a senha esta correta;
- se o cadastro foi confirmado por e-mail;
- se o Administrador ja liberou um nivel de acesso;
- se o usuario esta ativo.

### Criei cadastro, mas nao vejo o sistema

Isso e esperado antes da liberacao.

O fluxo correto e:

1. criar cadastro;
2. confirmar e-mail;
3. aguardar liberacao do Administrador;
4. entrar novamente.

### O link de confirmacao nao chegou

Verifique:

- caixa de entrada;
- spam;
- lixo eletronico;
- se o e-mail foi digitado corretamente.

Se necessario, o Administrador pode verificar o usuario no painel de autenticacao do Supabase.

### Aparece erro de Supabase no login ou cadastro

Isso normalmente indica variaveis de ambiente ausentes ou incorretas.

As variaveis principais sao:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `NEXT_PUBLIC_APP_URL`.

Em producao, elas devem estar configuradas no projeto da Vercel.

### Nao aparece uma tela no menu

Provavel causa:

- o perfil nao possui permissao para aquela tela;
- o usuario ainda esta sem nivel de acesso;
- o usuario esta inativo.

O Administrador deve revisar o usuario em **Configuracoes > Seguranca e acessos**.

### Nao aparece um botao de acao

Provavel causa:

- o perfil permite visualizar, mas nao permite executar aquela acao;
- o registro nao esta no status correto;
- alguma regra de negocio bloqueia o avanco.

Exemplos:

- botao de aprovar PROD so aparece para perfil autorizado e status correto;
- botao de gerar relatorio aparece para visita aguardando relatorio;
- formulario de liberar peca depende de permissao de liberacao.

### Nao consigo agendar primeira visita

Verifique se:

- a pasta comercial foi registrada;
- a reuniao de fechamento foi registrada;
- nao existe acao bloqueante inicial aberta.

### Nao consigo liberar uma peca

Verifique se:

- a peca tem largura e altura medidas;
- a peca nao esta cancelada;
- nao existe correcao bloqueante aberta para a peca.

### Uma peca nao aparece para montar PROD

Verifique se:

- a peca esta liberada;
- a peca esta cadastrada no CEM;
- a peca esta conferida no CEM;
- a peca nao esta vinculada a outro PROD ativo;
- a peca nao esta cancelada;
- nao existe correcao bloqueante aberta.

### Nao consigo confirmar entrega

Verifique se:

- a entrega esta com status entregue;
- seu perfil e o departamento correto;
- Suprimentos esta tentando confirmar uma lista de materiais;
- Producao esta tentando confirmar uma ordem de producao.

### PDF do contrato nao foi lido corretamente

Use a conferencia humana:

1. ajuste os dados do contrato;
2. ajuste as pecas;
3. adicione pecas faltantes;
4. remova pecas indevidas;
5. grave somente depois da revisao.

Se a extracao falhar completamente, use o cadastro manual autorizado.

### Notificacao nao desaparece

Comportamento esperado:

1. clicar no sino abre a lista;
2. clicar em uma notificacao abre o destino;
3. a notificacao e marcada como lida;
4. a notificacao sai da lista.

Se persistir, atualize a pagina e confira se a mesma notificacao ainda esta sem leitura.

### Dados nao salvaram

Verifique:

- se todos os campos obrigatorios foram preenchidos;
- se voce possui permissao;
- se o registro esta no status correto;
- se a conexao esta ativa;
- se a pagina exibiu mensagem de erro.

### Tela ruim no celular

Atualize a pagina e use o navegador em versao recente. As listas principais foram adaptadas para cards em celular.

Se uma tabela especifica ainda ficar larga, use a rolagem horizontal da area ou abra em tela maior.

## 30. Glossario

### Administrador

Usuario com acesso absoluto a plataforma.

### Acompanhamento Tecnico-Operacional

Perfil responsavel por ata, acoes, acompanhamento e agenda.

### CEM

ERP usado fora da plataforma. Nesta versao, o Modulo Tecnico registra manualmente cadastro e conferencia.

### Confirmacao

Registro de recebimento por Suprimentos ou Producao.

### Correcao bloqueante

Correcao que impede avanco de liberacao, PROD ou entrega.

### Correcao critica

Correcao destacada como risco operacional elevado.

### Dias corridos

Contagem de prazo considerando todos os dias.

### Dias uteis

Contagem de prazo ignorando sabados, domingos e feriados cadastrados.

### Liberacao

Momento em que a peca medida fica apta a seguir para controle de prazo e preparacao de PROD.

### Peca ativa

Peca nao excluida logicamente e nao cancelada.

### PROD

Lote tecnico de pecas liberadas, cadastradas e conferidas.

### RLS

Row Level Security do Supabase. Garante que o banco respeite regras por empresa, usuario e permissao.

### Snapshot

Copia estruturada dos dados usados em um evento, como relatorio, sem necessariamente salvar o arquivo final.

## 31. Matriz Resumida de Permissoes

| Permissao | O que permite |
| --- | --- |
| `technical.dashboard.view` | Visualizar Painel Tecnico |
| `technical.contracts.view` | Visualizar contratos tecnicos |
| `technical.contracts.import_pdf` | Importar contrato por PDF |
| `technical.contracts.manual_create` | Cadastrar contrato manualmente |
| `technical.contracts.edit` | Editar dados tecnicos do contrato |
| `technical.contracts.delete_request` | Solicitar exclusao protegida |
| `technical.financial.view` | Visualizar informacoes financeiras autorizadas |
| `technical.folder.receive` | Registrar recebimento da pasta comercial |
| `technical.meetings.manage` | Registrar reuniao de fechamento e ata |
| `technical.actions.view` | Visualizar acoes tecnicas |
| `technical.actions.manage` | Criar e atualizar acoes tecnicas |
| `technical.actions.reopen` | Reabrir acoes |
| `technical.followup.view` | Visualizar acompanhamento tecnico-operacional |
| `technical.followup.manage` | Registrar acompanhamento tecnico-operacional |
| `technical.visits.view` | Visualizar agenda e visitas |
| `technical.visits.manage` | Criar, registrar e atualizar visitas |
| `technical.visits.cancel` | Cancelar visitas |
| `technical.measurements.manage` | Registrar medicoes |
| `technical.pieces.edit_released` | Editar pecas ja liberadas |
| `technical.pieces.release` | Liberar pecas |
| `technical.reports.view` | Visualizar indicadores e relatorios |
| `technical.reports.generate` | Gerar relatorio de visita e planilha-resumo |
| `technical.corrections.view` | Visualizar correcoes |
| `technical.corrections.manage` | Criar e encerrar correcoes |
| `technical.prods.view` | Visualizar PRODs |
| `technical.prods.manage` | Montar e gerenciar PRODs |
| `technical.prods.check` | Conferir PRODs |
| `technical.prods.approve` | Aprovar PRODs |
| `technical.prods.change_approved` | Alterar PROD aprovado |
| `technical.deliveries.suprimentos_confirm` | Confirmar listas por Suprimentos |
| `technical.deliveries.producao_confirm` | Confirmar ordens por Producao |
| `technical.doubts.view` | Consultar bases de duvidas |
| `technical.doubts.manage` | Criar, responder e publicar duvidas frequentes |
| `technical.audit.view` | Consultar auditoria |
| `technical.settings.manage` | Gerenciar parametros tecnicos |
| `technical.permissions.manage` | Gerenciar usuarios, perfis e permissoes |

## 32. Procedimentos Rapidos

### Cadastrar e liberar um novo usuario

1. Usuario acessa `/cadastro`.
2. Usuario preenche nome, e-mail, telefone, senha e confirmacao.
3. Usuario confirma e-mail.
4. Administrador abre **Configuracoes**.
5. Administrador localiza usuario pendente.
6. Administrador seleciona o perfil.
7. Administrador clica em **Liberar acesso**.
8. Usuario entra novamente pelo login.

### Importar contrato por PDF

1. Acesse **Contratos**.
2. Selecione o PDF.
3. Clique em **Conferir extracao**.
4. Revise contrato.
5. Revise pecas.
6. Corrija divergencias.
7. Clique em **Confirmar e gravar contrato**.

### Iniciar fluxo de contrato

1. Abra o contrato.
2. Registre pasta comercial.
3. Registre reuniao de fechamento.
4. Crie acoes necessarias.
5. Resolva acoes bloqueantes iniciais.
6. Agende a primeira visita.

### Registrar visita e relatorio

1. Agende a visita.
2. Apos a obra, registre realizacao.
3. Informe resultado.
4. Gere relatorio.
5. Baixe ou imprima o PDF gerado localmente.

### Medir, liberar e preparar PROD

1. Abra contrato.
2. Va ate **Pecas**.
3. Registre medicao.
4. Libere a peca.
5. Marque cadastro no CEM.
6. Marque conferencia no CEM.
7. Monte PROD com as pecas elegiveis.

### Aprovar e entregar PROD

1. Confira o PROD.
2. Aprove o PROD.
3. Entregue lista para Suprimentos.
4. Entregue ordem para Producao.
5. Aguarde confirmacao dos departamentos.

### Tratar correcao critica

1. Registre a correcao como critica.
2. Marque como bloqueante quando impedir avanco.
3. Defina prazo e responsavel.
4. Acompanhe pelo Painel Tecnico.
5. Encerre somente apos resolucao.

### Responder duvida

1. Acesse **Base de Duvidas**.
2. Localize a duvida aberta.
3. Informe resposta clara e objetiva.
4. Marque como frequente, se a resposta deve virar referencia.
5. Clique em **Responder**.

## 33. Observacoes Finais

O Modulo Tecnico deve ser usado como fonte principal de verdade do processo tecnico.

O sistema nao substitui o armazenamento fisico ou servidor interno de arquivos para documentos finais, fotos, videos e PDFs externos. Ele registra o fluxo, os dados estruturados, os responsaveis, prazos, status, confirmacoes e historico.

Sempre que uma decisao tecnica gerar impacto operacional, registre no contrato, na acao, na correcao, no PROD ou na base de duvidas correspondente. Isso garante rastreabilidade e reduz dependencia de conversas fora do sistema.
