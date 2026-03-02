# Billing — Endpoints da API

## Novos Endpoints

### `GET /api/billing/plans`

Lista os planos ativos ordenados por preço.

**Auth:** Não requer autenticação

**Response:**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "free_trial",
      "display_name": "Free Trial",
      "stripe_price_id": null,
      "monthly_limit": 3,
      "price_cents": 0,
      "is_active": true,
      "created_at": "..."
    },
    {
      "id": "uuid",
      "name": "pro",
      "display_name": "Pro",
      "stripe_price_id": "price_xxx",
      "monthly_limit": null,
      "price_cents": 9900,
      "is_active": true,
      "created_at": "..."
    }
  ]
}
```

---

### `GET /api/billing/subscription`

Retorna a assinatura atual do usuário + uso do período.

**Auth:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "plan": { /* SubscriptionPlan */ },
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
    "plan_id": "uuid",
    "stripe_customer_id": "cus_xxx",
    "stripe_subscription_id": "sub_xxx",
    "status": "active",
    "current_period_start": "2026-03-01T00:00:00Z",
    "current_period_end": "2026-04-01T00:00:00Z",
    "created_at": "...",
    "updated_at": "..."
  },
  "used": 1,
  "limit": null
}
```

---

### `POST /api/billing/checkout`

Cria uma sessão de Stripe Checkout e retorna a URL de redirecionamento.

**Auth:** `Authorization: Bearer <token>`

**Request:**
```json
{ "priceId": "price_xxx" }
```

**Response:**
```json
{ "url": "https://checkout.stripe.com/pay/..." }
```

O frontend deve redirecionar para esta URL. Após o pagamento, o Stripe redireciona para `APP_URL/billing?success=1`.

---

### `POST /api/billing/portal`

Cria uma sessão do Stripe Billing Portal (gerenciar/cancelar assinatura).

**Auth:** `Authorization: Bearer <token>`

**Request:** body vazio ou `{}`

**Response:**
```json
{ "url": "https://billing.stripe.com/session/..." }
```

---

### `POST /api/stripe/webhook`

Recebe eventos do Stripe. Valida assinatura via `req.rawBody`.

**Auth:** Stripe-Signature header (validação HMAC)

**Eventos tratados:**
- `customer.subscription.created` → atualiza `user_subscriptions`
- `customer.subscription.updated` → atualiza status, período, plano
- `customer.subscription.deleted` → reverte para `free_trial`

**Response:** `{ "received": true }` ou erro 4xx/5xx

---

## Endpoints Modificados

### `POST /api/generate` e `POST /api/edit-post`

Adicionado verificação de cota antes do processamento.

**Novo erro possível:**
```
HTTP 402 Payment Required
{
  "error": "quota_exceeded",
  "message": "...",
  "used": 3,
  "limit": 3,
  "plan": "free_trial"
}
```
