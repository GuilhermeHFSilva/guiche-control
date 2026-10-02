const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servidor de arquivos estáticos do Frontend (public/)
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API e SSE
app.use('/api', routes);
app.use('/', routes); // Garante aliases como /events

// Fallback para páginas HTML do frontend
app.get('/atendente', (req, res) => res.sendFile(path.join(__dirname, '../public/tela1-atendente.html')));
app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, '../public/tela2-tv.html')));
app.get('/totem', (req, res) => res.sendFile(path.join(__dirname, '../public/tela3-totem.html')));

module.exports = app;
