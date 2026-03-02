# Billing — Frontend

## Página `/billing` (`client/src/pages/billing.tsx`)

### Seções

1. **Header** — título "Planos e Uso"
2. **Card do plano atual** — nome do plano, badge de status, data de renovação, progress bar de uso, botão "Gerenciar assinatura" (se inscrito)
3. **Cards de planos** — grid 2 colunas com Free Trial e Pro. Botão "Assinar" nos planos não ativos com `stripe_price_id`

### Queries TanStack Query

```tsx
// Assinatura + uso
useQuery({ queryKey: ["/api/billing/subscription"] })

// Lista de planos
useQuery({ queryKey: ["/api/billing/plans"] })
```

### Mutations

```tsx
// Criar checkout
useMutation → POST /api/billing/checkout
  onSuccess: window.location.href = url

// Criar portal
useMutation → POST /api/billing/portal
  onSuccess: window.location.href = url
```

### Success/Cancel redirect

Após o pagamento, o Stripe redireciona para `/billing?success=1` ou `/billing?canceled=1`. A página pode detectar estes parâmetros para exibir um toast (melhoria futura).

---

## Sidebar (`app-sidebar.tsx`)

### Menu item adicionado

```tsx
{ title: "Planos", url: "/billing", icon: CreditCard }
```

### Mini barra de uso no footer

Exibida apenas quando `billing.limit !== null` (free trial ou plano com limite). Mostra barra de progresso colorida (violeta normal, vermelha quando esgotada).

---

## Tratar erro 402 no front (melhoria futura)

No `post-creator-dialog.tsx`, ao receber um erro 402 da API:

```tsx
if (error.message.startsWith("402:")) {
  toast({
    title: "Limite atingido",
    description: "Você usou todas as suas gerações. Faça upgrade para continuar.",
    action: <Button onClick={() => navigate("/billing")}>Ver planos</Button>
  });
}
```
