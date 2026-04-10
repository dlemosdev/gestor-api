import { AtividadeController } from './modules/atividades/atividade.controller';
import { AtividadeRepository } from './modules/atividades/atividade.repository';
import { AtividadeService } from './modules/atividades/atividade.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthRepository } from './modules/auth/auth.repository';
import { AuthService } from './modules/auth/auth.service';
import { ProjetoController } from './modules/projetos/projeto.controller';
import { ProjetoRepository } from './modules/projetos/projeto.repository';
import { ProjetoService } from './modules/projetos/projeto.service';
import { RaiaController } from './modules/raias/raia.controller';
import { RaiaRepository } from './modules/raias/raia.repository';
import { RaiaService } from './modules/raias/raia.service';
import { enviarCodigoSegundoFator } from './notificacao/email';

export interface AppContainer {
  controllers: {
    auth: AuthController;
    projetos: ProjetoController;
    raias: RaiaController;
    atividades: AtividadeController;
  };
}

export function criarContainer(): AppContainer {
  const projetoRepository = new ProjetoRepository();
  const raiaRepository = new RaiaRepository();
  const atividadeRepository = new AtividadeRepository();
  const authRepository = new AuthRepository();

  const projetoService = new ProjetoService(projetoRepository);
  const raiaService = new RaiaService(raiaRepository, projetoRepository);
  const atividadeService = new AtividadeService(atividadeRepository, raiaService, projetoRepository);
  const authService = new AuthService(authRepository, { enviarCodigoSegundoFator });

  return {
    controllers: {
      auth: new AuthController(authService),
      projetos: new ProjetoController(projetoService),
      raias: new RaiaController(raiaService),
      atividades: new AtividadeController(atividadeService),
    },
  };
}

