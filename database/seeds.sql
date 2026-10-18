INSERT OR IGNORE INTO CATEGORIA_SENHA (id_categoria, codigo_prefixo, nome_categoria, nivel_prioridade, descricao, ativo)
VALUES 
    (1, 'P', 'Atendimento Preferencial', 1, 'Idosos (60+), Gestantes, Lactantes e Pessoas com Deficiência (PCD)', 1),
    (2, 'C', 'Atendimento Convencional', 2, 'Consultas gerais, atendimento presencial padrão e recepção', 1),
    (3, 'E', 'Entregas e Exames', 3, 'Retirada rápida de laudos e resultados de exames', 1);

INSERT OR IGNORE INTO GUICHE (id_guiche, numero_guiche, nome_atendente, status_operacional)
VALUES 
    (1, 1, 'Ana Souza', 'DISPONIVEL'),
    (2, 2, 'Marcos Oliveira', 'DISPONIVEL'),
    (3, 3, 'Carlos Eduardo', 'DISPONIVEL'),
    (4, 4, 'Juliana Lima', 'DISPONIVEL');

INSERT OR IGNORE INTO PAINEL_MONITOR (id_painel, identificador_sala, ip_dispositivo, tipo_exibicao, status_conexao_sse)
VALUES 
    (1, 'Sala de Espera Principal - TV 01', '192.168.1.100', 'TV_RECEPCAO', 1),
    (2, 'Totem de Autoatendimento 01', '192.168.1.101', 'TOTEM', 1);
