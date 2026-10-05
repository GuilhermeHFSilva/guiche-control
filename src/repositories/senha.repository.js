/**
 * @fileoverview Repositório para operações na tabela SENHA.
 */
const defaultDb = require('../config/database');
const { STATUS_SENHA } = require('../constants');

class SenhaRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} [database=defaultDb]
   */
  constructor(database = defaultDb) {
    this.db = database;
  }

  /**
   * Obtém o próximo número sequencial do dia para a categoria informada.
   * @param {number} idCategoria
   * @returns {number}
   */
  getProximoNumeroSequencial(idCategoria) {
    const query = this.db.prepare(`
      SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo
      FROM SENHA 
      WHERE id_categoria = ? 
        AND DATE(data_hora_emissao) = DATE('now', 'localtime')
    `);
    const res = query.get(Number(idCategoria));
    return res ? Number(res.proximo) : 1;
  }

  /**
   * Insere uma nova senha com status AGUARDANDO.
   * @param {{ id_categoria: number, numero_sequencial: number, codigo_senha: string }} params
   * @returns {object|undefined}
   */
  create({ id_categoria, numero_sequencial, codigo_senha }) {
    const stmt = this.db.prepare(`
      INSERT INTO SENHA (id_categoria, numero_sequencial, codigo_senha, status_senha, data_hora_emissao)
      VALUES (?, ?, ?, 'AGUARDANDO', CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(Number(id_categoria), Number(numero_sequencial), String(codigo_senha));
    return this.findById(info.lastInsertRowid);
  }

  /**
   * Busca uma senha pelo ID com dados da categoria.
   * @param {number} idSenha
   * @returns {object|undefined}
   */
  findById(idSenha) {
    const stmt = this.db.prepare(`
      SELECT s.*, c.codigo_prefixo, c.nome_categoria, c.nivel_prioridade
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.id_senha = ?
      LIMIT 1
    `);
    return stmt.get(Number(idSenha));
  }

  /**
   * Busca a próxima senha elegível para atendimento respeitando a prioridade legal
   * (Preferencial > Convencional > Exames) e ordem de chegada (FIFO).
   * @returns {object|undefined}
   */
  findNextPendingTicket() {
    const stmt = this.db.prepare(`
      SELECT s.*, c.codigo_prefixo, c.nome_categoria, c.nivel_prioridade
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.status_senha = 'AGUARDANDO'
      ORDER BY c.nivel_prioridade ASC, s.id_senha ASC
      LIMIT 1
    `);
    return stmt.get();
  }

  /**
   * Atualização atômica de status para evitar 'race conditions' entre múltiplos atendentes.
   * @param {number} idSenha
   * @param {string} novoStatus
   * @param {string} [statusEsperado='AGUARDANDO']
   * @returns {boolean} Retorna true se atualizou com sucesso ou false se já foi alterada por outro processo
   */
  claimTicketAtomic(idSenha, novoStatus = STATUS_SENHA.EM_ATENDIMENTO, statusEsperado = STATUS_SENHA.AGUARDANDO) {
    const stmt = this.db.prepare(`
      UPDATE SENHA 
      SET status_senha = ? 
      WHERE id_senha = ? AND status_senha = ?
    `);
    const result = stmt.run(novoStatus, Number(idSenha), statusEsperado);
    return result.changes > 0;
  }

  /**
   * Atualiza o status de uma senha.
   * @param {number} idSenha
   * @param {string} statusSenha
   * @returns {object|undefined}
   */
  updateStatus(idSenha, statusSenha) {
    const stmt = this.db.prepare(`
      UPDATE SENHA 
      SET status_senha = ? 
      WHERE id_senha = ?
    `);
    stmt.run(statusSenha, Number(idSenha));
    return this.findById(idSenha);
  }

  /**
   * Calcula a posição da senha na fila de sua categoria.
   * @param {number} idSenha
   * @param {number} idCategoria
   * @returns {number}
   */
  getPosicaoFila(idSenha, idCategoria) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as posicao
      FROM SENHA
      WHERE id_categoria = ?
        AND status_senha = 'AGUARDANDO'
        AND id_senha <= ?
    `);
    const res = stmt.get(Number(idCategoria), Number(idSenha));
    return res ? Number(res.posicao) : 1;
  }

  /**
   * Retorna estatísticas consolidadas da fila em uma única consulta de alta performance.
   * @returns {{ totalAguardando: number, filaPreferencial: number, filaConvencional: number, filaExames: number, tempoMedioEsperaMinutos: number }}
   */
  getQueueStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as totalAguardando,
        COALESCE(SUM(CASE WHEN c.codigo_prefixo = 'P' THEN 1 ELSE 0 END), 0) as filaPreferencial,
        COALESCE(SUM(CASE WHEN c.codigo_prefixo = 'C' THEN 1 ELSE 0 END), 0) as filaConvencional,
        COALESCE(SUM(CASE WHEN c.codigo_prefixo = 'E' THEN 1 ELSE 0 END), 0) as filaExames
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.status_senha = 'AGUARDANDO'
    `);
    const res = stmt.get() || {};

    const totalAguardando = Number(res.totalAguardando) || 0;
    const filaPreferencial = Number(res.filaPreferencial) || 0;
    const filaConvencional = Number(res.filaConvencional) || 0;
    const filaExames = Number(res.filaExames) || 0;

    // Estimativa de ~2.5 minutos por atendimento
    const tempoMedioEsperaMinutos = totalAguardando > 0 ? Math.max(1, Math.round(totalAguardando * 2.5)) : 0;

    return {
      totalAguardando,
      filaPreferencial,
      filaConvencional,
      filaExames,
      tempoMedioEsperaMinutos
    };
  }

  /**
   * Retorna as últimas senhas chamadas com formato adequado para exibição no painel da TV.
   * @param {number} [limit=5]
   * @returns {Array<object>}
   */
  getUltimasChamadas(limit = 5) {
    const stmt = this.db.prepare(`
      SELECT 
        s.codigo_senha as senha,
        g.numero_guiche as guiche,
        strftime('%H:%M', a.data_hora_chamada, 'localtime') as hora,
        a.data_hora_chamada as timestamp,
        g.nome_atendente as nomeAtendente
      FROM ATENDIMENTO a
      JOIN SENHA s ON a.id_senha = s.id_senha
      JOIN GUICHE g ON a.id_guiche = g.id_guiche
      ORDER BY a.id_atendimento DESC
      LIMIT ?
    `);
    return stmt.all(Number(limit));
  }

  /**
   * Retorna a lista detalhada de senhas aguardando atendimento.
   * @returns {Array<object>}
   */
  getFilaPendenteDetalhada() {
    const stmt = this.db.prepare(`
      SELECT 
        s.id_senha,
        s.codigo_senha,
        c.nome_categoria,
        c.codigo_prefixo,
        c.nivel_prioridade,
        strftime('%H:%M', s.data_hora_emissao, 'localtime') as hora_emissao,
        CAST((julianday('now') - julianday(s.data_hora_emissao)) * 1440 AS INTEGER) as minutos_espera
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.status_senha = 'AGUARDANDO'
      ORDER BY c.nivel_prioridade ASC, s.id_senha ASC
    `);
    return stmt.all();
  }
}

module.exports = new SenhaRepository();
module.exports.SenhaRepository = SenhaRepository;
