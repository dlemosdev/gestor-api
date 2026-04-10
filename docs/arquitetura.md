# Arquitetura Atual

## Objetivo

Documentar a organizacao final do backend apos a refatoracao para o padrao em camadas.

## Composition Root

Arquivo:

- `src/container.ts`

Responsabilidades:

- instanciar repositories
- instanciar services
- instanciar controllers
- expor dependencias prontas para o bootstrap HTTP

## Bootstrap HTTP

Arquivos:

- `src/app.ts`
- `src/servidor.ts`

Responsabilidades:

- configurar middlewares globais
- montar roteadores
- registrar error handler
- iniciar servidor HTTP
- realizar graceful shutdown

## Middlewares Globais

- `helmet`
- `cors`
- `compression`
- `request logging`
- `cookie parser`
- `json parser`
- `error handler`

## Modulos

### Auth

Arquivos:

- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.repository.ts`
- `src/modules/auth/auth.schemas.ts`

Responsabilidades:

- login
- refresh
- logout
- desafio 2FA
- criacao e revogacao de sessao

### Projetos

Arquivos:

- `src/modules/projetos/*`

Responsabilidades:

- CRUD principal de projeto
- historico
- definicao de projeto principal
- transicao de status

### Raias

Arquivos:

- `src/modules/raias/*`

Responsabilidades:

- listagem
- listagem por projeto
- reordenacao
- validacao de pertencimento da raia ao projeto

### Atividades

Arquivos:

- `src/modules/atividades/*`

Responsabilidades:

- CRUD
- historico
- checklist
- comentarios
- reordenacao
- regras HU / BUGFIX / HOTFIX

## Convencoes

- controller nao acessa banco diretamente
- service nao conhece HTTP
- repository nao conhece regra de negocio
- validacao HTTP entra antes do controller
- erros operacionais usam classes derivadas de `AppError`

## Estado Atual

Pontos fortes:

- camadas separadas
- validacao centralizada com Zod
- composition root manual
- health check com dependencia
- testes basicos automatizados

Pontos ainda evolutiveis:

- ampliar cobertura de testes para mais fluxos de atividades e raias
- introduzir helpers de resposta paginada quando houver listagens grandes
- considerar migracao futura de SQLite para camada de persistencia mais robusta se a carga crescer

