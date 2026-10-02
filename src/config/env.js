const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: path.resolve(process.cwd(), process.env.DB_PATH || 'database/queue.db')
};
