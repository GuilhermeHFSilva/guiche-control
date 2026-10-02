# 🚀 SSE Queue Flow — Sistema Reativo de Gestão de Filas (SSE1)

Sistema completo de gerenciamento de filas e atendimento presencial em tempo real utilizando **Server-Sent Events (SSE)**, **Node.js**, **Express** e **SQLite**. 

O sistema substitui o uso de *polling* repetitivo por uma comunicação unidirecional impulsionada pelo servidor (*push*), atualizando instantaneamente os monitores de TV, totens e guichês.

---

## 📁 Estrutura do Projeto

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
│   │   ├── atendente.js         # Lógica de controle do guichê
│   │   ├── tv.js                # Listener SSE, animação visual e sintetizador de áudio
│   │   └── totem.js             # Lógica de emissão de bilhetes
│   ├── tela1-atendente.html     # Painel de controle do atendente
│   ├── tela2-tv.html            # Painel público da sala de espera (Smart TV)
│   └── tela3-totem.html         # Totem touch de autoatendimento
│
├── src/                         # Backend Node.js / Express
│   ├── config/                  # Configurações de ambiente e banco de dados SQLite
│   ├── controllers/             # Manipuladores HTTP e SSE
│   ├── services/                # Regras de negócio e motor SSE (EventStream Engine)
│   ├── repositories/            # Camada de persistência SQL
│   ├── routes/                  # Definição e roteamento de endpoints REST e SSE
│   ├── app.js                   # Setup do Express e middlewares
│   └── server.js                # Inicializador do servidor HTTP
│
├── .env.example                 # Modelo de variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

---

## ⚡ Como Executar Localmente

### Pró-requisitos
- **Node.js** v18+ instalado.

### Passo 1: Instalar as dependências
No terminal, dentro do diretório do projeto:
```bash
npm install
```

### Passo 2: Iniciar a aplicação
```bash
npm start
```
*O banco de dados SQLite é criado e inicializado automaticamente com as tabelas e dados de teste.*

---

## 🖥️ Acessando as Interfaces no Navegador

Abra as três telas em abas ou janelas separadas do navegador para simular a operação em tempo real:

1. **🎫 Totem de Autoatendimento:**
   [http://localhost:3000/tela3-totem.html](http://localhost:3000/tela3-totem.html)
   *(Clique para emitir senhas Preferenciais, Convencionais ou de Exames)*

2. **💻 Painel do Atendente (Guichê):**
   [http://localhost:3000/tela1-atendente.html](http://localhost:3000/tela1-atendente.html)
   *(Selecione um guichê e clique em "Chamar Próxima Senha")*

3. **📺 Painel Público (Smart TV):**
   [http://localhost:3000/tela2-tv.html](http://localhost:3000/tela2-tv.html)
   *(Exibe instantaneamente em tempo real a senha chamada com alerta sonoro e histórico)*

---

## 📡 Endpoints da API

- `GET /api/atendimento/stream` (ou `/events`): Conexão persistente SSE (`text/event-stream`).
- `POST /api/senhas/emissao` (ou `/api/senhas/gerar`): Emite uma nova senha.
- `POST /api/atendimento/proximo` (ou `/api/senhas/chamar`): Chama a próxima senha com prioridade legal (`Preferencial (P)` > `Convencional (C)` > `Exames (E)`).
- `POST /api/atendimento/rechamar`: Re-anuncia a senha atual no painel público.
- `POST /api/atendimento/ausente`: Marca o cliente atual como ausente (`CANCELADO_AUSENCIA`).
- `POST /api/atendimento/finalizar`: Conclui o atendimento atual (`FINALIZADA`).
- `GET /api/senhas/status`: Consulta o status atual da fila e estatísticas.

---

## ⚙️ Regras de Negócio & Funcionalidades (RFs / RNFs)

- **Prioridade Legal ([RF-04]):** Senhas `P` (Preferencial) são chamadas estritamente antes de `C` (Convencional) e `E` (Exames).
- **Notificação Visual e Alerta Sonoro ([RF-06]):** Ao chamar uma senha, o painel da TV reproduz um toque sonoro e aplica um flash de destaque no banner.
- **Resiliência de Conexão ([RF-08]):** Caso a rede oscile, o cliente `EventSource` tenta reconectar automaticamente exibindo o status visual no topo da tela.
- **Proibição de Polling ([RNF-01]):** Toda atualização é 100% orientada a eventos *push* unidirecionais via SSE.
