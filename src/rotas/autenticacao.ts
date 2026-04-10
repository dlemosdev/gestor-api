import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';

import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validation';
import { AuthController } from '../modules/auth/auth.controller';
import { loginSchema, validarCodigoSchema } from '../modules/auth/auth.schemas';
import { ApiErro, responderProblema } from '../tipos/erros';

function criarRateLimitHandler(detail: string) {
  return (req: Request, res: Response): void => {
    responderProblema(req, res, new ApiErro(detail, 429));
  };
}

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: criarRateLimitHandler('Muitas tentativas de login. Tente novamente em alguns minutos.'),
});

const limiteValidacaoCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: criarRateLimitHandler('Muitas tentativas de validacao. Tente novamente em alguns minutos.'),
});

export function criarRoteadorAutenticacao(authController: AuthController) {
  const roteadorAutenticacao = Router();

  roteadorAutenticacao.post(
    '/login',
    limiteLogin,
    validate({ body: loginSchema }),
    asyncHandler((req, res) => authController.login(req, res)),
  );

  roteadorAutenticacao.post(
    '/2fa/validar',
    limiteValidacaoCodigo,
    validate({ body: validarCodigoSchema }),
    asyncHandler((req, res) => authController.validarCodigo(req, res)),
  );

  roteadorAutenticacao.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      try {
        await authController.refresh(req, res);
      } catch (erro) {
        authController.limparSessao(res);
        throw erro;
      }
    }),
  );

  roteadorAutenticacao.post(
    '/logout',
    asyncHandler((req, res) => authController.logout(req, res)),
  );

  return roteadorAutenticacao;
}
