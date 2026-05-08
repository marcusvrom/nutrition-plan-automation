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
  recipes/                  # 1 arquivo Markdown por receita (com variantes de porção por pessoa)
  profile.yml               # pessoas, metas diárias, condições clínicas
  food-plan.yml             # plans[] por pessoa, weeks[] (A/B), refeições por dia
  pantry.yml                # itens já em casa (descontados da lista)
  ingredient-map.yml        # fluxo de origem dos insumos do meal prep
  meal-prep.yml              # roteiro hora a hora do prep dominical
  shopping-categories.yml   # categorização da lista + tags + tabela de substituições
  plans/
    <person_id>/
      principles.yml        # pilares do plano (opcional)
      rules.yml             # regras de ouro + disclaimer (opcional)
      supplements.yml       # stack de suplementos (opcional)
      clinical.yml          # alertas + tabela de exames (opcional)
      cronograma.yml        # timeline 12 sem / mensal (opcional)
src/
  domain/types.ts           # tipos do domínio (rico)
  parsers/                  # loaders YAML/Markdown
  validators/               # JSON Schema + regras cruzadas
  calculators/              # macros (por pessoa/semana) e lista de compras
  generators/html-report.ts # template renderer
  cli/                      # validate, build, report
  schemas/                  # JSON Schemas
templates/report-template.html
output/index.html           # relatório consolidado (todas as pessoas)
.github/workflows/nutrition-report.yml
CLAUDE.md                   # contrato operacional para a LLM
```

**Modelo multi-pessoa:** o relatório consolida vários planos. Cada pessoa
tem seu hero, refeições, princípios, regras, suplementos, exames e
cronograma; receitas e mapa de ingredientes são compartilhados; lista de
compras é unificada. Receitas podem declarar `portions:` com
`description` e `macros` específicas para cada `person_id`.

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
