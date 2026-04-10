import { Request, Response } from 'express';

import { RaiaService } from './raia.service';
import { ReordenarRaiasInput } from './raia.types';

export class RaiaController {
  constructor(private readonly raiaService: RaiaService) {}

  async listarTodas(_req: Request, res: Response): Promise<void> {
    res.json(await this.raiaService.listarTodas());
  }

  async listarPorProjeto(req: Request, res: Response): Promise<void> {
    res.json(await this.raiaService.listarPorProjeto(String(req.params.projetoId)));
  }

  async reordenar(req: Request, res: Response): Promise<void> {
    res.json(await this.raiaService.reordenar(String(req.params.projetoId), req.body as ReordenarRaiasInput));
  }
}

