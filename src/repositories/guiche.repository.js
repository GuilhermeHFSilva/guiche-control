const db = require('../config/database');

class GuicheRepository {
  findAll() {
    const stmt = db.prepare('SELECT * FROM GUICHE ORDER BY numero_guiche ASC');
    return stmt.all();
  }

  findByNumero(numeroGuiche) {
    const stmt = db.prepare('SELECT * FROM GUICHE WHERE numero_guiche = ? LIMIT 1');
    return stmt.get(numeroGuiche);
  }

  findById(idGuiche) {
    const stmt = db.prepare('SELECT * FROM GUICHE WHERE id_guiche = ? LIMIT 1');
    return stmt.get(idGuiche);
  }

  updateOperador(idGuiche, nomeAtendente, statusOperacional = 'EM_ATENDIMENTO') {
    const stmt = db.prepare(`
      UPDATE GUICHE 
      SET nome_atendente = ?, status_operacional = ?, data_ultimo_acesso = CURRENT_TIMESTAMP 
      WHERE id_guiche = ?
    `);
    stmt.run(nomeAtendente, statusOperacional, idGuiche);
    return this.findById(idGuiche);
  }

  updateStatus(idGuiche, statusOperacional) {
    const stmt = db.prepare(`
      UPDATE GUICHE 
      SET status_operacional = ?, data_ultimo_acesso = CURRENT_TIMESTAMP 
      WHERE id_guiche = ?
    `);
    stmt.run(statusOperacional, idGuiche);
    return this.findById(idGuiche);
  }
}

module.exports = new GuicheRepository();
