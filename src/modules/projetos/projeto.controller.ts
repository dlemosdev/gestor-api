import { Request, Response } from 'express';

import { ProjetoService } from './projeto.service';
import { AtualizarProjetoInput, AtualizarStatusProjetoInput, CriarProjetoInput } from './projeto.types';

export class ProjetoController {
  constructor(private readonly projetoService: ProjetoService) {}

  private obterProjetoId(req: Request): string {
    return String(req.params.id);
  }

  async listarProjetos(_req: Request, res: Response): Promise<void> {
    res.json(await this.projetoService.listarProjetos());
  }

  async obterProjeto(req: Request, res: Response): Promise<void> {
    res.json(await this.projetoService.obterProjeto(this.obterProjetoId(req)));
  }

  async listarHistorico(req: Request, res: Response): Promise<void> {
    res.json(await this.projetoService.listarHistorico(this.obterProjetoId(req)));
  }

  async criarProjeto(req: Request, res: Response): Promise<void> {
    res.status(201).json(await this.projetoService.criarProjeto(req.body as CriarProjetoInput));
  }

  async atualizarProjeto(req: Request, res: Response): Promise<void> {
    res.json(await this.projetoService.atualizarProjeto(this.obterProjetoId(req), req.body as AtualizarProjetoInput));
  }

  async definirPrincipal(req: Request, res: Response): Promise<void> {
    res.json(await this.projetoService.definirPrincipal(this.obterProjetoId(req)));
  }

  async atualizarStatus(req: Request, res: Response): Promise<void> {
    res.json(await this.projetoService.atualizarStatus(this.obterProjetoId(req), req.body as AtualizarStatusProjetoInput));
  }
}
