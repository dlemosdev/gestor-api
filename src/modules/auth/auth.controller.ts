import { Request, Response } from 'express';

import { appConfig } from '../../config/env';
import { nomeCookieRefresh } from '../../autenticacao/jwt';
import { AuthService } from './auth.service';
import { LoginPayload, ValidarCodigoPayload } from './auth.types';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async login(req: Request, res: Response): Promise<void> {
    const resultado = await this.authService.login(req.body as LoginPayload, this.extrairMeta(req));

    if (resultado.requerSegundoFator) {
      res.json(resultado);
      return;
    }

    this.definirCookieRefresh(res, resultado.tokenRefresh);
    res.json({
      requerSegundoFator: false,
      tokenAcesso: resultado.tokenAcesso,
      usuario: resultado.usuario,
    });
  }

  async validarCodigo(req: Request, res: Response): Promise<void> {
    const resultado = await this.authService.validarCodigo(req.body as ValidarCodigoPayload, this.extrairMeta(req));
    this.definirCookieRefresh(res, resultado.tokenRefresh);
    res.json({
      tokenAcesso: resultado.tokenAcesso,
      usuario: resultado.usuario,
    });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const tokenRefreshAtual = req.cookies?.[nomeCookieRefresh] as string | undefined;
    const resultado = await this.authService.refresh(tokenRefreshAtual ?? '', this.extrairMeta(req));
    this.definirCookieRefresh(res, resultado.tokenRefresh);
    res.json({
      tokenAcesso: resultado.tokenAcesso,
      usuario: resultado.usuario,
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const tokenRefreshAtual = req.cookies?.[nomeCookieRefresh] as string | undefined;
    await this.authService.logout(tokenRefreshAtual);
    this.limparCookieRefresh(res);
    res.status(204).send();
  }

  limparSessao(res: Response): void {
    this.limparCookieRefresh(res);
  }

  private extrairMeta(req: Request) {
    const encaminhado = req.headers['x-forwarded-for'];
    const ipOrigem =
      typeof encaminhado === 'string'
        ? encaminhado.split(',')[0]?.trim() ?? req.ip ?? 'desconhecido'
        : req.ip ?? 'desconhecido';

    return {
      ipOrigem,
      userAgent: String(req.headers['user-agent'] ?? ''),
    };
  }

  private definirCookieRefresh(res: Response, tokenRefresh: string): void {
    res.cookie(nomeCookieRefresh, tokenRefresh, {
      httpOnly: true,
      secure: appConfig.ambiente === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private limparCookieRefresh(res: Response): void {
    res.clearCookie(nomeCookieRefresh, {
      httpOnly: true,
      secure: appConfig.ambiente === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });
  }
}

