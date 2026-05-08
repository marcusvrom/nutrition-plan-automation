# Workflow operacional

## Fluxo local

```bash
npm install
npm run validate     # checa schemas + integridade cruzada
npm run report       # gera output/index.html
open output/index.html
```

Para debug:

```bash
npm run build        # gera output/snapshot.json
```

## Adicionando uma receita nova

1. Criar `data/recipes/<slug>.md` (use os existentes como modelo).
2. Preencher `macros_per_serving` **por porção**. Se incerto, marcar
   `needs_review: true`.
3. Editar `data/food-plan.yml` para encaixar a receita em um ou mais slots.
4. Rodar `npm run report`.
5. Abrir `output/index.html` e verificar:
   - Δ médio/dia por pessoa dentro da tolerância.
   - Lista de compras consistente.
   - Sem erros na seção "Validação".
6. Commitar `data/` (output/ é regenerável e pode ser ignorado se preferir).

## Atualizando o plano semanal

- Editar `data/food-plan.yml` direto, ou pedir à Claude que refatore (ver
  `docs/PROMPTS.md`).
- Após qualquer mudança em `data/`, rodar `npm run report`.

## Pipeline GitHub Actions

`.github/workflows/nutrition-report.yml`:

1. Em `push`/`pull_request` que mudem `data/`, `src/`, `templates/`:
   - `npm ci && npm run validate && npm run report`.
   - PRs falham se a validação acusar erros.
2. Em `push` na `main`:
   - Publica `output/` no GitHub Pages.

### Habilitar GitHub Pages

Em **Settings → Pages**, escolher **GitHub Actions** como source. Na primeira
execução em `main`, o workflow cria o deployment.

## Ciclo recomendado de evolução

1. Receita nova → branch `recipe/<slug>` → PR → CI valida → merge.
2. Refatoração de plano → branch `plan/<descrição>` → PR.
3. Mudança de macros do perfil → commit direto na main (afeta só você).
