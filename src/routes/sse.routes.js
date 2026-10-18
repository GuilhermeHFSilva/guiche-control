const express = require('express');
const sseController = require('../controllers/sse.controller');

const router = express.Router();

router.get('/stream', sseController.connectStream);

module.exports = router;
