# Billing — Configuração do Stripe

## 1. STRIPE_SECRET_KEY

**Caminho:** Dashboard → Developers → API keys

1. Acesse https://dashboard.stripe.com
2. Menu lateral → **Developers** → **API keys**
3. Seção **Standard keys** → clique em **Reveal test key** (desenvolvimento) ou **Reveal live key** (produção)
4. Copie a chave `sk_test_...` ou `sk_live_...`

---

## 2. Criar produto e obter o stripe_price_id

**Caminho:** Dashboard → Product catalog → + Add product

1. Menu lateral → **Product catalog**
2. Clique **+ Add product**
3. Nome: `Social Autopilot Pro`
4. Na seção de pricing:
   - Tipo: **Recurring**
   - Período: **Monthly**
   - Valor: ex. `99,00` BRL
5. Salve → na página do produto, seção **Pricing**, copie o **Price ID** (`price_xxx`)
6. Atualize o banco com o Price ID obtido:

```sql
UPDATE subscription_plans
SET stripe_price_id = 'price_SEU_ID_AQUI',
    price_cents = 9900
WHERE name = 'pro';
```

---

## 3. STRIPE_WEBHOOK_SECRET

### Em desenvolvimento (Stripe CLI — recomendado)

```bash
# Instalar Stripe CLI
npm install -g stripe

# Autenticar
stripe login

# Escutar e redirecionar para o servidor local
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

O terminal vai exibir:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Copie esse valor para o `.env`.

### Em produção (Stripe Dashboard)

**Caminho:** Dashboard → Developers → Webhooks → + Add endpoint

1. URL do endpoint: `https://seu-dominio.com/api/stripe/webhook`
2. Eventos a selecionar:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Salve → na página do endpoint, clique **Reveal** em **Signing secret** → copie o `whsec_...`

Antes de ativar em produção, configure o **Billing Portal**:
- Dashboard → **Settings** → **Billing** → **Customer Portal** → ative e salve

---

## 4. Configurar o .env

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:5000
```

> Use `sk_test_` em desenvolvimento. Chaves `sk_live_` apenas em produção.

---

## 5. Cartões de teste Stripe

| Número | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pagamento aprovado |
| `4000 0000 0000 9995` | Cartão recusado |

Validade: qualquer data futura. CVC: qualquer 3 dígitos.

---

## Checklist

- [ ] Conta Stripe criada
- [ ] `STRIPE_SECRET_KEY` copiada para `.env`
- [ ] Produto "Social Autopilot Pro" criado com preço recorrente mensal
- [ ] `stripe_price_id` atualizado no banco (`UPDATE subscription_plans...`)
- [ ] Stripe CLI instalada (`npm install -g stripe`)
- [ ] `STRIPE_WEBHOOK_SECRET` copiada para `.env` via `stripe listen`
- [ ] Migration SQL executada no Supabase (`supabase/migrations/20260302000000_stripe_billing.sql`)
