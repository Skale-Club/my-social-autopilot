# Billing — Webhooks Stripe

## Endpoint

```
POST /api/stripe/webhook
```

## Validação de Assinatura

O `server/index.ts` já captura `req.rawBody` em todos os requests. O webhook usa este buffer para validar a assinatura HMAC do Stripe:

```typescript
stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
```

**Importante:** nunca use `req.body` (já parseado como JSON) para validação — a assinatura valida o body bruto.

## Eventos e Ações

| Evento Stripe | Ação no banco |
|---|---|
| `customer.subscription.created` | Atualiza `user_subscriptions`: `plan_id`, `stripe_subscription_id`, `status`, `current_period_start/end` |
| `customer.subscription.updated` | Mesma atualização (captura mudanças de plano, renovações, cancelamentos agendados) |
| `customer.subscription.deleted` | Reverte `user_subscriptions` para `free_trial`: `plan_id = free_trial_id`, `stripe_subscription_id = null`, `status = 'trialing'`, períodos = null |

## Matching Customer → User

O Stripe Customer é criado em `getOrCreateStripeCustomer()` com o `userId` nos metadados. O lookup no webhook usa `stripe_customer_id` direto na tabela `user_subscriptions`.

## Idempotência

O Stripe pode re-enviar eventos. As operações de UPDATE são idempotentes (sobreescrevem com o mesmo valor), então re-processamento é seguro.

## Testar localmente

```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
# Em outro terminal, simular evento:
stripe trigger customer.subscription.created
```

## Logs

Todos os eventos não tratados são silenciosamente ignorados (`default: break`). Para debug, adicione `console.log("Unhandled event:", event.type)` no switch.
