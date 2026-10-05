const AppError = require('./AppError');

class ConflictError extends AppError {
  constructor(message = 'Conflito de estado na operação.') {
    super(message, 409);
  }
}

module.exports = ConflictError;
