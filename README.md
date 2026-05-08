# nutrition-plan-automation

Sistema versionado para manter um plano alimentar semanal sempre
atualizado, com cálculo determinístico de macros, lista de compras
consolidada e relatório HTML estático.

A LLM (Claude) ajuda a **estruturar e refatorar** os arquivos de dados;
todos os números (macros, calorias, lista de compras) são calculados por
scripts TypeScript, não pelo modelo.

## Estrutura

```
data/
  recipes/             # 1 arquivo Markdown por receita
  food-plan.yml        # plano semanal (referencia receitas)
  profile.yml          # pessoas + metas diárias de macros
  pantry.yml           # itens já em casa (descontados da lista de compras)
src/
  domain/              # tipos
  parsers/             # leitura de YAML/Markdown
  validators/          # JSON Schema + regras cruzadas
  calculators/         # macros e lista de compras (puro)
  generators/          # HTML
  cli/                 # validate, build, report
  schemas/             # JSON Schemas
templates/
  report-template.html
output/                # gerado: index.html (e snapshot.json)
docs/                  # ARCHITECTURE, DATA_MODEL, WORKFLOW, PROMPTS, FUTURE_MCP_RAG
.github/workflows/
  nutrition-report.yml # CI: valida + gera + publica em GitHub Pages
CLAUDE.md              # contrato operacional para a LLM
```

## Uso local

Requisitos: Node.js 20+.

```bash
npm install
npm run validate    # checa schemas e referências cruzadas
npm run report      # gera output/index.html
```

Abra `output/index.html` no navegador.

## Adicionar uma receita

1. Crie `data/recipes/<slug>.md` espelhando os exemplos.
2. Preencha `macros_per_serving` **por porção**.
3. Se incerto, marque `needs_review: true` em vez de chutar.
4. Encaixe a receita em `data/food-plan.yml`.
5. `npm run report`.

Veja `docs/DATA_MODEL.md` para o formato completo e `docs/PROMPTS.md`
para prompts prontos para a LLM.

## CI / GitHub Pages

`.github/workflows/nutrition-report.yml`:

- PRs: rodam `validate` + `report` e falham em erros.
- `main`: publica `output/` no GitHub Pages.

Habilite Pages em **Settings → Pages → Source: GitHub Actions**.

## Por que assim

- **Git como histórico:** cada plano é uma versão imutável.
- **Macros explícitos por porção:** evita drift entre LLM e realidade.
- **HTML estático:** publicação trivial, zero infra.
- **Pronto para evoluir:** ver `docs/FUTURE_MCP_RAG.md` para próximos
  passos (MCP, RAG, APIs nutricionais, banco de dados).

## Aviso

Este projeto é uma ferramenta pessoal. Não substitui acompanhamento de
nutricionista. Macros são estimativas baseadas nos dados que você
fornece.
