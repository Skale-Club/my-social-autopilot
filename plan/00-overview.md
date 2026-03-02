# Billing — Visão Geral da Arquitetura

## Modelo de Cobrança

- **Free Trial**: 3 eventos de uso (gerações + edições). Sem cartão. Ao esgotar, o usuário vê um banner e é redirecionado para a página de planos.
- **Pro**: Taxa fixa mensal via Stripe Subscriptions. Gerações ilimitadas.
- Todo evento de uso (geração e edição) é registrado na tabela `usage_events`.

## Fluxo Geral

```
Usuário clica "Gerar"
     │
     ▼
POST /api/generate
     │
     ├─► checkQuota(userId)
     │        ├─ Busca user_subscriptions + subscription_plans
     │        ├─ Conta usage_events no período atual
     │        └─ Se used >= limit → 402 quota_exceeded
     │
     ├─► [Gemini text + image generation]
     │
     ├─► INSERT posts
     │
     └─► recordUsageEvent(userId, postId, 'generate')
              └─ INSERT usage_events
```

## Arquivos da Feature

| Caminho | Responsabilidade |
|---|---|
| `supabase/migrations/20260302000000_stripe_billing.sql` | Cria tabelas billing + trigger atualizado |
| `server/stripe.ts` | Cliente Stripe, checkout, portal, webhook |
| `server/quota.ts` | Verificação de cota e registro de eventos |
| `server/routes.ts` | Endpoints billing + quota nos endpoints existentes |
| `shared/schema.ts` | Tipos e schemas Zod para billing |
| `client/src/pages/billing.tsx` | Página de planos e uso |
| `client/src/components/app-sidebar.tsx` | Mini barra de uso no footer |
| `client/src/App.tsx` | Rota `/billing` registrada |
