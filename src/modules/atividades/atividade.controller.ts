import { Request, Response } from 'express';

import { AtividadeService } from './atividade.service';
import {
  AdicionarComentarioInput,
  AtualizarAtividadeInput,
  AtualizarChecklistInput,
  CriarAtividadeInput,
  ReordenarAtividadesInput,
} from './atividade.types';

export class AtividadeController {
  constructor(private readonly atividadeService: AtividadeService) {}

  async listarTodas(_req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.listarTodas());
  }

  async listarPorProjeto(req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.listarPorProjeto(String(req.params.projetoId)));
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.obterPorId(String(req.params.id)));
  }

  async listarHistorico(req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.listarHistorico(String(req.params.id)));
  }

  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await this.atividadeService.criar(String(req.params.projetoId), req.body as CriarAtividadeInput));
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.atualizar(String(req.params.id), req.body as AtualizarAtividadeInput));
  }

  async atualizarChecklist(req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.atualizarChecklist(String(req.params.id), req.body as AtualizarChecklistInput));
  }

  async adicionarComentario(req: Request, res: Response): Promise<void> {
    res.json(
      await this.atividadeService.adicionarComentario(String(req.params.id), req.body as AdicionarComentarioInput, {
        usuarioIdAutenticado: req.autenticacao?.usuarioId,
      }),
    );
  }

  async excluir(req: Request, res: Response): Promise<void> {
    await this.atividadeService.excluir(String(req.params.id));
    res.status(204).send();
  }

  async reordenarPorRaia(req: Request, res: Response): Promise<void> {
    res.json(await this.atividadeService.reordenarPorRaia(String(req.params.raiaId), req.body as ReordenarAtividadesInput));
  }
}

