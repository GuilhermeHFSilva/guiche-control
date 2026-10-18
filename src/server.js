const app = require('./app');
const env = require('./config/env');
const sseService = require('./services/sse.service');
const { closeDatabase } = require('./config/database');

const server = app.listen(env.PORT, () => {
  console.log(`
  ================================================================
  🚀 SERVER-SENT EVENTS (SSE) QUEUE MANAGEMENT RUNNING
  ================================================================
  🔊 Servidor Ativo em: http://localhost:${env.PORT}
  
  📱 Tela 1 - Painel do Atendente : http://localhost:${env.PORT}/tela1-atendente.html
  📺 Tela 2 - Painel Público (TV) : http://localhost:${env.PORT}/tela2-tv.html
  🎫 Tela 3 - Totem Autoatendimento : http://localhost:${env.PORT}/tela3-totem.html
  
  📡 SSE Endpoint Feed          : http://localhost:${env.PORT}/api/atendimento/stream
  ================================================================
  `);
});

function gracefulShutdown(signal) {
  console.log(`\n🛑 Sinal ${signal} recebido. Encerrando conexões graciosamente...`);

  sseService.closeAll();

  server.close(() => {
    console.log('🚪 Servidor HTTP encerrado.');
    closeDatabase();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Forçando encerramento imediato.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
