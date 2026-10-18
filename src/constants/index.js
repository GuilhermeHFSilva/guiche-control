const CATEGORIAS = Object.freeze({
  PREFERENCIAL: {
    id: 1,
    prefixo: 'P',
    nome: 'Atendimento Preferencial',
    prioridade: 1
  },
  CONVENCIONAL: {
    id: 2,
    prefixo: 'C',
    nome: 'Atendimento Convencional',
    prioridade: 2
  },
  EXAMES: {
    id: 3,
    prefixo: 'E',
    nome: 'Entregas e Exames',
    prioridade: 3
  }
});

const STATUS_SENHA = Object.freeze({
  AGUARDANDO: 'AGUARDANDO',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  FINALIZADA: 'FINALIZADA',
  CANCELADO_AUSENCIA: 'CANCELADO_AUSENCIA'
});

const STATUS_GUICHE = Object.freeze({
  DISPONIVEL: 'DISPONIVEL',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO'
});

const SSE_EVENTS = Object.freeze({
  CONNECTED: 'CONNECTED',
  QUEUE_UPDATE: 'QUEUE_UPDATE',
  SENHA_CHAMADA: 'SENHA_CHAMADA',
  CALL_TICKET: 'CALL_TICKET'
});

module.exports = {
  CATEGORIAS,
  STATUS_SENHA,
  STATUS_GUICHE,
  SSE_EVENTS
};
