/**
 * IntegrationWebsiteEvents - Website events table showing per-integration active status
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type WebsiteEventSetup = {
    key: string;
    name: string;
    trigger: string;
    ga4: boolean | null;
    facebook: boolean | null;
    ghl: boolean | null;
    telegram: boolean | null;
    active: boolean;
};

export type IntegrationWebsiteEventsProps = {
    websiteEvents: WebsiteEventSetup[];
    t: (key: string) => string;
};

export function IntegrationWebsiteEvents({ websiteEvents, t }: IntegrationWebsiteEventsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("Website Events")}</CardTitle>
                <CardDescription>
                    {t("Events configured in the platform and whether they are currently active.")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {websiteEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No website events configured yet.")}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/60 text-left text-muted-foreground">
                                    <th className="py-2 pr-3">{t("Event")}</th>
                                    <th className="py-2 pr-3">{t("Trigger")}</th>
                                    <th className="py-2 pr-3">{t("GA4")}</th>
                                    <th className="py-2 pr-3">{t("Facebook")}</th>
                                    <th className="py-2 pr-3">{t("GHL")}</th>
                                    <th className="py-2 pr-3">{t("Telegram")}</th>
                                    <th className="py-2">{t("Status")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {websiteEvents.map((event) => (
                                    <tr key={event.key} className="border-b border-border/40">
                                        <td className="py-2 pr-3 font-medium">{event.name}</td>
                                        <td className="py-2 pr-3 text-muted-foreground">{event.trigger}</td>
                                        <td className="py-2 pr-3">
                                            {event.ga4 === null ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : (
                                                <Badge variant={event.ga4 ? "default" : "secondary"}>
                                                    {event.ga4 ? t("Active") : t("Inactive")}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3">
                                            {event.facebook === null ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : (
                                                <Badge variant={event.facebook ? "default" : "secondary"}>
                                                    {event.facebook ? t("Active") : t("Inactive")}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3">
                                            {event.ghl === null ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : (
                                                <Badge variant={event.ghl ? "default" : "secondary"}>
                                                    {event.ghl ? t("Active") : t("Inactive")}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3">
                                            {event.telegram === null ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : (
                                                <Badge variant={event.telegram ? "default" : "secondary"}>
                                                    {event.telegram ? t("Active") : t("Inactive")}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-2">
                                            <Badge variant={event.active ? "default" : "secondary"}>
                                                {event.active ? t("Active") : t("Inactive")}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
