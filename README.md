# 🚀 SSE Queue Flow — Sistema Reativo de Gestão de Filas (SSE1)

Sistema completo e refatorado de gerenciamento de filas e atendimento presencial em tempo real utilizando **Server-Sent Events (SSE)**, **Node.js**, **Express** e **SQLite** (`node:sqlite`). 

O sistema substitui o uso de *polling* repetitivo por uma comunicação unidirecional impulsionada pelo servidor (*push*), atualizando instantaneamente os monitores de TV, totens e painéis de guichê com arquitetura limpa (**Clean Code**), boas práticas avançadas de JavaScript (**JavaScript Pro**) e suíte completa de testes automatizados.

---

## 📁 Estrutura Refatorada do Projeto

```
sse-queue-flow/
├── database/                    # Scripts DDL e seeds do banco de dados SQLite
│   ├── schema.sql               # Criação das tabelas (CATEGORIA_SENHA, SENHA, GUICHE, ATENDIMENTO, etc.)
│   └── seeds.sql                # Cargas iniciais (Categorias Preferencial/Convencional/Exames e Guichês)
│
├── docs/                        # Documentação técnica e modelagem UML
│   └── diagramas/               # Diagramas PlantUML (.puml) de casos de uso, sequência e ERD
│
├── public/                      # Frontend estático servido pelo Express
│   ├── assets/
│   │   └── audio/
│   │       └── chime.mp3        # Alerta sonoro para chamadas da TV (RF-06)
│   ├── css/
│   │   ├── global.css           # Design system e temas
│   │   ├── atendente.css        # Estilos da tela do atendente
│   │   ├── tv.css               # Estilos da tela de alta visibilidade da TV
│   │   └── totem.css            # Estilos do totem de autoatendimento
│   ├── js/
│   │   ├── atendente.js         # Lógica modular de controle do guichê e reconexão SSE
│   │   ├── tv.js                # Listener SSE, sintetizador Web Audio API e relógio
│   │   └── totem.js             # Lógica touch de emissão de bilhetes com debounce
│   ├── tela1-atendente.html     # Painel de controle do atendente
│   ├── tela2-tv.html            # Painel público da sala de espera (Smart TV)
│   └── tela3-totem.html         # Totem touch de autoatendimento
│
├── src/                         # Backend Node.js / Express (Clean Architecture)
│   ├── config/                  # Variáveis de ambiente validadas e conexão SQLite com suporte in-memory
│   │   ├── database.js
│   │   └── env.js
│   ├── constants/               # Enums centralizados (Categorias, Status de Senha/Guichê, Eventos SSE)
│   │   └── index.js
│   ├── errors/                  # Hierarquia de erros de domínio (AppError, NotFound, BadRequest, Conflict)
│   │   ├── AppError.js
│   │   ├── BadRequestError.js
│   │   ├── ConflictError.js
│   │   ├── NotFoundError.js
│   │   └── index.js
│   ├── middlewares/             # Tratamento centralizado de erros, 404 e async handler
│   │   ├── asyncHandler.js
│   │   ├── errorHandler.js
│   │   └── notFoundHandler.js
│   ├── repositories/            # Camada de dados SQL otimizada (consultas agregadas e claim atômico)
│   │   ├── atendimento.repository.js
│   │   ├── categoria.repository.js
│   │   ├── guiche.repository.js
│   │   └── senha.repository.js
│   ├── services/                # Regras de negócio e motor SSE desacoplados com injeção de dependência
│   │   ├── atendimento.service.js
│   │   ├── fila.service.js
│   │   └── sse.service.js
│   ├── controllers/             # Controladores enxutos (Single Responsibility Principle)
│   │   ├── guiche.controller.js
│   │   ├── senha.controller.js
│   │   └── sse.controller.js
│   ├── routes/                  # Definição modular e expressiva de rotas REST e SSE
│   │   ├── atendimento.routes.js
│   │   ├── guiche.routes.js
│   │   ├── index.js
│   │   ├── senha.routes.js
│   │   └── sse.routes.js
│   ├── app.js                   # Pipeline de middlewares Express e rotas amigáveis
│   └── server.js                # Inicializador com Graceful Shutdown (SIGINT/SIGTERM)
│
├── tests/                       # Suíte completa de testes automatizados (Node Test Runner)
│   ├── integration/
│   │   └── api.test.js          # Testes de integração dos endpoints HTTP e SSE
│   └── unit/
│       ├── fila.service.test.js # Testes de prioridade legal, emissão e ciclo de vida
│       └── sse.service.test.js  # Testes de headers, broadcast e reconexão
│
├── .env.example                 # Modelo de variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

---

## ⚡ Como Executar Localmente

### Pré-requisitos
- **Node.js** v20+ (recomendado v22+ ou v24+ com suporte nativo a `node:sqlite`).

### Passo 1: Instalar dependências
```bash
npm install
```

### Passo 2: Executar testes automatizados
```bash
npm test
```
*Executa a suíte de 20 testes unitários e de integração utilizando o test runner nativo do Node.js (`node:test`).*

### Passo 3: Iniciar a aplicação
```bash
npm start
```
Ou em modo de desenvolvimento com hot-reload:
```bash
npm run dev
```

---

## 🖥️ Acessando as Interfaces no Navegador

Abra as três telas em abas ou janelas separadas do navegador para simular a operação em tempo real:

1. **🎫 Totem de Autoatendimento:**
   [http://localhost:3000/tela3-totem.html](http://localhost:3000/tela3-totem.html) ou [http://localhost:3000/totem](http://localhost:3000/totem)
   *(Clique para emitir senhas Preferenciais, Convencionais ou de Exames)*

2. **💻 Painel do Atendente (Guichê):**
   [http://localhost:3000/tela1-atendente.html](http://localhost:3000/tela1-atendente.html) ou [http://localhost:3000/atendente](http://localhost:3000/atendente)
   *(Selecione um guichê e clique em "Chamar Próxima Senha")*

3. **📺 Painel Público (Smart TV):**
   [http://localhost:3000/tela2-tv.html](http://localhost:3000/tela2-tv.html) ou [http://localhost:3000/tv](http://localhost:3000/tv)
   *(Exibe instantaneamente em tempo real a senha chamada com alerta sonoro, animação e histórico)*

---

## 📡 Endpoints da API

- `GET /api/atendimento/stream` (ou `/events`): Conexão persistente SSE (`text/event-stream`).
- `POST /api/senhas/emissao` (ou `/api/senhas/gerar`): Emite uma nova senha.
- `POST /api/atendimento/proximo` (ou `/api/senhas/chamar`): Chama a próxima senha respeitando a prioridade legal (`P` > `C` > `E`).
- `POST /api/atendimento/rechamar`: Re-anuncia a senha atual no painel público.
- `POST /api/atendimento/ausente`: Marca o cliente atual como ausente (`CANCELADO_AUSENCIA`).
- `POST /api/atendimento/finalizar`: Conclui o atendimento atual (`FINALIZADA`).
- `GET /api/senhas/status`: Consulta o status atual da fila e estatísticas consolidadas.
- `GET /api/guiches`: Lista os guichês cadastrados e seus atendentes.
- `GET /api/guiches/:id`: Consulta os dados detalhados e último atendimento de um guichê.

---

## 🛠️ Melhorias de Refatoração Realizadas (Clean Code & JS Pro)

1. **Eliminação de Código Morto e Bugs em SQL:**
   - Remoção de consultas SQL duplicadas e fragmento com erro de sintaxe em `senha.repository.js`.
   - Substituição de 4 consultas sequenciais de contagem em `getQueueStats()` por uma única consulta com agregação condicional (`SUM(CASE WHEN ...)`).

2. **Prevenção de Condições de Corrida (Race Conditions):**
   - Implementação de reserva atômica de senha (`claimTicketAtomic`) via SQL condicional no SQLite, garantindo que múltiplos atendentes chamando simultaneamente nunca recebam o mesmo bilhete.

3. **Desacoplamento e Injeção de Dependências:**
   - Services e Repositories aceitam instâncias injetadas via construtor, permitindo testes unitários com banco em memória (`:memory:`) sem poluir a base real.

4. **Gerenciamento do Event Loop e SSE:**
   - Inclusão de `.unref()` no timer de heartbeat do `SSEService`, prevenindo retenção indevida do processo Node.
   - Encerramento gracioso do servidor (`gracefulShutdown`) tratando `SIGTERM` e `SIGINT` com fechamento de sockets SSE e conexões SQLite.

5. **Tratamento Centralizado de Erros:**
   - Criação de classes de erro semânticas (`AppError`, `BadRequestError`, `NotFoundError`, `ConflictError`).
   - Middleware central `errorHandler` e `notFoundHandler`, eliminando blocos `try/catch` redundantes nos controllers.

6. **Frontend Modernizado:**
   - Modularização dos scripts em `public/js/`, cache eficiente de nós DOM, controle rigoroso de timers/intervals (prevenindo memory leaks) e sintetizador sonoro Web Audio API resiliente com fallback.
