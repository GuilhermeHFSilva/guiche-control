const express = require('express');
const atendimentoRoutes = require('./atendimento.routes');
const senhaRoutes = require('./senha.routes');
const guicheRoutes = require('./guiche.routes');

const router = express.Router();

router.use('/atendimento', atendimentoRoutes);
router.use('/senhas', senhaRoutes);
router.use('/guiches', guicheRoutes);

module.exports = router;
