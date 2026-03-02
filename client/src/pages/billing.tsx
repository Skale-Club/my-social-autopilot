import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Zap, Crown } from "lucide-react";
import type { BillingSubscriptionResponse, SubscriptionPlan } from "@shared/schema";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function statusLabel(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "active":
      return { label: "Ativo", variant: "default" };
    case "trialing":
      return { label: "Trial", variant: "secondary" };
    case "canceled":
      return { label: "Cancelado", variant: "destructive" };
    case "past_due":
      return { label: "Pagamento atrasado", variant: "destructive" };
    default:
      return { label: status, variant: "outline" };
  }
}

export default function BillingPage() {
  const { toast } = useToast();

  const { data: billing, isLoading: loadingBilling } = useQuery<BillingSubscriptionResponse>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: plansData, isLoading: loadingPlans } = useQuery<{ plans: SubscriptionPlan[] }>({
    queryKey: ["/api/billing/plans"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { priceId });
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  if (loadingBilling || loadingPlans) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plans = plansData?.plans ?? [];
  const currentPlanName = billing?.plan?.name ?? "free_trial";
  const used = billing?.used ?? 0;
  const limit = billing?.limit ?? 3;
  const subStatus = billing?.subscription?.status ?? "trialing";
  const periodEnd = billing?.subscription?.current_period_end;
  const hasActiveSubscription =
    subStatus === "active" && billing?.subscription?.stripe_subscription_id;

  const usagePercent = limit !== null ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planos e Uso</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie sua assinatura e acompanhe o consumo de gerações.
        </p>
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Plano atual</p>
            <p className="text-lg font-semibold">{billing?.plan?.display_name ?? "Free Trial"}</p>
          </div>
          <Badge variant={statusLabel(subStatus).variant}>{statusLabel(subStatus).label}</Badge>
        </div>

        {periodEnd && (
          <p className="text-xs text-muted-foreground">
            Renova em{" "}
            {new Date(periodEnd).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}

        {/* Usage bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gerações usadas</span>
            <span className="font-medium tabular-nums">
              {used}
              {limit !== null ? ` / ${limit}` : " (ilimitado)"}
            </span>
          </div>
          {limit !== null && (
            <Progress
              value={usagePercent}
              className={usagePercent >= 100 ? "[&>div]:bg-destructive" : ""}
            />
          )}
        </div>

        {hasActiveSubscription && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            {portalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gerenciar assinatura
          </Button>
        )}
      </div>

      {/* Plan cards */}
      <div>
        <h2 className="text-base font-semibold mb-4">Planos disponíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = plan.name === currentPlanName;
            const isPro = plan.name === "pro";

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-5 space-y-4 flex flex-col ${
                  isCurrent ? "border-violet-500 bg-violet-500/5" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {isPro ? (
                        <Crown className="w-4 h-4 text-violet-400" />
                      ) : (
                        <Zap className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">{plan.display_name}</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {plan.price_cents === 0
                        ? "Grátis"
                        : formatCents(plan.price_cents)}
                      {plan.price_cents > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">/mês</span>
                      )}
                    </p>
                  </div>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>

                <ul className="text-sm text-muted-foreground space-y-1.5 flex-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {plan.monthly_limit !== null
                      ? `${plan.monthly_limit} gerações`
                      : "Gerações ilimitadas"}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Edições de imagem incluídas
                  </li>
                  {isPro && (
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      Suporte prioritário
                    </li>
                  )}
                </ul>

                {!isCurrent && plan.stripe_price_id && (
                  <Button
                    className="w-full"
                    onClick={() => checkoutMutation.mutate(plan.stripe_price_id!)}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Assinar {plan.display_name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
