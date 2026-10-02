const express = require('express');
const router = express.Router();
const guicheController = require('../controllers/guiche.controller');

// Ações do Guichê
router.get('/', (req, res) => guicheController.listarGuiches(req, res));
router.get('/:id', (req, res) => guicheController.obterGuiche(req, res));
router.post('/proximo', (req, res) => guicheController.proximo(req, res));
router.post('/rechamar', (req, res) => guicheController.rechamar(req, res));
router.post('/ausente', (req, res) => guicheController.ausente(req, res));
router.post('/finalizar', (req, res) => guicheController.finalizar(req, res));

module.exports = router;
