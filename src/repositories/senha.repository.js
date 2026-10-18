const defaultDb = require('../config/database');
const { STATUS_SENHA } = require('../constants');

class SenhaRepository {
  constructor(database = defaultDb) {
    this.db = database;
  }

  getProximoNumeroSequencial(idCategoria) {
    const query = this.db.prepare(`
      SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo
      FROM SENHA 
      WHERE id_categoria = ? 
        AND DATE(data_hora_emissao, 'localtime') = DATE('now', 'localtime')
    `);
    const res = query.get(Number(idCategoria));
    return res ? Number(res.proximo) : 1;
  }

  create({ id_categoria, numero_sequencial, codigo_senha }) {
    const stmt = this.db.prepare(`
      INSERT INTO SENHA (id_categoria, numero_sequencial, codigo_senha, status_senha, data_hora_emissao)
      VALUES (?, ?, ?, 'AGUARDANDO', CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(Number(id_categoria), Number(numero_sequencial), String(codigo_senha));
    return this.findById(info.lastInsertRowid);
  }

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

  claimTicketAtomic(idSenha, novoStatus = STATUS_SENHA.EM_ATENDIMENTO, statusEsperado = STATUS_SENHA.AGUARDANDO) {
    const stmt = this.db.prepare(`
      UPDATE SENHA 
      SET status_senha = ? 
      WHERE id_senha = ? AND status_senha = ?
    `);
    const result = stmt.run(novoStatus, Number(idSenha), statusEsperado);
    return result.changes > 0;
  }

  updateStatus(idSenha, statusSenha) {
    const stmt = this.db.prepare(`
      UPDATE SENHA 
      SET status_senha = ? 
      WHERE id_senha = ?
    `);
    stmt.run(statusSenha, Number(idSenha));
    return this.findById(idSenha);
  }

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

    const tempoMedioEsperaMinutos = totalAguardando > 0 ? Math.max(1, Math.round(totalAguardando * 2.5)) : 0;

    return {
      totalAguardando,
      filaPreferencial,
      filaConvencional,
      filaExames,
      tempoMedioEsperaMinutos
    };
  }

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
