const express = require('express');
const cors = require('cors');
const path = require('node:path');
const apiRoutes = require('./routes');
const sseController = require('./controllers/sse.controller');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.get('/events', sseController.connectStream);

app.use('/api', apiRoutes);

app.get('/atendente', (req, res) => res.sendFile(path.join(publicDir, 'tela1-atendente.html')));
app.get('/tv', (req, res) => res.sendFile(path.join(publicDir, 'tela2-tv.html')));
app.get('/totem', (req, res) => res.sendFile(path.join(publicDir, 'tela3-totem.html')));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
