/**
 * @fileoverview Rotas para emissão e status das senhas.
 */
const express = require('express');
const senhaController = require('../controllers/senha.controller');
const guicheController = require('../controllers/guiche.controller');

const router = express.Router();

// Emissão de senhas no totem
router.post('/emissao', senhaController.emissao);
router.post('/gerar', senhaController.emissao);

// Chamada de senhas (alias para operação de próximo)
router.post('/chamar', guicheController.proximo);

// Status geral da fila
router.get('/status', senhaController.listarStatusFila);

module.exports = router;
