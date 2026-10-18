const express = require('express');
const guicheController = require('../controllers/guiche.controller');

const router = express.Router();

router.get('/', guicheController.listarGuiches);
router.get('/:id', guicheController.obterGuiche);
router.post('/proximo', guicheController.proximo);
router.post('/rechamar', guicheController.rechamar);
router.post('/ausente', guicheController.ausente);
router.post('/finalizar', guicheController.finalizar);

module.exports = router;
