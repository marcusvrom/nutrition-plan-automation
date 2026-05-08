# Evolução futura: MCP, RAG e banco de dados

Esta página descreve, em alto nível, como o projeto pode crescer **sem
quebrar a arquitetura atual**. Nada aqui está implementado.

## 1. MCP (Model Context Protocol)

Hoje a LLM lê arquivos via filesystem. Um servidor MCP daria a ela
ferramentas estruturadas:

- `mcp.recipes.add({ slug, frontmatter, body })` — cria/atualiza receita.
- `mcp.plan.set_slot({ day, meal, recipe_id, servings })` — edita slot.
- `mcp.report.generate()` — dispara `npm run report` num runner controlado.
- `mcp.nutrition.lookup({ ingredient, qty, unit })` — consulta TACO/USDA.

Vantagem: a LLM nunca precisa lembrar formato YAML — o servidor valida e
retorna erros estruturados.

Local sugerido: `mcp-server/` separado, comunicando com o repositório via
git ou via filesystem montado.

## 2. RAG (Retrieval-Augmented Generation)

Quando o número de receitas crescer (>50), buscar por similaridade vira
útil:

- Indexar `data/recipes/*.md` com embeddings (ex.: `text-embedding-3-large`).
- Indexar histórico de planos (`git log -p data/food-plan.yml`).
- Indexar restrições/preferências do `profile.yml`.

Casos de uso:

- "Sugira 3 substitutos para frango-curry com perfil similar de macros."
- "Quais receitas contêm leite de coco?"
- "Já comi mongolian beef quantas vezes nos últimos 30 dias?"

Implementação sugerida: serviço lateral com vector store (sqlite-vec ou
pgvector). O índice é regenerado por hook do GitHub Actions quando
`data/` muda.

## 3. APIs nutricionais

Substituir `macros_per_serving` digitado à mão por consulta a:

- TACO (Tabela Brasileira de Composição de Alimentos).
- USDA FoodData Central.
- Open Food Facts (códigos de barras).

A receita guardaria os ingredientes com quantidades e o cálculo de macros
seria feito automaticamente. Manter `macros_per_serving` como cache
para builds determinísticos.

## 4. Banco de dados

Apenas se o volume tornar arquivos inviáveis (>500 receitas, múltiplos
usuários simultâneos). Modelo sugerido:

- `recipes` (id, name, servings, serving_size, source, body_md)
- `recipe_ingredients` (recipe_id, ingredient_id, quantity, unit)
- `ingredients` (id, name_normalized, kcal_per_100g, p, c, f)
- `plans` (id, owner_id, period_start, period_end)
- `plan_slots` (plan_id, day, meal, recipe_id, servings_json)

A migração mantém o git como fonte de verdade exportando dump.
