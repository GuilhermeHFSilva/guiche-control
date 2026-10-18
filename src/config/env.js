const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const env = Object.freeze({
  PORT: Number.parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH === ':memory:' ? ':memory:' : path.resolve(process.cwd(), process.env.DB_PATH || 'database/queue.db'),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
});

module.exports = env;
