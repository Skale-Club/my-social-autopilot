# Billing — Variáveis de Ambiente

## Variáveis necessárias para o billing funcionar

Adicionar ao `.env` local e às variáveis do ambiente de deploy (Vercel, Railway, etc.):

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...          # sk_live_... em produção
STRIPE_WEBHOOK_SECRET=whsec_...        # Gerado no Stripe Dashboard ou Stripe CLI

# App URL (usado para redirect após checkout)
APP_URL=https://seu-dominio.com        # Sem barra no final. localhost:5000 em dev
```

## Variáveis já existentes (não alterar)

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Onde encontrar as chaves Stripe

| Chave | Onde obter |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → seu endpoint → Signing secret |

## Em produção (Vercel)

```bash
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add APP_URL
```

## Segurança

- **Nunca** commitar o `.env` no git (já está no `.gitignore`)
- Usar chaves `sk_test_` em desenvolvimento e `sk_live_` apenas em produção
- O `STRIPE_WEBHOOK_SECRET` é único por endpoint — gerar um novo para cada ambiente
