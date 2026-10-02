-- Schema do Banco de Dados - Sistema SSE de Gestão de Filas (SSE1)

CREATE TABLE IF NOT EXISTS CATEGORIA_SENHA (
    id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_prefixo VARCHAR(5) NOT NULL UNIQUE,
    nome_categoria VARCHAR(50) NOT NULL,
    nivel_prioridade INTEGER NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS GUICHE (
    id_guiche INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_guiche INTEGER NOT NULL UNIQUE,
    nome_atendente VARCHAR(100),
    status_operacional VARCHAR(20) DEFAULT 'DISPONIVEL',
    data_ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SENHA (
    id_senha INTEGER PRIMARY KEY AUTOINCREMENT,
    id_categoria INTEGER NOT NULL,
    numero_sequencial INTEGER NOT NULL,
    codigo_senha VARCHAR(10) NOT NULL,
    status_senha VARCHAR(20) DEFAULT 'AGUARDANDO',
    data_hora_emissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES CATEGORIA_SENHA(id_categoria)
);

CREATE TABLE IF NOT EXISTS ATENDIMENTO (
    id_atendimento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_senha INTEGER NOT NULL,
    id_guiche INTEGER NOT NULL,
    data_hora_chamada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_hora_inicio TIMESTAMP,
    data_hora_fim TIMESTAMP,
    tempo_espera_segundos INTEGER,
    duracao_atendimento_segundos INTEGER,
    FOREIGN KEY (id_senha) REFERENCES SENHA(id_senha),
    FOREIGN KEY (id_guiche) REFERENCES GUICHE(id_guiche)
);

CREATE TABLE IF NOT EXISTS PAINEL_MONITOR (
    id_painel INTEGER PRIMARY KEY AUTOINCREMENT,
    identificador_sala VARCHAR(50) NOT NULL,
    ip_dispositivo VARCHAR(45),
    tipo_exibicao VARCHAR(30) NOT NULL,
    status_conexao_sse BOOLEAN DEFAULT 1,
    ultima_sincronizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
