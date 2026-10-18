const defaultDb = require('../config/database');

class CategoriaRepository {
  constructor(database = defaultDb) {
    this.db = database;
  }

  findAll() {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE ativo = 1 ORDER BY nivel_prioridade ASC'
    );
    return stmt.all();
  }

  findByPrefix(prefix) {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE codigo_prefixo = ? AND ativo = 1 LIMIT 1'
    );
    return stmt.get(prefix.toUpperCase());
  }

  findById(id) {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE id_categoria = ? LIMIT 1'
    );
    return stmt.get(Number(id));
  }

  findByName(name) {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE UPPER(nome_categoria) LIKE UPPER(?) AND ativo = 1 LIMIT 1'
    );
    return stmt.get(`%${name}%`);
  }
}

module.exports = new CategoriaRepository();
module.exports.CategoriaRepository = CategoriaRepository;
