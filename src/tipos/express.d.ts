import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      autenticacao?: {
        usuarioId: string;
        email: string;
      };
    }
  }
}

export {};
