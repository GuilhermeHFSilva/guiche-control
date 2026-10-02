const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const env = require('./env');

// Garante que o diretório do banco exista
const dbDir = path.dirname(env.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(env.DB_PATH);

// Executa Pragmas para otimização do SQLite em memória/arquivo
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const seedsPath = path.resolve(__dirname, '../../database/seeds.sql');

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  if (fs.existsSync(seedsPath)) {
    const seedsSql = fs.readFileSync(seedsPath, 'utf8');
    db.exec(seedsSql);
  }

  console.log(' [DB] Banco de dados SQLite inicializado com sucesso.');
}

// Inicializa no startup
initDatabase();

module.exports = db;
