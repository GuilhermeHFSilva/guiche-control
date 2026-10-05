/**
 * @fileoverview Rotas de atendimento: stream SSE e ações do guichê no fluxo de atendimento.
 */
const express = require('express');
const sseController = require('../controllers/sse.controller');
const guicheController = require('../controllers/guiche.controller');

const router = express.Router();

// Stream SSE para telas públicas e do atendente
router.get('/stream', sseController.connectStream);

// Ações de atendimento realizadas pelos guichês
router.post('/proximo', guicheController.proximo);
router.post('/rechamar', guicheController.rechamar);
router.post('/ausente', guicheController.ausente);
router.post('/finalizar', guicheController.finalizar);

module.exports = router;
