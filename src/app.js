/**
 * @fileoverview Configuração da aplicação Express, middlewares e montagem de rotas.
 */
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const apiRoutes = require('./routes');
const sseController = require('./controllers/sse.controller');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');

const app = express();

// Middlewares essenciais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos do Frontend
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Alias direto para o stream SSE conforme especificação
app.get('/events', sseController.connectStream);

// Rotas principais da API (/api/atendimento, /api/senhas, /api/guiches)
app.use('/api', apiRoutes);

// Rotas amigáveis para as interfaces do frontend
app.get('/atendente', (req, res) => res.sendFile(path.join(publicDir, 'tela1-atendente.html')));
app.get('/tv', (req, res) => res.sendFile(path.join(publicDir, 'tela2-tv.html')));
app.get('/totem', (req, res) => res.sendFile(path.join(publicDir, 'tela3-totem.html')));

// Tratamento de rotas inexistentes e erros centrais
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
