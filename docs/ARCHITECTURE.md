# Arquitetura

## Princípios

1. **Dados versionados, código determinístico, LLM apenas para refatoração estrutural.**
   Macros, calorias, listas de compras nunca devem ser calculados pela LLM.
2. **Tudo é arquivo.** Não há banco de dados; o git é o histórico.
3. **Camadas separadas.** Parsing, validação, cálculo e geração de saída são módulos
   independentes que se comunicam por tipos em `src/domain/types.ts`.
4. **Idempotente.** Rodar `npm run report` várias vezes produz o mesmo HTML para a
   mesma entrada (módulo timestamp).

## Camadas

```
data/                ← fonte da verdade (markdown + yaml)
   │
   ▼
src/parsers/         ← lê arquivos, produz objetos tipados
   │
   ▼
src/validators/      ← valida contra JSON Schemas + regras cruzadas
   │
   ▼
src/calculators/     ← macros, lista de compras (puro, sem I/O)
   │
   ▼
src/generators/      ← HTML (lê template, substitui placeholders, escreve em output/)
   │
   ▼
output/index.html    ← artefato final, publicável via GitHub Pages
```

CLIs em `src/cli/` orquestram as camadas:

- `validate.ts` → roda apenas parsers + validators.
- `build.ts`    → produz `output/snapshot.json` (debug / consumo externo).
- `report.ts`   → pipeline completo até HTML.

## Por que TypeScript em vez de scripts shell

- Validação cruzada entre arquivos exige modelos tipados.
- Erros de unidade (`g` vs `ml`) são fáceis de cometer; tipos ajudam.
- Migração futura para servidor / API fica direta.

## Por que Markdown + YAML em vez de só JSON

- Receitas têm corpo em texto (modo de preparo) — Markdown encaixa naturalmente.
- Front-matter YAML mantém os dados estruturados parseáveis.
- Plano e perfil são puramente estruturais → YAML puro.

## Onde a LLM atua

Apenas como **co-autora de arquivos de dados**:

- Adicionar um arquivo em `data/recipes/`.
- Refatorar `data/food-plan.yml`.
- Sugerir reorganizações.

Nunca:

- Calcular macros agregados.
- Decidir lista de compras.
- Editar `output/`.

Veja `CLAUDE.md` para protocolo operacional.
