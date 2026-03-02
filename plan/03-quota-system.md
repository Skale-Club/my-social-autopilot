# Billing — Sistema de Cota

## Lógica de `checkQuota` (server/quota.ts)

1. Busca `user_subscriptions` JOIN `subscription_plans` para o usuário
2. Se não encontrar → assume `free_trial` com limite de 3
3. Se `monthly_limit = NULL` → `allowed: true` (plano ilimitado)
4. Determina `periodStart`:
   - Se tem `current_period_start` → usa o período de billing do Stripe
   - Se não tem (free trial) → conta todos os eventos de todos os tempos
5. Conta `usage_events` desde `periodStart`
6. Retorna `{ allowed: used < limit, used, limit, plan }`

## Onde a cota é verificada

| Endpoint | Posição do check |
|---|---|
| `POST /api/generate` | Após validar JWT, API key e brand |
| `POST /api/edit-post` | Após validar JWT, post ownership, API key e brand |

## Resposta quando cota excedida

```json
HTTP 402 Payment Required
{
  "error": "quota_exceeded",
  "message": "Você atingiu o limite de gerações do seu plano. Faça upgrade para continuar.",
  "used": 3,
  "limit": 3,
  "plan": "free_trial"
}
```

O frontend deve tratar o código 402 e exibir um toast/dialog direcionando para `/billing`.

## Registro de eventos (`recordUsageEvent`)

Chamado **após** a operação ter sido concluída com sucesso:
- `POST /api/generate` → logo antes do `return res.json(...)`
- `POST /api/edit-post` → logo antes do `return res.json(...)`

Parâmetros: `userId`, `postId | null`, `'generate' | 'edit'`

## Extensibilidade futura

- Adicionar campo `credits` às `usage_events` para pesos diferentes por tipo de operação
- Adicionar tabela `usage_overage` para controlar cobranças extras
- Implementar alertas de 80% / 100% de uso via email (Resend/SendGrid)
