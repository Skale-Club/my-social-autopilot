import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, ImageIcon, Building2, Shield, ShieldOff, Search, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  totalBrands: number;
  newUsersToday: number;
  newPostsToday: number;
}

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  has_api_key: boolean;
  brand_name: string | null;
  post_count: number;
}

async function adminFetch(path: string) {
  const sb = supabase();
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => adminFetch("/api/admin/stats"),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["/api/admin/users"],
    queryFn: () => adminFetch("/api/admin/users"),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ id, is_admin }: { id: string; is_admin: boolean }) => {
      const sb = supabase();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`/api/admin/users/${id}/admin`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ is_admin }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Admin status updated" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    },
  });

  const filtered = (usersData?.users || []).filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.brand_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, sub: `+${stats?.newUsersToday ?? 0} today` },
    { label: "Total Posts", value: stats?.totalPosts ?? "—", icon: ImageIcon, sub: `+${stats?.newPostsToday ?? 0} today` },
    { label: "Brands Created", value: stats?.totalBrands ?? "—", icon: Building2, sub: "All time" },
    { label: "Posts / User", value: stats?.totalUsers ? ((stats.totalPosts / stats.totalUsers).toFixed(1)) : "—", icon: TrendingUp, sub: "Average" },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="admin-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overview and user management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} data-testid={`stat-${card.label.toLowerCase().replace(/ /g, "-")}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <card.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg">Users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or brand..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
                <span>Email</span>
                <span>Brand</span>
                <span>Posts</span>
                <span>API Key</span>
                <span>Joined</span>
                <span>Role</span>
              </div>
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
              )}
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 items-center text-sm"
                  data-testid={`row-user-${u.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.email}</p>
                    {u.id === user?.id && (
                      <span className="text-xs text-primary">You</span>
                    )}
                  </div>
                  <span className="text-muted-foreground truncate">{u.brand_name || "—"}</span>
                  <span className="text-center font-mono text-sm">{u.post_count}</span>
                  <span className="text-center">
                    {u.has_api_key
                      ? <Badge variant="secondary" className="text-xs">Set</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">None</Badge>}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {u.is_admin ? (
                      <Badge className="text-xs gap-1">
                        <Shield className="w-3 h-3" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">User</Badge>
                    )}
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={toggleAdminMutation.isPending}
                        onClick={() => toggleAdminMutation.mutate({ id: u.id, is_admin: !u.is_admin })}
                        data-testid={`button-toggle-admin-${u.id}`}
                      >
                        {u.is_admin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
