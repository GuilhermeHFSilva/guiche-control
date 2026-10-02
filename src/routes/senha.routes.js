const express = require('express');
const router = express.Router();
const senhaController = require('../controllers/senha.controller');

// Emissão de senhas no totem
router.post('/emissao', (req, res) => senhaController.emissao(req, res));
router.post('/gerar', (req, res) => senhaController.emissao(req, res)); // Alias do PDF

// Chamada de senhas (alias para rota de atendimento)
router.post('/chamar', (req, res) => require('../controllers/guiche.controller').proximo(req, res));

// Status geral da fila
router.get('/status', (req, res) => senhaController.listarStatusFila(req, res));

module.exports = router;
