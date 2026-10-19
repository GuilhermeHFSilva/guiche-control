# 📚 Guia Definitivo e Explicação de Ponta a Ponta: SSE Queue Flow

Este documento apresenta uma análise minuciosa, técnica e didática de todo o projeto **SSE Queue Flow (guiche-control)**. O objetivo é fornecer uma compreensão profunda da arquitetura, do fluxo de dados em tempo real via **Server-Sent Events (SSE)**, do banco de dados relacional e de **cada arquivo, classe, função e método** que compõem o sistema (excluindo apenas os testes automatizados).

---

## 📑 Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Entendendo o Server-Sent Events (SSE) vs Polling vs WebSocket](#2-entendendo-o-server-sent-events-sse)
3. [Modelagem e Banco de Dados (`database/`)](#3-modelagem-e-banco-de-dados-database)
4. [Configurações e Inicialização do Servidor (`src/`)](#4-configurações-e-inicialização-do-servidor)
5. [Constantes e Hierarquia de Erros (`src/constants/` e `src/errors/`)](#5-constantes-e-hierarquia-de-erros)
6. [Middlewares do Express (`src/middlewares/`)](#6-middlewares-do-express)
7. [Camada de Acesso a Dados (`src/repositories/`)](#7-camada-de-acesso-a-dados-repositories)
8. [Camada de Regras de Negócio e Serviços (`src/services/`)](#8-camada-de-regras-de-negócio-e-serviços-services)
9. [Controladores da API (`src/controllers/`)](#9-controladores-da-api-controllers)
10. [Roteamento da Aplicação (`src/routes/`)](#10-roteamento-da-aplicação-routes)
11. [Frontend: Telas, Lógica e Estilização (`public/`)](#11-frontend-telas-lógica-e-estilização-public)
12. [Ciclo de Vida de uma Senha: Passo a Passo Completo](#12-ciclo-de-vida-de-uma-senha-passo-a-passo-completo)

---

## 1. Visão Geral da Arquitetura

O **SSE Queue Flow** é um sistema completo de gestão de filas e atendimento presencial projetado sob os princípios de **Clean Architecture**, **Single Responsibility Principle (SRP)** e **baixa latência**.

```
+---------------------------------------------------------------------------------+
|                                    NAVEGADOR                                    |
|                                                                                 |
|   [Totem Touch]             [Painel Atendente]                [Painel TV]       |
|  tela3-totem.html          tela1-atendente.html              tela2-tv.html      |
|    (totem.js)                 (atendente.js)                    (tv.js)         |
+---------+---------------------------+------------------------------+------------+
          |                           |                              ^
     POST /senhas/emissao        POST /atendimento/proximo           | SSE Stream
          |                           |                              | (push unidirecional)
          v                           v                              |
+--------------------------------------------------------------------+------------+
|                             BACKEND EXPRESS                                     |
|                                                                                 |
|  [Routes]         --> [Controllers]    --> [Services]      --> [SSEService] ----+
|   - atendimento        - guiche             - fila.service      (EventStream:   |
|   - senhas             - senha              - atendimento.service   CONNECTED,  |
|   - guiches            - sse                - sse.service           QUEUE_UPDATE|
|                                                  |                  SENHA_CHAMADA|
|                                                  v                  CALL_TICKET)|
|                                            [Repositories]                       |
|                                             - senha, guiche,                    |
|                                               categoria, atendimento            |
|                                                  |                              |
|                                                  v                              |
|                                      [SQLite (DatabaseSync)]                    |
|                                          queue.db (WAL)                         |
+---------------------------------------------------------------------------------+
```

### Principais Destaques Arquiteturais:
- **Separação de Camadas**: Rotas apenas direcionam requisições; Controllers apenas extraem dados e respondem HTTP; Services orquestram regras de negócio; Repositories executam SQL puro.
- **Inversão e Injeção de Dependência**: Os serviços e repositórios recebem suas dependências no construtor com valores padrão, permitindo execução isolada ou com banco em memória.
- **Concorrência Segura**: O SQLite opera com `PRAGMA journal_mode = WAL` (Write-Ahead Logging) e a chamada de senhas usa **claim atômico condicional** (`UPDATE ... WHERE status = 'AGUARDANDO'`), impedindo que dois atendentes chamem o mesmo bilhete simultaneamente.

---

## 2. Entendendo o Server-Sent Events (SSE)

### Por que SSE e não Polling ou WebSocket?
1. **Polling HTTP Tradicional**: O cliente faz requisições `GET /api/status` a cada 1 ou 2 segundos.
   - *Desvantagens*: Desperdiça banda de rede, processamento de CPU, satura conexões HTTP com respostas vazias (`304 Not Modified` ou sem alterações) e gera atraso perceptível de atualização.
2. **WebSockets (`ws://`)**: Canal bidirecional full-duplex sobre protocolo TCP dedicado.
   - *Desvantagens para este cenário*: Complexidade desnecessária. A TV e o totem não precisam enviar mensagens contínuas em tempo real via socket — eles apenas **recebem** dados ou enviam ações pontuais via simples HTTP POST. WebSockets também exigem proxies especiais, sofrem com firewalls corporativos e demandam heartbeat/reconexão manual complexa.
3. **Server-Sent Events (`text/event-stream`)**:
   - Funciona sobre o próprio **HTTP/1.1** ou **HTTP/2**.
   - É **unidirecional** (servidor -> cliente), ideal para notificações, dashboards e painéis de TV.
   - O navegador possui suporte nativo através da API `EventSource`, que gerencia reconexões automáticas sem biblioteca externa.
   - O formato de transmissão é texto puro estruturado em linhas (`event: ...\ndata: ...\n\n`).

---

## 3. Modelagem e Banco de Dados (`database/`)

O projeto utiliza **SQLite** nativo através do módulo experimental oficial do Node.js (`node:sqlite`), sem bibliotecas de terceiros como `better-sqlite3` ou ORMs pesados.

### 📄 `database/schema.sql`
Define a estrutura física das tabelas com constraints de integridade referencial:

1. **`CATEGORIA_SENHA`**: Define os tipos de atendimento e prioridades.
   - `id_categoria` (INTEGER PK AUTOINCREMENT): Identificador único da categoria.
   - `codigo_prefixo` (VARCHAR(5) NOT NULL UNIQUE): Letra identificadora (`P` para Preferencial, `C` para Convencional, `E` para Exames).
   - `nome_categoria` (VARCHAR(50) NOT NULL): Descrição por extenso.
   - `nivel_prioridade` (INTEGER NOT NULL): Número ordinal que determina a precedência na fila (1 = maior prioridade).
   - `descricao` (TEXT): Informações ao público (ex: critérios legais de prioridade).
   - `ativo` (BOOLEAN DEFAULT 1): Flag lógico de ativação.

2. **`GUICHE`**: Cadastra as posições físicas de atendimento.
   - `id_guiche` (INTEGER PK AUTOINCREMENT): Identificador único.
   - `numero_guiche` (INTEGER NOT NULL UNIQUE): Número exibido na TV e no painel (ex: Guichê 1, Guichê 2).
   - `nome_atendente` (VARCHAR(100)): Nome do funcionário operando o guichê.
   - `status_operacional` (VARCHAR(20) DEFAULT 'DISPONIVEL'): Estado (`DISPONIVEL`, `EM_ATENDIMENTO`).
   - `data_ultimo_acesso` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP): Auditoria de atividade.

3. **`SENHA`**: Registra cada bilhete emitido pelo totem.
   - `id_senha` (INTEGER PK AUTOINCREMENT): Identificador sequencial absoluto.
   - `id_categoria` (INTEGER NOT NULL FK): Chave estrangeira para `CATEGORIA_SENHA`.
   - `numero_sequencial` (INTEGER NOT NULL): Número diário sequencial (reinicia a cada dia por categoria).
   - `codigo_senha` (VARCHAR(10) NOT NULL): Código formatado exibido ao cliente (ex: `P-001`, `C-014`).
   - `status_senha` (VARCHAR(20) DEFAULT 'AGUARDANDO'): Estado (`AGUARDANDO`, `EM_ATENDIMENTO`, `FINALIZADA`, `CANCELADO_AUSENCIA`).
   - `data_hora_emissao` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP): Momento exato em que o cliente retirou o bilhete.

4. **`ATENDIMENTO`**: Registra a execução de um chamado e métricas de tempo.
   - `id_atendimento` (INTEGER PK AUTOINCREMENT): Identificador do registro de atendimento.
   - `id_senha` (INTEGER NOT NULL FK): Referência à senha atendida.
   - `id_guiche` (INTEGER NOT NULL FK): Referência ao guichê que atendeu.
   - `data_hora_chamada` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP): Momento da chamada no painel.
   - `data_hora_inicio` (TIMESTAMP): Início do atendimento presencial.
   - `data_hora_fim` (TIMESTAMP): Finalização do atendimento.
   - `tempo_espera_segundos` (INTEGER): Diferença calculada entre a emissão da senha e a chamada.
   - `duracao_atendimento_segundos` (INTEGER): Tempo gasto pelo atendente até clicar em Finalizar.

5. **`PAINEL_MONITOR`**: Cadastra dispositivos clientes de monitoramento (TVs, totens).
   - `id_painel`, `identificador_sala`, `ip_dispositivo`, `tipo_exibicao`, `status_conexao_sse`, `ultima_sincronizacao`.

### 📄 `database/seeds.sql`
Insere dados iniciais idempotentes (`INSERT OR IGNORE`):
- 3 categorias: `P` (Atendimento Preferencial - prioridade 1), `C` (Atendimento Convencional - prioridade 2) e `E` (Entregas e Exames - prioridade 3).
- 4 guichês operacionais: Ana Souza (Guichê 1), Marcos Oliveira (Guichê 2), Carlos Eduardo (Guichê 3) e Juliana Lima (Guichê 4).
- 2 monitores pré-configurados (TV da Recepção e Totem 1).

---

## 4. Configurações e Inicialização do Servidor

### 📄 `src/config/env.js`
Centraliza e valida o carregamento de variáveis de ambiente usando `dotenv`.
- **Propriedades exportadas em objeto imutável (`Object.freeze`)**:
  - `PORT`: Porta TCP do servidor (padrão `3000`).
  - `NODE_ENV`: Ambiente de execução (`development`, `production`, `test`).
  - `DB_PATH`: Caminho absoluto do arquivo SQLite (`database/queue.db`) ou `:memory:` para testes.
  - `isProduction`: Booleano facilitador se ambiente é produção.
  - `isTest`: Booleano indicando se roda em modo de teste.

### 📄 `src/config/database.js`
Gerencia a conexão SQLite com suporte tanto a arquivo em disco quanto a banco em memória.
- **Funções exportadas**:
  - `createDatabase(databasePath)`:
    - Cria o diretório pai caso não exista (quando não for `:memory:`).
    - Instancia `new DatabaseSync(databasePath)`.
    - Ativa integridade de chaves estrangeiras: `PRAGMA foreign_keys = ON;`.
    - Ativa o modo de log de alta performance: `PRAGMA journal_mode = WAL;`.
    - Invoca `initDatabase(dbInstance)` para aplicar schemas e seeds.
    - Retorna a instância ativa do banco de dados.
  - `initDatabase(dbInstance)`:
    - Lê e executa o conteúdo de `schema.sql` e `seeds.sql`.
    - Emite log de inicialização apenas se não estiver em contexto de testes automatizados.
  - `closeDatabase(dbInstance)`:
    - Executa o encerramento seguro (`dbInstance.close()`).
  - Exportação padrão (`defaultDb`): Instância singleton criada imediatamente para a aplicação.

### 📄 `src/app.js`
Configura a pipeline do Express:
- Aplica `cors()`, `express.json()` e `express.urlencoded()`.
- Registra `express.static(publicDir)` para servir HTML, CSS, JS e áudios diretamente.
- Expõe `/events` como alias direto para a conexão SSE.
- Conecta o roteador principal em `/api` (`src/routes/index.js`).
- Disponibiliza rotas limpas e amigáveis para os navegadores:
  - `GET /atendente` -> Entrega `tela1-atendente.html`
  - `GET /tv` -> Entrega `tela2-tv.html`
  - `GET /totem` -> Entrega `tela3-totem.html`
- Conecta os middlewares finais `notFoundHandler` e `errorHandler`.

### 📄 `src/server.js`
Ponto de entrada que coloca a aplicação no ar e implementa **Graceful Shutdown**:
- `server = app.listen(env.PORT, ...)`: Inicia a escuta na porta configurada e exibe um banner informativo no console com os links de cada tela.
- `gracefulShutdown(signal)`:
  - Captura os sinais do sistema operacional (`SIGINT` via Ctrl+C, `SIGTERM` em containers Docker/Kubernetes).
  - Executa `sseService.closeAll()` para avisar e fechar todas as conexões persistentes abertas.
  - Executa `server.close()` para parar de aceitar novas conexões HTTP.
  - Fecha a base de dados via `closeDatabase()`.
  - Configura um timer forçado de 5 segundos (`setTimeout(..., 5000).unref()`) para garantir que o processo encerre mesmo se alguma conexão travar.

---

## 5. Constantes e Hierarquia de Erros

### 📄 `src/constants/index.js`
Evita *magic strings* e números mágicos espalhados pelo código:
- `CATEGORIAS`: Mapeamento das 3 categorias com seus respectivos IDs, prefixos, nomes e prioridades.
- `STATUS_SENHA`: Enum dos status (`AGUARDANDO`, `EM_ATENDIMENTO`, `FINALIZADA`, `CANCELADO_AUSENCIA`).
- `STATUS_GUICHE`: Enum dos guichês (`DISPONIVEL`, `EM_ATENDIMENTO`).
- `SSE_EVENTS`: Nomes dos eventos transmitidos pelo SSE:
  - `CONNECTED`: Disparado na conexão inicial de um cliente.
  - `QUEUE_UPDATE`: Disparado quando os números da fila mudam (emissão ou finalização).
  - `SENHA_CHAMADA`: Disparado quando um atendente chama uma senha para a TV tocar e exibir.
  - `CALL_TICKET`: Evento alternativo para compatibilidade com outros clientes.

### 📄 `src/errors/`
Hierarquia de erros semânticos orientada a objetos:
- `AppError.js`: Classe base herdada de `Error`. Define `statusCode` (padrão 500), `isOperational = true` (identifica erros conhecidos de negócio vs exceções não tratadas de sistema) e captura da pilha de execução (`captureStackTrace`).
- `BadRequestError.js`: Erros de validação (HTTP 400).
- `NotFoundError.js`: Recurso não localizado (HTTP 404).
- `ConflictError.js`: Conflito de estado (HTTP 409).
- `index.js`: Fachada para exportar todas as classes juntas.

---

## 6. Middlewares do Express (`src/middlewares/`)

### 📄 `src/middlewares/asyncHandler.js`
- `asyncHandler(fn)`: Envolve controladores assíncronos em um bloco `Promise.resolve(fn(req, res, next)).catch(next)`. Isso evita a necessidade de escrever blocos `try/catch` manuais em cada método de controller.

### 📄 `src/middlewares/notFoundHandler.js`
- `notFoundHandler(req, res, next)`: Captura qualquer requisição para rotas não mapeadas no Express e dispara um `NotFoundError` com a URL e método informados, repassando ao `errorHandler`.

### 📄 `src/middlewares/errorHandler.js`
- `errorHandler(err, req, res, next)`:
  - Identifica se o erro é operacional (`err.isOperational`).
  - Se for um erro desconhecido (bug/exceção não capturada), exibe log com `console.error('💥 [Erro Não Tratado]:', err)`.
  - Em ambiente de produção, mascara a mensagem de erros não operacionais para `"Erro interno no servidor."`, evitando vazamento de dados sensíveis.
  - Em ambiente de desenvolvimento, anexa o `stack` da exceção no JSON para facilitar o debug.
  - Retorna a resposta HTTP formatada `{ sucesso: false, mensagem: ... }`.

---

## 7. Camada de Acesso a Dados (`src/repositories/`)

Utiliza o método síncrono `prepare()` do SQLite nativo para compilar instruções SQL pré-processadas contra SQL Injection.

### 📄 `src/repositories/categoria.repository.js`
- **`findAll()`**: Retorna todas as categorias ativas ordenadas por prioridade (`ORDER BY nivel_prioridade ASC`).
- **`findByPrefix(prefix)`**: Busca uma categoria pelo prefixo (`P`, `C` ou `E`). Usa `LIMIT 1`.
- **`findById(id)`**: Busca uma categoria pelo seu ID numérico.
- **`findByName(name)`**: Busca categoria usando `LIKE %termo%` com comparação insensível a maiúsculas/minúsculas.

### 📄 `src/repositories/guiche.repository.js`
- **`findAll()`**: Retorna todos os guichês ordenados pelo número do guichê.
- **`findByNumero(numeroGuiche)`**: Busca os dados de um guichê pelo seu número físico.
- **`findById(idGuiche)`**: Busca pelo ID da chave primária.
- **`updateOperador(idGuiche, nomeAtendente, statusOperacional)`**: Atualiza o nome do atendente em serviço, define o status (`EM_ATENDIMENTO`) e atualiza o `data_ultimo_acesso = CURRENT_TIMESTAMP`. Retorna o guichê atualizado.
- **`updateStatus(idGuiche, statusOperacional)`**: Atualiza somente o status operacional e timestamp. Retorna o registro atualizado.

### 📄 `src/repositories/atendimento.repository.js`
- **`create({ id_senha, id_guiche })`**:
  - Insere um novo registro na tabela `ATENDIMENTO`.
  - **Destaque matemático**: Calcula o tempo de espera real em segundos diretamente no SQLite usando funções de data juliana: `CAST((julianday('now') - julianday(s.data_hora_emissao)) * 86400 AS INTEGER)`.
  - Retorna o atendimento criado chamando `this.findById(info.lastInsertRowid)`.
- **`findById(idAtendimento)`**: Executa consulta com `JOIN` entre `ATENDIMENTO`, `SENHA` e `GUICHE` para retornar dados consolidados (código da senha, status, número do guichê e nome do atendente).
- **`findUltimoAtendimentoPorGuiche(idGuiche)`**: Retorna o atendimento mais recente chamado por determinado guichê (`ORDER BY id_atendimento DESC LIMIT 1`).
- **`finalizarAtendimento(idAtendimento)`**:
  - Registra `data_hora_fim = CURRENT_TIMESTAMP`.
  - Calcula a duração real do atendimento em segundos: `CAST((julianday('now') - julianday(COALESCE(data_hora_inicio, data_hora_chamada))) * 86400 AS INTEGER)`.
  - Retorna o atendimento com os dados consolidados.
- **`countAtendimentosHojePorGuiche(idGuiche)`**: Conta quantos atendimentos foram iniciados pelo guichê na data de hoje (`DATE(data_hora_chamada, 'localtime') = DATE('now', 'localtime')`).

### 📄 `src/repositories/senha.repository.js`
- **`getProximoNumeroSequencial(idCategoria)`**:
  - Obtém o próximo número do dia para aquela categoria específica: `SELECT COALESCE(MAX(numero_sequencial), 0) + 1 FROM SENHA WHERE id_categoria = ? AND DATE(data_hora_emissao, 'localtime') = DATE('now', 'localtime')`.
- **`create({ id_categoria, numero_sequencial, codigo_senha })`**:
  - Insere a senha no banco com status inicial `'AGUARDANDO'` e timestamp atual. Retorna a senha recém-criada.
- **`findById(idSenha)`**:
  - Busca a senha com `JOIN` na tabela `CATEGORIA_SENHA`.
- **`findNextPendingTicket()`**:
  - **Coração da Prioridade Legal**: Encontra a próxima senha que deve ser chamada segundo a lei.
  - Ordenação: `ORDER BY c.nivel_prioridade ASC, s.id_senha ASC LIMIT 1`. Isso garante que todas as senhas Preferenciais (prioridade 1) sejam atendidas antes das Convencionais (prioridade 2), respeitando a ordem de chegada (menor `id_senha`).
- **`claimTicketAtomic(idSenha, novoStatus, statusEsperado)`**:
  - **Mecanismo Anti-Race Condition**: Executa `UPDATE SENHA SET status_senha = ? WHERE id_senha = ? AND status_senha = ?`.
  - Se dois atendentes clicarem em "Chamar Próximo" no mesmo milissegundo, ambos podem ler a mesma senha candidata, mas apenas **um** conseguirá alterar o status de `'AGUARDANDO'` para `'EM_ATENDIMENTO'`. A verificação `result.changes > 0` valida se a alteração foi de fato realizada pelo atendente atual.
- **`updateStatus(idSenha, statusSenha)`**: Atualiza o status de uma senha específica.
- **`getPosicaoFila(idSenha, idCategoria)`**:
  - Calcula a colocação do cliente na fila contando quantas senhas aguardando da mesma categoria possuem `id_senha <= ?`.
- **`getQueueStats()`**:
  - **Otimização de Performance**: Em vez de fazer 4 consultas `COUNT(*)` separadas, executa uma **única query agregada** com expressões condicionais:
    ```sql
    SELECT 
      COUNT(*) as totalAguardando,
      COALESCE(SUM(CASE WHEN c.codigo_prefixo = 'P' THEN 1 ELSE 0 END), 0) as filaPreferencial,
      COALESCE(SUM(CASE WHEN c.codigo_prefixo = 'C' THEN 1 ELSE 0 END), 0) as filaConvencional,
      COALESCE(SUM(CASE WHEN c.codigo_prefixo = 'E' THEN 1 ELSE 0 END), 0) as filaExames
    FROM SENHA s
    JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
    WHERE s.status_senha = 'AGUARDANDO'
    ```
  - Calcula a estimativa de tempo médio de espera em minutos (regra de 2,5 minutos por pessoa aguardando).
- **`getUltimasChamadas(limit = 5)`**:
  - Retorna o histórico dos últimos atendimentos para alimentar o painel da TV.
- **`getFilaPendenteDetalhada()`**:
  - Retorna a lista detalhada de clientes na fila com cálculo em tempo real dos minutos que cada um já aguardou (`(julianday('now') - julianday(s.data_hora_emissao)) * 1440`).

---

## 8. Camada de Regras de Negócio e Serviços (`src/services/`)

### 📄 `src/services/sse.service.js`
O motor central do Server-Sent Events, operando em memória.
- **Estrutura interna**:
  - `this.clients = new Set()`: Coleção contendo todos os clientes conectados (TVs, atendentes, totens).
  - `this.nextClientId = 1`: Sequencial incremental para identificar cada cliente.
  - `this.heartbeatInterval = null`: Referência ao temporizador de ping periódico.
- **Métodos**:
  - `addClient(req, res, metadata = {})`:
    - Define os cabeçalhos obrigatórios do protocolo SSE:
      - `Content-Type: text/event-stream`
      - `Cache-Control: no-cache, no-transform`
      - `Connection: keep-alive`
      - `X-Accel-Buffering: no` (evita que o proxy reverso Nginx faça buffer da stream).
    - Envia comentário inicial HTTP: `: SSE Connection Established\n\n`.
    - Monta o objeto `client` contendo `id`, `res`, `tipo`, `guiche`, `ip` e data de conexão.
    - Adiciona ao `Set`.
    - Registra listeners em `req.on('close')` e `res.on('error')` para limpar o cliente imediatamente caso o navegador feche a aba ou perca conexão.
    - Dispara evento `CONNECTED` exclusivo para o cliente recém-conectado.
  - `sendToClient(client, eventName, data)`:
    - Escreve no formato padronizado do SSE:
      ```
      event: NOME_DO_EVENTO\n
      data: {"json": "aqui"}\n\n
      ```
    - Se a escrita falhar, chama `removeClient(client)`.
  - `removeClient(client)`: Remove do conjunto e finaliza a resposta `client.res.end()`.
  - `broadcast(eventName, data)`:
    - Percorre todos os clientes em `this.clients` e envia a mesma mensagem simultaneamente.
    - Captura clientes inativos ou desconectados abruptamente e os remove do conjunto.
  - `startHeartbeat(intervalMs = 20000)`:
    - Dispara um comentário `: heartbeat YYYY-MM-DDTHH:mm:ss.sssZ\n\n` a cada 20 segundos.
    - Garante que roteadores, firewalls e balanceadores não encerrem a conexão por inatividade (timeout).
    - **JavaScript Pro**: Utiliza `.unref()` no timer do Node.js para que o intervalo de heartbeat não impeça o término do processo quando o servidor precisar ser encerrado.
  - `stopHeartbeat()`: Interrompe o temporizador do heartbeat.
  - `closeAll()`: Para o heartbeat, envia encerramento para cada cliente e limpa o `Set`.
  - `getActiveClientsCount()`: Retorna a quantidade de conexões ativas.

### 📄 `src/services/fila.service.js`
Coordena toda a lógica operacional da fila de atendimento.
- **Métodos Públicos**:
  - `resolverCategoria(categoriaIdentificador)`:
    - Normaliza o identificador da categoria recebido (aceita prefixo de 1 letra ou nomes parciais como `'PREFERENCIAL'`, `'EXAMES'`, `'CONVENCIONAL'`).
  - `gerarSenha({ categoria, totemId })`:
    - Resolve a categoria no repositório.
    - Obtém o próximo número sequencial do dia.
    - Formata o código legível (ex: `P-001`, `C-023`).
    - Grava a senha no banco com status `AGUARDANDO`.
    - Calcula a posição atual na fila.
    - Dispara `_notificarAtualizacaoFila()` via broadcast SSE (`QUEUE_UPDATE`) para todos os painéis.
    - Retorna o payload completo com dados do bilhete e hora da emissão.
  - `chamarProximaSenha({ guicheId, atendenteId })`:
    - Valida o guichê via `_obterGuicheValido()`.
    - Obtém a próxima senha legalmente prioritária via `_obterProximaSenhaDisponivel()`.
    - Cria o atendimento no banco calculando o tempo de espera do cliente.
    - Atualiza o guichê para `EM_ATENDIMENTO` com o nome do operador.
    - Obtém estatísticas atualizadas da fila e as últimas 5 chamadas.
    - Monta o payload de chamada e dispara os eventos SSE:
      - `SENHA_CHAMADA` e `CALL_TICKET`: A TV recebe, toca áudio e exibe em tela cheia.
      - `QUEUE_UPDATE`: Todos os atendentes veem a fila diminuir instantaneamente.
    - Retorna o resultado ao atendente com o total de atendimentos realizados hoje por ele.
  - `rechamarSenha({ guicheId })`:
    - Busca o último atendimento efetuado por aquele guichê.
    - Reenvia o evento SSE `SENHA_CHAMADA` com a flag `isRechamada: true`, fazendo com que a TV re-anuncie a mesma senha.
  - `marcarAusente({ guicheId })`:
    - Busca o atendimento em andamento no guichê.
    - Altera o status da senha para `CANCELADO_AUSENCIA`.
    - Libera o guichê de volta para o status `DISPONIVEL`.
    - Dispara broadcast de atualização da fila via SSE.
  - `finalizarAtendimento({ guicheId })`:
    - Localiza o atendimento atual em andamento.
    - Executa `finalizarAtendimento` no repositório (calculando a duração do atendimento em segundos).
    - Marca a senha como `FINALIZADA`.
    - Libera o status do guichê para `DISPONIVEL`.
    - Notifica a fila via broadcast SSE.
- **Métodos Privados / Auxiliares**:
  - `_obterGuicheValido(identificadorGuiche)`: Garante que o guichê existe; lança `BadRequestError` ou `NotFoundError` caso contrário.
  - `_obterProximaSenhaDisponivel()`: Loop atômico que localiza a próxima senha prioritária e tenta reservar com `claimTicketAtomic`. Se outro atendente tiver reservado no mesmo instante, o loop busca a próxima, garantindo consistência total.
  - `_formatarNomeAtendente(atendenteId, nomePadrao)`: Ajusta o nome do operador para exibição.
  - `_criarPayloadChamada(...)`: Padroniza o JSON emitido para o SSE.
  - `_notificarAtualizacaoFila()`: Agrupa os dados e faz o broadcast do evento `QUEUE_UPDATE`.

### 📄 `src/services/atendimento.service.js`
Serviço de suporte para consultas agregadas e relatórios de painel.
- **`getStatusFila()`**: Consolida em um único objeto:
  - Estatísticas gerais (`stats`).
  - Lista completa de senhas aguardando com minutos de espera (`pendentes`).
  - As 5 últimas chamadas (`ultimasChamadas`).
  - Lista de todos os guichês (`guiches`).
- **`getGuicheInfo(numeroGuiche)`**: Retorna dados detalhados de um guichê específico, seu último atendimento e o total de atendimentos realizados por ele no dia atual.

---

## 9. Controladores da API (`src/controllers/`)

Os controladores são mantidos enxutos e sem acoplamento direto com o banco, respeitando o princípio de responsabilidade única.

### 📄 `src/controllers/sse.controller.js`
- `connectStream(req, res)`:
  - Extrai `tipo` (ex: `'publico'` ou `'atendente'`) e `guiche` dos parâmetros da query string (`req.query`).
  - Chama `sseService.addClient(req, res, { tipo, guiche })` para manter o stream aberto.

### 📄 `src/controllers/senha.controller.js`
- `emissao(req, res, next)`:
  - Extrai `categoria` e `totemId` do corpo (`req.body`).
  - Executa `filaService.gerarSenha(...)` e retorna status HTTP 201 com os dados do bilhete.
- `listarStatusFila(req, res, next)`:
  - Chama `atendimentoService.getStatusFila()`.
  - Retorna status HTTP 200 com a visão geral do sistema.

### 📄 `src/controllers/guiche.controller.js`
- `proximo(req, res, next)`: Extrai guichê e atendente; invoca `filaService.chamarProximaSenha(...)`; responde HTTP 200.
- `rechamar(req, res, next)`: Invoca `filaService.rechamarSenha(...)`; responde HTTP 200.
- `ausente(req, res, next)`: Invoca `filaService.marcarAusente(...)`; responde HTTP 200.
- `finalizar(req, res, next)`: Invoca `filaService.finalizarAtendimento(...)`; responde HTTP 200.
- `listarGuiches(req, res, next)`: Retorna a lista de todos os guichês cadastrados e seus atendentes.
- `obterGuiche(req, res, next)`: Retorna os dados completos do guichê solicitado pela URL (`req.params.id`).
- `_extrairGuicheId(body)`: Método auxiliar para extrair e converter o identificador do guichê recebido no body.

---

## 10. Roteamento da Aplicação (`src/routes/`)

As rotas são estruturadas modularmente:

- **`src/routes/index.js`**: Roteador mestre da API:
  - Monta `/atendimento` através de `atendimento.routes.js`.
  - Monta `/senhas` através de `senha.routes.js`.
  - Monta `/guiches` através de `guiche.routes.js`.
- **`src/routes/sse.routes.js`**: Define `GET /stream` chamando `sseController.connectStream`.
- **`src/routes/senha.routes.js`**:
  - `POST /emissao` e `POST /gerar`: Emissão de nova senha.
  - `POST /chamar`: Alias para chamar próxima senha.
  - `GET /status`: Consulta status e estatísticas da fila.
- **`src/routes/guiche.routes.js`**:
  - `GET /`: Lista todos os guichês.
  - `GET /:id`: Consulta guichê específico.
  - `POST /proximo`: Chama próxima senha.
  - `POST /rechamar`: Rechama senha atual.
  - `POST /ausente`: Marca cliente ausente.
  - `POST /finalizar`: Finaliza atendimento.
- **`src/routes/atendimento.routes.js`**:
  - `GET /stream`: Conexão persistente SSE.
  - `POST /proximo`, `/rechamar`, `/ausente`, `/finalizar`.

---

## 11. Frontend: Telas, Lógica e Estilização (`public/`)

O frontend é implementado em **Vanilla HTML5, CSS3 e JavaScript Moderno**, sem dependências de frameworks pesados, garantindo carregamento instantâneo e total responsividade.

### 🎨 Estilos Globais (`public/css/global.css`)
- **Tipografia**: Importa fontes Google (`Inter` para interface e `Outfit` para números e títulos destacados).
- **Variáveis CSS**: Define paleta profissional em modo escuro (`#0f172a`, `#1e293b`), cores semânticas (`--accent-green: #10b981`, `--accent-blue: #3b82f6`, `--accent-red: #ef4444`, `--accent-purple: #8b5cf6`).
- **Design System**: Estilos de botões com gradientes e elevação de sombra (`.btn-green`, `.btn-blue`, `.btn-red`), badges de status SSE com ponto luminoso (`.status-badge`, `.status-dot`).
- **Animações**: `@keyframes pulse-glow` e classe `.flash-call` para chamar a atenção visual do usuário com pulso luminoso no momento da chamada de senha.

---

### 💻 Tela 1: Painel do Atendente
- **HTML (`public/tela1-atendente.html`)**:
  - Cabeçalho com seletor de guichê dinâmico e badge de status da conexão SSE.
  - Card esquerdo de controle operacional:
    - Informações do operador logado.
    - Display gigante da senha atualmente em atendimento (`#senhaAtualDisplay`).
    - Botão principal destacado: "➔ CHAMAR PRÓXIMA SENHA".
    - Botões secundários: "🔊 RECHAMAR", "✖ AUSENTE" e "✓ FINALIZAR ATENDIMENTO".
  - Painel direito com métricas em tempo real (Total Aguardando, Preferencial, Convencional) e tabela da fila em espera ordenada por prioridade legal com badges coloridos (`.tag-p`, `.tag-c`, `.tag-e`).
- **CSS (`public/css/atendente.css`)**:
  - Layout em grid de 2 colunas responsivo (`dashboard-grid`).
  - Efeito radial de profundidade no visor da senha atual.
- **JavaScript (`public/js/atendente.js`)**:
  - `elements`: Cache dos seletores DOM para performance.
  - `setStatusBadge(status, text)`: Atualiza a indicação visual da conexão SSE (`[SSE OK]`, `[Reconectando...]`).
  - `initSSE()`:
    - Abre a conexão `new EventSource('/api/atendimento/stream?tipo=atendente&guiche=...')`.
    - Trata o evento `QUEUE_UPDATE` chamando `renderStatistics()`.
    - Trata o evento `SENHA_CHAMADA`: Se a chamada foi para o guichê atual, destaca a senha na tela e recarrega a fila.
    - Trata `eventSource.onerror`: Ajusta o badge para desconectado e deixa o EventSource tentar reconectar.
  - `highlightCurrentTicket(ticketCode)`: Atualiza o texto da senha e adiciona a animação `.flash-call`.
  - `renderStatistics(stats)`: Atualiza os números nos cards estatísticos.
  - `loadQueueStatus()`: Faz `fetch('/api/senhas/status')` e preenche a tabela da fila com tempo de espera decorrido.
  - `loadGuicheData()`: Busca os dados do operador alocado no guichê selecionado.
  - `sendAction(endpoint, payload)`: Função auxiliar genérica para envios `POST` com JSON.
  - Listeners de clique:
    - `btnChamarProximo`: Desabilita temporariamente o botão (anti-double-click) e chama `/api/atendimento/proximo`.
    - `btnRechamar`: Aciona `/api/atendimento/rechamar`.
    - `btnAusente`: Confirma via modal e chama `/api/atendimento/ausente`.
    - `btnFinalizar`: Conclui o atendimento via `/api/atendimento/finalizar`.
    - `guicheSelect`: Ao trocar de guichê, recarrega os dados e reabre o canal SSE específico.

---

### 📺 Tela 2: Painel Público (Smart TV)
- **HTML (`public/tela2-tv.html`)**:
  - Projetada para visualização à distância em televisores de sala de espera.
  - Cabeçalho com identificação da clínica e relógio digital de alta precisão (`#tvClock`).
  - Banner central gigante (`#tvCallBanner`) com a senha em destaque (`#currentTicketCode`, com fonte de 8rem) e indicação do guichê de atendimento.
  - Painel lateral (`tv-history-panel`) listando os 4 últimos chamados com código, guichê e horário.
  - Rodapé com letreiro informativo e indicador de sinal SSE ao vivo.
  - Elemento de áudio `<audio id="audioChime" src="/assets/audio/chime.mp3">`.
- **CSS (`public/css/tv.css`)**:
  - Fundo super escuro (`#090d16`) de alto contraste, sem barra de rolagem (`overflow: hidden`).
  - Bordas de destaque iluminadas em verde e azul.
- **JavaScript (`public/js/tv.js`)**:
  - `getAudioContext()`: Cria e mantém o `AudioContext` da **Web Audio API** para síntese sonora nativa, contornando bloqueios de autoplay dos navegadores modernos.
  - `playCallAlert()`: Tenta tocar o arquivo MP3 `chime.mp3`; caso falhe ou não tenha sido baixado, aciona automaticamente o fallback sintetizado `playSyntheticChime()`.
  - `playSyntheticChime()` e `playTone(ctx, frequency, startTime, duration, volume)`:
    - Gera um acorde sonoro harmônico de dois tons puros (senoidais) em 783.99 Hz (Sol 5) e 1046.50 Hz (Dó 6) com decaimento exponencial de volume.
  - `speakTicket(senha, guicheNumero)`:
    - Utiliza a **Web Speech API** nativa (`window.speechSynthesis`) para sintetizar a voz em português brasileiro: `"Senha P zero um cinco, Guichê três"`.
  - `startClock()`: Atualiza o relógio a cada segundo.
  - `triggerVisualCallAlert()`: Aciona o pulso luminoso na tela.
  - `renderHistory(historico)`: Renderiza os cards das últimas chamadas na lateral.
  - `initSSE()`:
    - Conecta em `EventSource('/api/atendimento/stream?tipo=publico')`.
    - Escuta `SENHA_CHAMADA` e `CALL_TICKET`: Atualiza código da senha, guichê, dispara animação visual, toca o chime e fala a senha em voz alta após 600ms.

---

### 🎫 Tela 3: Totem de Autoatendimento
- **HTML (`public/tela3-totem.html`)**:
  - Interface touch screen com cartões grandes e ícones táteis para o cliente escolher o tipo de atendimento:
    1. **Atendimento Preferencial** (Ícone ♿, borda verde).
    2. **Atendimento Convencional** (Ícone 👤, borda azul).
    3. **Entrega de Exames** (Ícone 📄, borda roxa).
  - Modal simulando um **comprovante impresso térmico** (`.thermal-ticket`) com bordas serrilhadas, código da senha em fonte grande, posição na fila e contador regressivo.
- **CSS (`public/css/totem.css`)**:
  - Animação `@keyframes printTicket` simulando a ejeção de papel da impressora térmica.
  - Overlay escurecido com desfoque de fundo (`backdrop-filter: blur(8px)`).
- **JavaScript (`public/js/totem.js`)**:
  - `emitirSenha(categoria)`:
    - Desativa os botões para evitar emissão duplicada com toques repetidos.
    - Faz requisição `POST /api/senhas/emissao` enviando `{ categoria, totemId: 'TOTEM-ENTRADA-01' }`.
    - Ao receber a resposta positiva, chama `exibirComprovante(data)`.
  - `exibirComprovante(ticketData)`:
    - Preenche código, categoria, posição na fila e hora no modal térmico.
    - Abre o modal com classe `.active`.
    - Inicia uma contagem regressiva de 5 segundos (`modalTimerInterval`), após a qual o modal se fecha automaticamente (`fecharModal()`), deixando o totem pronto para o próximo cliente.

---

## 12. Ciclo de Vida de uma Senha: Passo a Passo Completo

Para consolidar o entendimento, veja o rastreamento exato do que ocorre no sistema desde a chegada do cliente até o fim do atendimento:

```
[1] CLIENTE NO TOTEM:
    Toca em "Atendimento Preferencial".
    totem.js envia POST /api/senhas/emissao { categoria: "PREFERENCIAL" }.

[2] BACKEND (Criação):
    senha.controller.js -> fila.service.js -> categoria.repository.js (identifica Categoria P).
    senha.repository.js gera proximo número (ex: 15) -> Codigo "P-015".
    Insere no SQLite com status 'AGUARDANDO'.
    fila.service.js dispara sseService.broadcast('QUEUE_UPDATE', stats).
    Retorna JSON com dados do bilhete para o Totem.

[3] ATUALIZAÇÃO REATIVA SSE:
    O painel do atendente recebe 'QUEUE_UPDATE' pelo EventSource e atualiza o card
    "Fila Preferencial: +1" sem nenhum recarregamento de página.

[4] ATENDENTE NO GUICHÊ:
    Atendente do Guichê 3 clica em "➔ CHAMAR PRÓXIMA SENHA".
    atendente.js envia POST /api/atendimento/proximo { guicheId: 3 }.

[5] BACKEND (Prioridade Legal e Claim Atômico):
    fila.service.js consulta findNextPendingTicket() -> SQLite busca por prioridade legal.
    A senha 'P-015' é escolhida antes de qualquer senha Convencional.
    claimTicketAtomic() reserva a senha exclusivamente para o Guichê 3.
    atendimento.repository.js cria o atendimento e calcula o tempo de espera.
    sseService.broadcast('SENHA_CHAMADA', { senha: 'P-015', guiche: 3, ... }).

[6] SALA DE ESPERA (TV):
    tv.js recebe o evento 'SENHA_CHAMADA' via SSE instantaneamente.
    Banner pisca na cor verde com o código 'P-015' e 'GUICHÊ 03'.
    Toca o alerta sonoro (Chime sonoro sintetizado).
    Sintetizador de voz lê: "Senha P zero um cinco, Guichê três".
    Histórico lateral é atualizado com o novo chamado.

[7] FINALIZAÇÃO:
    Após atender o paciente, o atendente clica em "✓ FINALIZAR ATENDIMENTO".
    POST /api/atendimento/finalizar calcula a duração exata do atendimento em segundos,
    marca a senha como 'FINALIZADA', libera o guichê para 'DISPONIVEL' e notifica
    todos os painéis novamente via SSE.
```

---

## 🎯 Conclusão

O projeto **guiche-control** é um exemplo de excelência em engenharia de software web para tempo real:
- Elimina completamente o desperdício de requisições de *polling* através de **Server-Sent Events**.
- Utiliza **Node.js nativo com SQLite (`DatabaseSync`)**, sem dependências externas complexas.
- Garante integridade de dados e proteção contra concorrência através de **operações SQL atômicas**.
- Entrega uma experiência de usuário visualmente moderna e acessível em todas as frentes (totem touch, painel administrativo e monitor público com síntese de voz e áudio nativos).
