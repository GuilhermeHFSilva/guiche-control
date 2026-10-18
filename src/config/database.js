const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const env = require('./env');

const SCHEMA_PATH = path.resolve(__dirname, '../../database/schema.sql');
const SEEDS_PATH = path.resolve(__dirname, '../../database/seeds.sql');

function createDatabase(databasePath = env.DB_PATH) {
  if (databasePath !== ':memory:') {
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const dbInstance = new DatabaseSync(databasePath);

  dbInstance.exec('PRAGMA foreign_keys = ON;');
  if (databasePath !== ':memory:') {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }

  initDatabase(dbInstance);
  return dbInstance;
}

function initDatabase(dbInstance) {
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    dbInstance.exec(schemaSql);
  }

  if (fs.existsSync(SEEDS_PATH)) {
    const seedsSql = fs.readFileSync(SEEDS_PATH, 'utf8');
    dbInstance.exec(seedsSql);
  }

  if (!env.isTest && !process.env.NODE_TEST_CONTEXT && dbInstance.path !== ':memory:') {
    console.log('📦 [DB] Banco de dados SQLite inicializado com sucesso.');
  }
}

function closeDatabase(dbInstance = defaultDb) {
  if (dbInstance && typeof dbInstance.close === 'function') {
    dbInstance.close();
  }
}

const defaultDb = createDatabase();

module.exports = defaultDb;
module.exports.createDatabase = createDatabase;
module.exports.initDatabase = initDatabase;
module.exports.closeDatabase = closeDatabase;
