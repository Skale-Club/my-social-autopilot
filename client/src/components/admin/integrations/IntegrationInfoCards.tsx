/**
 * IntegrationInfoCards - Read-only status cards for Gemini, Stripe, and Supabase
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Database, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type IntegrationStatusBadgeProps = {
    active: boolean;
    label: string;
};

function IntegrationStatusBadge({ active, label }: IntegrationStatusBadgeProps) {
    return (
        <Badge
            variant={active ? "default" : "destructive"}
            className={`inline-flex w-28 justify-center ${active ? "text-white" : ""}`}
            style={active ? { backgroundColor: "var(--app-success-color)" } : undefined}
        >
            {label}
        </Badge>
    );
}

type IntegrationRowProps = {
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
};

function IntegrationRow({ label, active, activeLabel, inactiveLabel }: IntegrationRowProps) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <IntegrationStatusBadge active={active} label={active ? activeLabel : inactiveLabel} />
        </div>
    );
}

export type IntegrationInfoCardsProps = {
    gemini_server_key_configured: boolean;
    stripe_secret_key_configured: boolean;
    stripe_webhook_secret_configured: boolean;
    stripe_fully_configured: boolean;
    supabase_url_configured: boolean;
    supabase_anon_key_configured: boolean;
    supabase_service_role_key_configured: boolean;
    adminApiKey: string | null | undefined;
    t: (key: string) => string;
};

export function IntegrationInfoCards({
    gemini_server_key_configured,
    stripe_secret_key_configured,
    stripe_webhook_secret_configured,
    stripe_fully_configured,
    supabase_url_configured,
    supabase_anon_key_configured,
    supabase_service_role_key_configured,
    adminApiKey,
    t,
}: IntegrationInfoCardsProps) {
    return (
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <Card className="h-full w-full min-h-[252px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="w-4 h-4" />
                        {t("Google Gemini")}
                    </CardTitle>
                    <CardDescription>{t("AI generation keys used by the platform")}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col pt-0">
                    <IntegrationRow
                        label={t("Server Gemini API key")}
                        active={gemini_server_key_configured}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                    <IntegrationRow
                        label={t("Admin user API key")}
                        active={Boolean(adminApiKey)}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                </CardContent>
            </Card>

            <Card className="h-full w-full min-h-[252px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <CreditCard className="w-4 h-4" />
                        {t("Stripe")}
                    </CardTitle>
                    <CardDescription>{t("Billing and webhook processing")}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col pt-0">
                    <IntegrationRow
                        label={t("Secret key")}
                        active={stripe_secret_key_configured}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                    <IntegrationRow
                        label={t("Webhook secret")}
                        active={stripe_webhook_secret_configured}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                    <IntegrationRow
                        label={t("Fully configured")}
                        active={stripe_fully_configured}
                        activeLabel={t("Ready")}
                        inactiveLabel={t("Incomplete")}
                    />
                </CardContent>
            </Card>

            <Card className="h-full w-full min-h-[252px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="w-4 h-4" />
                        {t("Supabase")}
                    </CardTitle>
                    <CardDescription>{t("Database, auth, and storage configuration")}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col pt-0">
                    <IntegrationRow
                        label={t("Project URL")}
                        active={supabase_url_configured}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                    <IntegrationRow
                        label={t("Anon key")}
                        active={supabase_anon_key_configured}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                    <IntegrationRow
                        label={t("Service role key")}
                        active={supabase_service_role_key_configured}
                        activeLabel={t("Connected")}
                        inactiveLabel={t("Missing")}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
