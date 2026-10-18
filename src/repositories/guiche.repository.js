const defaultDb = require('../config/database');
const { STATUS_GUICHE } = require('../constants');

class GuicheRepository {
  constructor(database = defaultDb) {
    this.db = database;
  }

  findAll() {
    const stmt = this.db.prepare('SELECT * FROM GUICHE ORDER BY numero_guiche ASC');
    return stmt.all();
  }

  findByNumero(numeroGuiche) {
    const stmt = this.db.prepare('SELECT * FROM GUICHE WHERE numero_guiche = ? LIMIT 1');
    return stmt.get(Number(numeroGuiche));
  }

  findById(idGuiche) {
    const stmt = this.db.prepare('SELECT * FROM GUICHE WHERE id_guiche = ? LIMIT 1');
    return stmt.get(Number(idGuiche));
  }

  updateOperador(idGuiche, nomeAtendente, statusOperacional = STATUS_GUICHE.EM_ATENDIMENTO) {
    const stmt = this.db.prepare(`
      UPDATE GUICHE 
      SET nome_atendente = ?, status_operacional = ?, data_ultimo_acesso = CURRENT_TIMESTAMP 
      WHERE id_guiche = ?
    `);
    stmt.run(nomeAtendente, statusOperacional, Number(idGuiche));
    return this.findById(idGuiche);
  }

  updateStatus(idGuiche, statusOperacional) {
    const stmt = this.db.prepare(`
      UPDATE GUICHE 
      SET status_operacional = ?, data_ultimo_acesso = CURRENT_TIMESTAMP 
      WHERE id_guiche = ?
    `);
    stmt.run(statusOperacional, Number(idGuiche));
    return this.findById(idGuiche);
  }
}

module.exports = new GuicheRepository();
module.exports.GuicheRepository = GuicheRepository;
