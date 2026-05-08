# Modelo de Dados

Todos os schemas formais ficam em `src/schemas/`. Este documento explica o
significado de cada campo.

## Receita (`data/recipes/<slug>.md`)

Markdown com front-matter YAML. O `id` deve casar com o nome do arquivo (slug
kebab-case).

```yaml
---
id: omelete-proteico            # único, kebab-case
name: Omelete Proteico
servings: 1                     # quantas porções a receita rende
serving_size: "1 omelete (~250g)"
prep_time_min: 5
cook_time_min: 7
tags: [breakfast, high-protein]
ingredients:
  - { ingredient: "ovo inteiro", quantity: 3, unit: un }
macros_per_serving:             # SEMPRE por porção
  kcal: 380
  protein_g: 32
  carbs_g: 4
  fat_g: 26
source: manual                  # manual | usda | taco | <url>
needs_review: false             # true se macros estimados ou incompletos
---

# Modo de preparo
...
```

### Regras

- `unit` ∈ {`g`, `ml`, `un`}. Não inventar outras.
- `macros_per_serving.kcal` deve estar dentro de ±15% de `4·P + 4·C + 9·G`,
  caso contrário o validador emite warning.
- Se faltar dado nutricional, marcar `needs_review: true` em vez de chutar.

## Perfil (`data/profile.yml`)

Lista de pessoas e suas metas diárias.

```yaml
people:
  - id: marcus
    daily_targets: { kcal: 2400, protein_g: 180, carbs_g: 240, fat_g: 75 }
default_serving_scale:
  marcus: 1.0
  namorada: 0.7
```

`default_serving_scale` é apenas dica para a LLM ao gerar slots; o cálculo
real usa `servings` específicos de cada slot do plano.

## Plano semanal (`data/food-plan.yml`)

```yaml
days:
  monday:
    breakfast:
      recipe_id: omelete-proteico
      servings: { marcus: 1.0, namorada: 0.7 }
```

- `recipe_id` deve referenciar receita existente (validado).
- `servings` é por pessoa, em unidades da receita.
- Chaves de refeição (`breakfast`, `lunch`, `snack`, `dinner`...) são livres,
  mas mantenha o conjunto consistente entre os dias.

## Despensa (`data/pantry.yml`)

```yaml
items:
  - { ingredient: sal, quantity: 1000, unit: g }
```

A lista de compras subtrai estes itens do total semanal. Os nomes precisam
**bater com os usados nas receitas** (case-insensitive, trimmed).

## Saídas

- `output/index.html` — relatório principal.
- `output/snapshot.json` — opcional (gerado por `npm run build`).
