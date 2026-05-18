/**
 * IntegrationBillingSection - Billing plans table with per-plan save buttons
 */

import { UseMutationResult } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { type BillingPlan } from "@shared/schema";

const INTEGRATION_ERROR_STYLE: React.CSSProperties = {
    borderColor: "color-mix(in srgb, var(--app-error-color) 45%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--app-error-color) 12%, transparent)",
    color: "var(--app-error-color)",
};

type BillingPlanDraft = {
    stripe_price_id: string;
    stripe_product_id: string;
};

export type IntegrationBillingSectionProps = {
    billingPlanDrafts: Record<string, BillingPlanDraft>;
    stripeConfigurablePlans: BillingPlan[];
    isBillingPlansLoading: boolean;
    billingPlansError: Error | null;
    handleBillingPlanDraftChange: (planKey: string, field: keyof BillingPlanDraft, value: string) => void;
    handleSaveBillingPlan: (planKey: string) => void;
    saveBillingPlanMutation: UseMutationResult<unknown, Error, { planKey: string; stripe_price_id: string; stripe_product_id: string }, unknown>;
    t: (key: string) => string;
};

export function IntegrationBillingSection({
    billingPlanDrafts,
    stripeConfigurablePlans,
    isBillingPlansLoading,
    billingPlansError,
    handleBillingPlanDraftChange,
    handleSaveBillingPlan,
    saveBillingPlanMutation,
    t,
}: IntegrationBillingSectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    {t("Stripe Billing Plans")}
                </CardTitle>
                <CardDescription>
                    {t("Set Stripe product and price IDs for each billing plan without changing code.")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isBillingPlansLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("Loading plans...")}
                    </div>
                ) : billingPlansError ? (
                    <div className="rounded-md border px-3 py-2 text-sm flex items-center gap-2" style={INTEGRATION_ERROR_STYLE}>
                        <AlertCircle className="w-4 h-4" />
                        <span>
                            {t("Failed to load billing plans")}:{" "}
                            {(billingPlansError as Error).message || t("Unknown error")}
                        </span>
                    </div>
                ) : stripeConfigurablePlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No paid billing plans found.")}</p>
                ) : (
                    <div className="space-y-3">
                        {stripeConfigurablePlans.map((plan) => {
                            const draft = billingPlanDrafts[plan.plan_key] || {
                                stripe_price_id: "",
                                stripe_product_id: "",
                            };
                            const isSavingThisPlan =
                                saveBillingPlanMutation.isPending &&
                                saveBillingPlanMutation.variables?.planKey === plan.plan_key;

                            return (
                                <div key={plan.id} className="rounded-lg border p-3 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {plan.display_name}{" "}
                                                <span className="text-muted-foreground">({plan.plan_key})</span>
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t("Active")}: {plan.active ? t("Yes") : t("No")}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => handleSaveBillingPlan(plan.plan_key)}
                                            disabled={saveBillingPlanMutation.isPending}
                                        >
                                            {isSavingThisPlan ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    {t("Saving...")}
                                                </>
                                            ) : (
                                                t("Save")
                                            )}
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label>{t("Stripe Price ID")}</Label>
                                            <Input
                                                value={draft.stripe_price_id}
                                                onChange={(e) =>
                                                    handleBillingPlanDraftChange(
                                                        plan.plan_key,
                                                        "stripe_price_id",
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="price_..."
                                                disabled={saveBillingPlanMutation.isPending}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>{t("Stripe Product ID")}</Label>
                                            <Input
                                                value={draft.stripe_product_id}
                                                onChange={(e) =>
                                                    handleBillingPlanDraftChange(
                                                        plan.plan_key,
                                                        "stripe_product_id",
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="prod_..."
                                                disabled={saveBillingPlanMutation.isPending}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
