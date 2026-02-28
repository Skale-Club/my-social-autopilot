import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Key, ExternalLink, Eye, EyeOff, Check, Shield, Palette, Upload, ImageIcon, X } from "lucide-react";
import { useCallback } from "react";
import { motion } from "framer-motion";

function isValidHex(val: string) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val);
}

export default function SettingsPage() {
  const { profile, user, brand, refreshProfile, refreshBrand } = useAuth();
  const [apiKey, setApiKey] = useState(profile?.api_key || "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [color1, setColor1] = useState(brand?.color_1 || "#2563EB");
  const [color2, setColor2] = useState(brand?.color_2 || "#7C3AED");
  const [color3, setColor3] = useState(brand?.color_3 || "#F59E0B");
  const [savingColors, setSavingColors] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);

  useEffect(() => {
    if (brand) {
      setColor1(brand.color_1);
      setColor2(brand.color_2);
      setColor3(brand.color_3);
    }
  }, [brand]);

  const handleLogoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  async function handleSaveLogo() {
    if (!brand || !logoFile || !user) return;
    setSavingLogo(true);
    const sb = supabase();
    const ext = logoFile.name.split(".").pop() || "png";
    const filePath = `${user.id}/logo.${ext}`;
    const { error: uploadError } = await sb.storage
      .from("user_assets")
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setSavingLogo(false);
      return;
    }

    const { data: { publicUrl } } = sb.storage.from("user_assets").getPublicUrl(filePath);
    const { error } = await sb.from("brands").update({ logo_url: publicUrl }).eq("id", brand.id);
    setSavingLogo(false);

    if (error) {
      toast({ title: "Failed to save logo", description: error.message, variant: "destructive" });
    } else {
      await refreshBrand();
      setLogoFile(null);
      setLogoPreview(null);
      toast({ title: "Logo updated successfully" });
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      toast({ title: "Please enter your API key", variant: "destructive" });
      return;
    }
    setSaving(true);
    const sb = supabase();
    const { error } = await sb
      .from("profiles")
      .update({ api_key: apiKey.trim() })
      .eq("id", user!.id);
    setSaving(false);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "API key saved successfully" });
    }
  }

  async function handleSaveColors() {
    if (!brand) return;
    if (!isValidHex(color1) || !isValidHex(color2) || !isValidHex(color3)) {
      toast({ title: "Invalid hex color", description: "Colors must be in #RRGGBB or #RGB format.", variant: "destructive" });
      return;
    }
    setSavingColors(true);
    const sb = supabase();
    const { error } = await sb
      .from("brands")
      .update({ color_1: color1, color_2: color2, color_3: color3 })
      .eq("id", brand.id);
    setSavingColors(false);

    if (error) {
      toast({ title: "Failed to save colors", description: error.message, variant: "destructive" });
    } else {
      await refreshBrand();
      toast({ title: "Brand colors updated" });
    }
  }

  function handleHexInput(val: string, setter: (v: string) => void) {
    const trimmed = val.startsWith("#") ? val : `#${val}`;
    setter(trimmed);
  }

  const isFirstTime = !profile?.api_key;

  const colorFields = [
    { label: "Primary", value: color1, set: setColor1, testId: "primary" },
    { label: "Secondary", value: color2, set: setColor2, testId: "secondary" },
    { label: "Accent", value: color3, set: setColor3, testId: "accent" },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {isFirstTime && (
            <div className="rounded-md bg-violet-400/10 border border-violet-400/20 p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-pink-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Setup Required</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    To generate AI content, you need to add your Google Gemini API key first.
                    Your key is stored securely and only used to make API calls on your behalf.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and brand configuration.
            </p>
          </div>

          {brand && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-400/15 flex items-center justify-center">
                    <Palette className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Brand Colors</CardTitle>
                    <CardDescription>
                      Edit the colors used in your AI-generated posts
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  {colorFields.map(({ label, value, set, testId }) => (
                    <div key={label} className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                      <div className="relative">
                        <div
                          className="w-full h-12 rounded-lg border-2 border-border cursor-pointer transition-transform hover:scale-105"
                          style={{ backgroundColor: isValidHex(value) ? value : "#888888" }}
                          data-testid={`color-swatch-${testId}`}
                        />
                        <input
                          type="color"
                          value={isValidHex(value) ? value : "#888888"}
                          onChange={(e) => set(e.target.value)}
                          className="absolute inset-0 w-full h-12 opacity-0 cursor-pointer"
                          data-testid={`input-color-picker-${testId}`}
                        />
                      </div>
                      <Input
                        value={value}
                        onChange={(e) => handleHexInput(e.target.value, set)}
                        className="text-center text-xs font-mono h-8"
                        maxLength={7}
                        placeholder="#000000"
                        data-testid={`input-color-hex-${testId}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Preview:</span>
                    <div className="flex gap-1.5">
                      {colorFields.map(({ label, value }) => (
                        <div
                          key={label}
                          className="w-6 h-6 rounded-md border border-border"
                          style={{ backgroundColor: isValidHex(value) ? value : "#888888" }}
                          title={label}
                          data-testid={`preview-color-${label.toLowerCase()}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveColors}
                    disabled={savingColors}
                    data-testid="button-save-colors"
                  >
                    {savingColors ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Save Colors
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {brand && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-400/15 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Brand Logo</CardTitle>
                    <CardDescription>
                      Logo used in your AI-generated posts
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="flex-shrink-0">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Current Logo</Label>
                    <div className="w-24 h-24 rounded-xl border-2 border-border bg-muted/40 flex items-center justify-center overflow-hidden">
                      {logoPreview ? (
                        <img src={logoPreview} alt="New logo preview" className="max-w-full max-h-full object-contain" data-testid="img-logo-new-preview" />
                      ) : brand.logo_url ? (
                        <img src={brand.logo_url} alt="Brand logo" className="max-w-full max-h-full object-contain" data-testid="img-logo-current" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground block">
                      {logoFile ? `Selected: ${logoFile.name}` : "Upload a new logo"}
                    </Label>
                    <label
                      className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-violet-400/50 hover:bg-violet-400/5 transition-colors"
                      data-testid="upload-logo-zone-settings"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">PNG, JPG, SVG up to 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoSelect}
                        className="hidden"
                        data-testid="input-logo-file-settings"
                      />
                    </label>

                    {logoFile && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleSaveLogo}
                          disabled={savingLogo}
                          data-testid="button-save-logo"
                        >
                          {savingLogo ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Save Logo
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                          data-testid="button-cancel-logo"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-400/15 flex items-center justify-center">
                  <Key className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Google Gemini API Key</CardTitle>
                  <CardDescription>
                    Used for AI-powered content and image generation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    placeholder="AIza..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                    data-testid="input-api-key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowKey(!showKey)}
                    data-testid="button-toggle-key"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-violet-400"
                  data-testid="link-get-key"
                >
                  Get your API key from Google AI Studio
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Button
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  data-testid="button-save-key"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save Key
                </Button>
              </div>

              {profile?.api_key && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  API key is configured
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
