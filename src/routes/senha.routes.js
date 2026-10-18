const express = require('express');
const senhaController = require('../controllers/senha.controller');
const guicheController = require('../controllers/guiche.controller');

const router = express.Router();

router.post('/emissao', senhaController.emissao);
router.post('/gerar', senhaController.emissao);

router.post('/chamar', guicheController.proximo);

router.get('/status', senhaController.listarStatusFila);

module.exports = router;
