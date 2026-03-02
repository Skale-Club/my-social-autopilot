# Billing — Banco de Dados

## Novas Tabelas

### `subscription_plans`

Define os planos disponíveis na plataforma. Gerenciada manualmente (seed + Stripe Dashboard).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT UNIQUE | Identificador interno: `free_trial`, `pro` |
| `display_name` | TEXT | Nome exibido: "Free Trial", "Pro" |
| `stripe_price_id` | TEXT nullable | ID do Price no Stripe (ex: `price_xxx`) |
| `monthly_limit` | INTEGER nullable | Limite mensal de eventos. NULL = ilimitado |
| `price_cents` | INTEGER | Preço em centavos (ex: 9900 = R$99) |
| `is_active` | BOOLEAN | Se o plano está disponível para assinatura |
| `created_at` | TIMESTAMPTZ | |

### `user_subscriptions`

Uma linha por usuário. Criada automaticamente via trigger quando o usuário se cadastra.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK auth.users (UNIQUE) |
| `plan_id` | UUID nullable | FK subscription_plans |
| `stripe_customer_id` | TEXT nullable | Customer ID no Stripe |
| `stripe_subscription_id` | TEXT nullable | Subscription ID no Stripe |
| `status` | TEXT | `trialing` / `active` / `canceled` / `past_due` |
| `current_period_start` | TIMESTAMPTZ nullable | Início do período de cobrança atual |
| `current_period_end` | TIMESTAMPTZ nullable | Fim do período de cobrança atual |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `usage_events`

Um registro por evento de uso (geração ou edição).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK auth.users |
| `post_id` | UUID nullable | FK posts (SET NULL se post deletado) |
| `event_type` | TEXT | `generate` ou `edit` |
| `created_at` | TIMESTAMPTZ | |

## RLS Policies

- `subscription_plans`: leitura pública (`FOR SELECT USING (true)`)
- `user_subscriptions`: usuário vê apenas sua linha (`auth.uid() = user_id`)
- `usage_events`: usuário vê apenas seus eventos (`auth.uid() = user_id`)
- Escrita em todas as tabelas billing é feita exclusivamente via **service role** (backend), nunca pelo cliente

## Trigger Atualizado

O `handle_new_user()` agora também insere uma linha em `user_subscriptions` com `plan_id = free_trial` quando um novo usuário se cadastra.

## Como Aplicar

Execute `supabase/migrations/20260302000000_stripe_billing.sql` no SQL Editor do Supabase após o `supabase-setup.sql` original.

## Atualizar stripe_price_id

Após criar o produto e o price no Stripe Dashboard, execute:

```sql
UPDATE subscription_plans
SET stripe_price_id = 'price_XXXXXXXXXXXXX'
WHERE name = 'pro';
```
