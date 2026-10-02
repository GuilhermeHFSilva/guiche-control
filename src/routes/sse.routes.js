const express = require('express');
const router = express.Router();
const sseController = require('../controllers/sse.controller');

// GET /api/atendimento/stream
router.get('/stream', (req, res) => sseController.connectStream(req, res));

module.exports = router;
