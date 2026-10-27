"use client";

import { useEffect, useMemo, useState } from "react";

const planDefinition = [
  { id: "weekly", label: "Weekly", normalPrice: 200 },
  { id: "monthly", label: "Monthly", normalPrice: 500 },
  { id: "annually", label: "Annual", normalPrice: 2000 },
  { id: "lifetime", label: "Lifetime", normalPrice: 5000 },
] as const;

type PromotionPlanEntry = {
  promotionalPrice: number;
  enabled: boolean;
};

type PromotionFormState = {
  name: string;
  enabled: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  planPrices: Record<string, PromotionPlanEntry>;
  applicablePlans: string[];
};

interface Promotion {
  id: string;
  enabled: boolean;
  name: string;
  title: string;
  description: string;
  offerText: string;
  buttonText: string;
  buttonAction: string;
  applicablePlans: string[];
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  planPrices?: Record<string, { promotionalPrice?: number; enabled?: boolean }>;
  createdAt: string;
  updatedAt: string;
}

interface AdminButtonProps {
  variant: "primary" | "secondary" | "danger" | "success" | "outline" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: string;
}

function AdminButton({ variant, size = "md", disabled = false, onClick, children, icon }: AdminButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-bold uppercase transition-all duration-200 cursor-pointer";
  const sizeStyles: Record<string, string> = { sm: "h-8 px-3 text-[10px] rounded-lg", md: "h-10 px-4 text-[13px] rounded-xl" };
  const variantStyles: Record<string, string> = {
    primary: "bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed",
    danger: "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed",
    outline: "border border-white/20 text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed",
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} whitespace-nowrap`}>
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

function calculateSavings(normalPrice: number, promotionalPrice: number) {
  const safePromo = Number.isFinite(promotionalPrice) ? Math.max(0, Math.min(promotionalPrice, normalPrice)) : normalPrice;
  const discountAmount = Math.max(0, normalPrice - safePromo);
  const discountPercent = normalPrice > 0 ? Math.round((discountAmount / normalPrice) * 100) : 0;
  return { discountAmount, discountPercent };
}

function createEmptyPlanPrices() {
  return Object.fromEntries(
    planDefinition.map((plan) => [plan.id, { promotionalPrice: plan.normalPrice, enabled: true }])
  ) as Record<string, PromotionPlanEntry>;
}

export function PromotionsManagement() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromotionFormState>({
    name: "New Year Offer",
    enabled: true,
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    planPrices: createEmptyPlanPrices(),
    applicablePlans: ["weekly", "monthly", "annually", "lifetime"],
  });

  const previewPlan = useMemo(() => {
    const plan = planDefinition.find((item) => item.id === "monthly") || planDefinition[0];
    const promoPrice = formData.planPrices[plan.id]?.promotionalPrice ?? plan.normalPrice;
    const { discountAmount, discountPercent } = calculateSavings(plan.normalPrice, promoPrice);
    return { plan, promoPrice, discountAmount, discountPercent };
  }, [formData]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await fetch("/api/admin/promotions");
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.promotions)) {
        setPromotions([]);
        setLoadError(data.error || "Unable to load promotions.");
        return;
      }
      setPromotions(data.promotions);
    } catch {
      setPromotions([]);
      setLoadError("Unable to load promotions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "New Year Offer",
      enabled: true,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      planPrices: createEmptyPlanPrices(),
      applicablePlans: ["weekly", "monthly", "annually", "lifetime"],
    });
  };

  const populateFormFromPromo = (promo: Promotion) => {
    const normalizedPlanPrices = Object.fromEntries(
      planDefinition.map((plan) => [
        plan.id,
        {
          promotionalPrice: Number(promo.planPrices?.[plan.id]?.promotionalPrice ?? plan.normalPrice),
          enabled: promo.applicablePlans?.length ? promo.applicablePlans.includes(plan.id) : true,
        },
      ])
    ) as Record<string, PromotionPlanEntry>;

    setFormData({
      name: promo.name || promo.title || "Limited-Time Offer",
      enabled: !!promo.enabled,
      startDate: promo.startDate || "",
      startTime: promo.startTime || "",
      endDate: promo.endDate || "",
      endTime: promo.endTime || "",
      planPrices: normalizedPlanPrices,
      applicablePlans: promo.applicablePlans?.length ? [...promo.applicablePlans] : ["weekly", "monthly", "annually", "lifetime"],
    });
  };

  const handleAddNew = () => {
    setEditingPromo(null);
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    populateFormFromPromo(promo);
    setShowForm(true);
  };

  const handleTogglePlan = (planId: string) => {
    setFormData((current) => {
      const nextEnabled = !(current.planPrices[planId]?.enabled ?? true);
      const nextApplicablePlans = nextEnabled
        ? Array.from(new Set([...current.applicablePlans, planId]))
        : current.applicablePlans.filter((id) => id !== planId);

      return {
        ...current,
        planPrices: {
          ...current.planPrices,
          [planId]: {
            ...current.planPrices[planId],
            enabled: nextEnabled,
          },
        },
        applicablePlans: nextApplicablePlans,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        id: editingPromo?.id,
        name: formData.name || "Limited-Time Offer",
        title: formData.name || "Limited-Time Offer",
        description: "Limited-time promotional pricing for selected plans.",
        offerText: "LIMITED-TIME OFFER",
        buttonText: "GET STARTED",
        buttonAction: "scroll-to-plans",
        enabled: formData.enabled,
        startDate: formData.startDate || "",
        startTime: formData.startTime || "",
        endDate: formData.endDate || "",
        endTime: formData.endTime || "",
        applicablePlans: formData.applicablePlans,
        planPrices: Object.fromEntries(
          planDefinition.map((plan) => [
            plan.id,
            {
              promotionalPrice: Number(formData.planPrices[plan.id]?.promotionalPrice ?? plan.normalPrice),
              enabled: formData.planPrices[plan.id]?.enabled ?? true,
            },
          ])
        ),
      };

      const response = await fetch(editingPromo ? `/api/admin/promotions/${editingPromo.id}` : "/api/admin/promotions", {
        method: editingPromo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        const message = String(data?.error || data?.message || "Unable to save promotion.");
        console.error("Promotion save failed:", message);
        setSaveError(message);
        return;
      }

      await fetchPromotions();
      setShowForm(false);
      setEditingPromo(null);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save promotion.";
      console.error("Failed to save promotion:", error);
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (promo: Promotion) => {
    try {
      const response = await fetch(`/api/admin/promotions/${promo.id}/toggle`, { method: "POST" });
      const data = await response.json();
      if (data.ok) {
        await fetchPromotions();
      }
    } catch (error) {
      console.error("Failed to toggle promotion:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    try {
      const response = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.ok) {
        await fetchPromotions();
      }
    } catch (error) {
      console.error("Failed to delete promotion:", error);
    }
  };

  if (loading) return <div className="text-center text-slate-400">Loading promotions...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-white">🎯 Promotions / Offers</h2>
        <AdminButton variant="primary" onClick={handleAddNew} disabled={Boolean(loadError)} icon="➕">New Promotion</AdminButton>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <AdminButton variant="outline" size="sm" onClick={fetchPromotions}>Retry</AdminButton>
        </div>
      )}

      {showForm && (
        <div className="space-y-6 rounded-2xl border border-cyan-400/20 bg-slate-900/60 p-6">
          {saveError && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {saveError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-300">Promotion Name</label>
              <input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                placeholder="New Year Offer"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Promotion Status</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                className={`rounded-lg border px-4 py-2 font-bold uppercase ${
                  formData.enabled ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-slate-400/30 bg-slate-700/40 text-slate-300"
                }`}
              >
                {formData.enabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="md:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">Start Date</label>
                  <input type="date" value={formData.startDate} onChange={(event) => setFormData({ ...formData, startDate: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">Start Time</label>
                  <input type="time" value={formData.startTime} onChange={(event) => setFormData({ ...formData, startTime: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">End Date</label>
                  <input type="date" value={formData.endDate} onChange={(event) => setFormData({ ...formData, endDate: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">End Time</label>
                  <input type="time" value={formData.endTime} onChange={(event) => setFormData({ ...formData, endTime: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-slate-950/60 p-4">
            <h3 className="mb-4 text-xl font-black text-white">Promotional Plan Prices</h3>
            <div className="space-y-4">
              {planDefinition.map((plan) => {
                const entry = formData.planPrices[plan.id] ?? { promotionalPrice: plan.normalPrice, enabled: true };
                const { discountAmount, discountPercent } = calculateSavings(plan.normalPrice, Number(entry.promotionalPrice ?? plan.normalPrice));
                const isSelected = formData.applicablePlans.includes(plan.id);

                return (
                  <div key={plan.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">{plan.label}</p>
                        <p className="mt-1 text-xs text-slate-400">Normal Price: Rs. {plan.normalPrice.toLocaleString()}</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-300">
                        <input type="checkbox" checked={Boolean(entry.enabled) && isSelected} onChange={() => handleTogglePlan(plan.id)} />
                        Included
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Promotional Price</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={entry.promotionalPrice ?? plan.normalPrice}
                          onChange={(event) => {
                            const value = Number(event.target.value || 0);
                            setFormData((current) => ({
                              ...current,
                              planPrices: {
                                ...current.planPrices,
                                [plan.id]: {
                                  ...current.planPrices[plan.id],
                                  promotionalPrice: value,
                                },
                              },
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Discount</label>
                        <div className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white">{discountPercent}% OFF</div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Save</label>
                        <div className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white">Rs. {discountAmount.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/60 p-4">
            <h3 className="mb-4 text-lg font-black text-white">Live Preview</h3>
            <div className="mx-auto max-w-xs rounded-2xl border border-red-400/30 bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-center shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-red-300">🔥 {formData.name || "SPECIAL OFFER"}</p>
              <p className="mt-4 text-lg font-black text-white">{previewPlan.plan.label}</p>
              <p className="mt-4 text-sm text-slate-400 line-through">Rs. {previewPlan.plan.normalPrice.toLocaleString()}</p>
              <p className="mt-2 text-3xl font-black text-cyan-300">Rs. {previewPlan.promoPrice.toLocaleString()}</p>
              <p className="mt-3 text-sm font-bold text-amber-300">{previewPlan.discountPercent}% OFF</p>
              <div className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white">GET STARTED</div>
            </div>
          </div>

          <div className="flex gap-3">
            <AdminButton variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Promotion"}</AdminButton>
            <AdminButton variant="outline" onClick={() => { setShowForm(false); setEditingPromo(null); resetForm(); }}>Cancel</AdminButton>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loadError ? null : promotions.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-6 text-center text-slate-400">No promotions yet. Create one to get started!</div>
        ) : (
          promotions.map((promo) => {
            const plansIncluded = promo.applicablePlans?.length ? promo.applicablePlans.length : 4;
            const statusLabel = promo.enabled ? "ACTIVE" : "OFF";
            const dateLabel = promo.startDate ? new Date(`${promo.startDate}T${promo.startTime || "00:00"}`).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "--";
            const endLabel = promo.endDate ? new Date(`${promo.endDate}T${promo.endTime || "23:59"}`).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "--";

            return (
              <div key={promo.id} className={`rounded-xl border ${promo.enabled ? "border-cyan-400/30" : "border-slate-600/30"} bg-slate-900/50 p-4`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{promo.name || promo.title}</h3>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${promo.enabled ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-slate-400/30 bg-slate-500/10 text-slate-200"}`}>{statusLabel}</span>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-4">
                      <span>{dateLabel}</span>
                      <span>{endLabel}</span>
                      <span>{plansIncluded} Plans</span>
                      <span>{promo.enabled ? "Live" : "Paused"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <AdminButton variant={promo.enabled ? "success" : "outline"} size="sm" onClick={() => handleToggle(promo)} icon={promo.enabled ? "✓" : "○"}>{promo.enabled ? "ON" : "OFF"}</AdminButton>
                    <AdminButton variant="secondary" size="sm" onClick={() => handleEdit(promo)} icon="✏️">EDIT</AdminButton>
                    <AdminButton variant="danger" size="sm" onClick={() => handleDelete(promo.id)} icon="🗑️">DELETE</AdminButton>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
