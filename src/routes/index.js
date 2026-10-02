const express = require('express');
const router = express.Router();

const sseRoutes = require('./sse.routes');
const senhaRoutes = require('./senha.routes');
const guicheRoutes = require('./guiche.routes');
const sseController = require('../controllers/sse.controller');

// Rotas principais sob /api
router.use('/atendimento', sseRoutes);
router.use('/senhas', senhaRoutes);
router.use('/guiches', guicheRoutes);

// Alias diretos conforme especificação do PDF
router.get('/events', (req, res) => sseController.connectStream(req, res));
router.post('/api/senhas/emissao', (req, res) => require('../controllers/senha.controller').emissao(req, res));
router.post('/api/senhas/gerar', (req, res) => require('../controllers/senha.controller').emissao(req, res));
router.post('/api/senhas/chamar', (req, res) => require('../controllers/guiche.controller').proximo(req, res));
router.post('/api/atendimento/proximo', (req, res) => require('../controllers/guiche.controller').proximo(req, res));
router.post('/api/atendimento/rechamar', (req, res) => require('../controllers/guiche.controller').rechamar(req, res));
router.post('/api/atendimento/ausente', (req, res) => require('../controllers/guiche.controller').ausente(req, res));
router.post('/api/atendimento/finalizar', (req, res) => require('../controllers/guiche.controller').finalizar(req, res));

module.exports = router;
