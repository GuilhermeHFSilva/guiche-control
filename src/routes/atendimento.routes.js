const express = require('express');
const sseController = require('../controllers/sse.controller');
const guicheController = require('../controllers/guiche.controller');

const router = express.Router();

router.get('/stream', sseController.connectStream);

router.post('/proximo', guicheController.proximo);
router.post('/rechamar', guicheController.rechamar);
router.post('/ausente', guicheController.ausente);
router.post('/finalizar', guicheController.finalizar);

module.exports = router;
