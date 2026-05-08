# Prompts e modelos de issue

Este arquivo concentra prompts prontos para Claude e templates de issue.

## Adicionar nova receita (issue)

Título sugerido: `[recipe] Adicionar <nome>`

Corpo:

```
**Nome:** Mongolian Beef
**Origem:** receita do canal X / restaurante Y / criação minha
**Porções que rende:** 2
**Tamanho da porção:** 1 prato (~350g com arroz)

**Ingredientes (com quantidade e unidade):**
- 400 g patinho em tiras
- 300 g arroz cozido
- 40 ml shoyu
- ...

**Macros estimados por porção (se souber):**
- kcal: 620
- proteína: 48 g
- carbo: 62 g
- gordura: 18 g

**Modo de preparo:**
1. ...
2. ...

**Encaixe no plano semanal:** jantar de seg/qua/sex (opcional).
```

## Prompt para Claude — adicionar receita a partir da issue

```
Você está agindo no repositório nutrition-plan-automation.

Tarefa: criar `data/recipes/<slug>.md` a partir da issue acima, seguindo
exatamente o formato descrito em docs/DATA_MODEL.md.

Regras:
- Slug em kebab-case, sem acentos.
- Macros sempre POR PORÇÃO. Se a issue der macros totais, divida por
  servings antes de gravar.
- Se faltar dado nutricional, marque needs_review: true e NÃO invente.
- Em seguida, edite data/food-plan.yml para encaixar a receita conforme
  pedido (se houver).
- NÃO calcule manualmente totais semanais nem lista de compras —
  isso é responsabilidade dos scripts.
- Rode mentalmente uma checagem: kcal ≈ 4·P + 4·C + 9·G dentro de ±15%.

Entrega:
1. Diff do(s) arquivo(s) criados/editados.
2. Comando para o usuário rodar: `npm run report`.
```

## Prompt para Claude — refatorar o plano semanal

```
Refatore data/food-plan.yml para que:
- A média diária de macros do Marcus fique dentro de ±5% das metas.
- A média diária de macros da Namorada fique dentro de ±5% das metas.
- Não repita a mesma receita mais de 3x na semana, exceto café da manhã.
- Mantenha apenas receitas existentes em data/recipes/.

Não edite mais nenhum arquivo. Não calcule totais — apenas proponha o
plano. Após a edição, peça ao usuário para rodar `npm run report` e
ajustar com base no output.
```

## Prompt para Claude — investigar inconsistência

```
A seção "Validação" do output/index.html mostra <colar mensagens>.
Investigue qual arquivo causa cada problema, proponha correção mínima,
e mostre o diff. Não silencie warnings sem justificar.
```

## Prompt para Claude — sugerir substituição

```
A receita <slug> ficou indisponível (ingrediente em falta / não gostei).
Sugira 2 substituições dentre as receitas existentes em data/recipes/
com perfil de macros similar (±10% em proteína e kcal). Não crie
receita nova nesta tarefa.
```
