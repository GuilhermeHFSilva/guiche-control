const app = require('./app');
const env = require('./config/env');

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  ================================================================
  🚀 SERVER-SENT EVENTS (SSE) QUEUE MANAGEMENT RUNNING
  ================================================================
  🔊 Server Running on: http://localhost:${PORT}
  
  📱 Tela 1 - Painel do Atendente : http://localhost:${PORT}/tela1-atendente.html
  📺 Tela 2 - Painel Público (TV) : http://localhost:${PORT}/tela2-tv.html
  🎫 Tela 3 - Totem Autoatendimento : http://localhost:${PORT}/tela3-totem.html
  
  📡 SSE Endpoint Feed          : http://localhost:${PORT}/api/atendimento/stream
  ================================================================
  `);
});
