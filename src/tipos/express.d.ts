import 'express';

declare global {
  namespace Express {
    interface Request {
      autenticacao?: {
        usuarioId: string;
        email: string;
      };
    }
  }
}

export {};
