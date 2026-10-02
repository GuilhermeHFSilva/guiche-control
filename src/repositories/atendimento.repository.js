const db = require('../config/database');

class AtendimentoRepository {
  create({ id_senha, id_guiche }) {
    const stmt = db.prepare(`
      INSERT INTO ATENDIMENTO (id_senha, id_guiche, data_hora_chamada, data_hora_inicio)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(id_senha, id_guiche);
    return this.findById(info.lastInsertRowid);
  }

  findById(idAtendimento) {
    const stmt = db.prepare(`
      SELECT a.*, s.codigo_senha, g.numero_guiche, g.nome_atendente
      FROM ATENDIMENTO a
      JOIN SENHA s ON a.id_senha = s.id_senha
      JOIN GUICHE g ON a.id_guiche = g.id_guiche
      WHERE a.id_atendimento = ?
      LIMIT 1
    `);
    return stmt.get(idAtendimento);
  }

  findUltimoAtendimentoPorGuiche(idGuiche) {
    const stmt = db.prepare(`
      SELECT a.*, s.codigo_senha, s.status_senha, g.numero_guiche, g.nome_atendente
      FROM ATENDIMENTO a
      JOIN SENHA s ON a.id_senha = s.id_senha
      JOIN GUICHE g ON a.id_guiche = g.id_guiche
      WHERE a.id_guiche = ?
      ORDER BY a.id_atendimento DESC
      LIMIT 1
    `);
    return stmt.get(idGuiche);
  }

  finalizarAtendimento(idAtendimento) {
    const stmt = db.prepare(`
      UPDATE ATENDIMENTO 
      SET data_hora_fim = CURRENT_TIMESTAMP,
          duracao_atendimento_segundos = CAST((julianday('now') - julianday(data_hora_inicio)) * 24 * 60 * 60 AS INTEGER)
      WHERE id_atendimento = ?
    `);
    stmt.run(idAtendimento);
    return this.findById(idAtendimento);
  }

  countAtendimentosHojePorGuiche(idGuiche) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM ATENDIMENTO 
      WHERE id_guiche = ? 
        AND DATE(data_hora_chamada) = DATE('now', 'localtime')
    `);
    const res = stmt.get(idGuiche);
    return res ? res.total : 0;
  }
}

module.exports = new AtendimentoRepository();
