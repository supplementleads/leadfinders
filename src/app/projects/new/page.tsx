"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PlatformType } from "@/lib/types";

const PLATFORMS: { value: PlatformType; label: string; duration: number }[] = [
  { value: "tiktok", label: "TikTok", duration: 15 },
  { value: "instagram_reels", label: "Instagram Reels", duration: 30 },
  { value: "instagram_feed", label: "Instagram Feed", duration: 60 },
  { value: "youtube", label: "YouTube", duration: 90 },
  { value: "youtube_shorts", label: "YouTube Shorts", duration: 60 },
  { value: "tvc", label: "TVC (30s)", duration: 30 },
  { value: "cinema", label: "Cinema", duration: 120 },
];

const EMOTIONS = [
  "Aspirational", "Nostalgic", "Energetic", "Calm", "Empowering",
  "Playful", "Luxurious", "Urgent", "Joyful", "Melancholic",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    product_name: "",
    product_description: "",
    brand_name: "",
    brand_identity: "",
    target_audience: "",
    desired_emotion: "Aspirational",
    platform: "youtube" as PlatformType,
    video_duration_sec: 30,
    reference_styles: [] as string[],
    color_palette: [] as string[],
    additional_notes: "",
    autonomous: false,
  });
  const [styleInput, setStyleInput] = useState("");
  const [colorInput, setColorInput] = useState("");

  function update(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addStyle() {
    if (styleInput.trim() && !form.reference_styles.includes(styleInput.trim())) {
      update("reference_styles", [...form.reference_styles, styleInput.trim()]);
      setStyleInput("");
    }
  }

  function addColor() {
    const c = colorInput.trim();
    if (c && !form.color_palette.includes(c)) {
      update("color_palette", [...form.color_palette, c]);
      setColorInput("");
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || `${form.brand_name} — ${form.platform}`,
          autonomous: form.autonomous,
          input: {
            product_name: form.product_name,
            product_description: form.product_description,
            brand_name: form.brand_name,
            brand_identity: form.brand_identity,
            target_audience: form.target_audience,
            desired_emotion: form.desired_emotion,
            platform: form.platform,
            video_duration_sec: form.video_duration_sec,
            reference_styles: form.reference_styles,
            color_palette: form.color_palette,
            additional_notes: form.additional_notes || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Auto-start if autonomous
        if (form.autonomous) {
          await fetch(`/api/projects/${data.data.id}/run`, { method: "POST" });
        }
        router.push(`/projects/${data.data.id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-studio-surface2 border border-studio-border rounded-xl px-4 py-3 text-sm text-studio-text placeholder-studio-muted focus:outline-none focus:border-studio-amber/40 transition-colors";
  const labelClass = "block text-xs font-mono text-studio-muted mb-2 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-studio-bg">
      <header className="border-b border-studio-border bg-studio-surface px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-studio-muted hover:text-studio-text transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-sm font-bold text-studio-text">New Production</h1>
        <div className="ml-auto flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${s <= step ? "bg-studio-amber" : "bg-studio-border"}`}
            />
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-studio-text mb-1">Product Brief</h2>
              <p className="text-sm text-studio-muted">Tell us what you&apos;re creating</p>
            </div>

            <div>
              <label className={labelClass}>Project Name (optional)</label>
              <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Nike Air Max — Summer 2025 Launch" />
            </div>
            <div>
              <label className={labelClass}>Product Name *</label>
              <input className={inputClass} value={form.product_name} onChange={(e) => update("product_name", e.target.value)} placeholder="e.g. KratomLyte Energy" />
            </div>
            <div>
              <label className={labelClass}>Product Description *</label>
              <textarea className={inputClass + " h-24 resize-none"} value={form.product_description} onChange={(e) => update("product_description", e.target.value)} placeholder="Describe your product, its key benefits, and what makes it unique..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Brand Name *</label>
                <input className={inputClass} value={form.brand_name} onChange={(e) => update("brand_name", e.target.value)} placeholder="e.g. KratomLyte" />
              </div>
              <div>
                <label className={labelClass}>Target Audience *</label>
                <input className={inputClass} value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} placeholder="e.g. 25-35 health-conscious professionals" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Brand Identity *</label>
              <textarea className={inputClass + " h-20 resize-none"} value={form.brand_identity} onChange={(e) => update("brand_identity", e.target.value)} placeholder="e.g. Premium, natural, energizing. We blend science with nature..." />
            </div>

            <Button variant="primary" className="w-full" onClick={() => setStep(2)} disabled={!form.product_name || !form.brand_name || !form.product_description}>
              Continue →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-studio-text mb-1">Creative Direction</h2>
              <p className="text-sm text-studio-muted">Shape the visual and emotional language</p>
            </div>

            <div>
              <label className={labelClass}>Platform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => { update("platform", p.value); update("video_duration_sec", p.duration); }}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${form.platform === p.value ? "bg-studio-amber/10 border-studio-amber text-studio-amber" : "bg-studio-surface2 border-studio-border text-studio-muted hover:text-studio-text"}`}
                  >
                    {p.label}
                    <div className="text-studio-muted font-mono mt-0.5">{p.duration}s</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Duration (seconds)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={5} max={180} value={form.video_duration_sec} onChange={(e) => update("video_duration_sec", Number(e.target.value))} className="flex-1 accent-studio-amber" />
                <span className="text-sm font-mono text-studio-amber w-12 text-right">{form.video_duration_sec}s</span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Desired Emotion</label>
              <div className="flex flex-wrap gap-2">
                {EMOTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => update("desired_emotion", e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${form.desired_emotion === e ? "bg-studio-amber/10 border-studio-amber text-studio-amber" : "bg-studio-surface2 border-studio-border text-studio-muted hover:text-studio-text"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Reference Styles</label>
              <div className="flex gap-2 mb-2">
                <input className={inputClass} value={styleInput} onChange={(e) => setStyleInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStyle()} placeholder="e.g. Apple iPhone 15 Pro, Dior J'adore, BMW films..." />
                <Button variant="secondary" size="sm" onClick={addStyle}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.reference_styles.map((s) => (
                  <span key={s} className="flex items-center gap-1 bg-studio-surface2 border border-studio-border rounded-lg px-2 py-1 text-xs text-studio-text">
                    {s}
                    <button onClick={() => update("reference_styles", form.reference_styles.filter((r) => r !== s))} className="text-studio-muted hover:text-studio-red ml-1">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="primary" className="flex-1" onClick={() => setStep(3)}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-studio-text mb-1">Pipeline Settings</h2>
              <p className="text-sm text-studio-muted">Configure how the AI pipeline runs</p>
            </div>

            {/* Summary */}
            <div className="bg-studio-surface2 border border-studio-border rounded-xl p-4 space-y-2">
              <div className="text-xs font-mono text-studio-muted mb-3">BRIEF SUMMARY</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-studio-muted">Product:</span> <span className="text-studio-text">{form.product_name}</span></div>
                <div><span className="text-studio-muted">Brand:</span> <span className="text-studio-text">{form.brand_name}</span></div>
                <div><span className="text-studio-muted">Platform:</span> <span className="text-studio-text">{form.platform}</span></div>
                <div><span className="text-studio-muted">Duration:</span> <span className="text-studio-amber font-mono">{form.video_duration_sec}s</span></div>
                <div><span className="text-studio-muted">Emotion:</span> <span className="text-studio-text">{form.desired_emotion}</span></div>
              </div>
            </div>

            {/* Autonomous mode */}
            <div className="bg-studio-surface2 border border-studio-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-studio-text">Autonomous Mode</div>
                  <div className="text-xs text-studio-muted mt-0.5">
                    Run the full pipeline without stopping for approvals
                  </div>
                </div>
                <button
                  onClick={() => update("autonomous", !form.autonomous)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${form.autonomous ? "bg-studio-amber" : "bg-studio-surface3"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${form.autonomous ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              {!form.autonomous && (
                <div className="text-xs text-studio-muted/70 bg-studio-surface rounded-lg p-2 font-mono">
                  Supervised mode: You will review scenes before the editor assembles the final cut
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Additional Notes (optional)</label>
              <textarea className={inputClass + " h-20 resize-none"} value={form.additional_notes} onChange={(e) => update("additional_notes", e.target.value)} placeholder="Any special instructions, brand restrictions, or creative constraints..." />
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Creating..." : form.autonomous ? "Create & Launch Pipeline" : "Create Project"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
