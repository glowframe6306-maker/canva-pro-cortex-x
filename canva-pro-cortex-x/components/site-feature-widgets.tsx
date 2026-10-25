"use client";

import { useEffect, useMemo, useState } from "react";
import type { FAQItem, PromoCode, SiteSettings } from "@/lib/site-settings";

const defaultEmpty = {
  featuredPlanId: "monthly",
  featuredPlanEnabled: true,
  featuredBadgeText: "MOST POPULAR",
  announcement: {
    enabled: true,
    message: "Special offers and new plans are now available.",
    buttonText: "VIEW PLANS",
    buttonAction: "scroll-to-plans",
  },
  faqs: [],
  promoCodes: [],
  discountStacking: false,
};

export function AnnouncementBar({ onScrollToPlans }: { onScrollToPlans?: () => void }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) setSettings(result.settings || defaultEmpty as SiteSettings);
      })
      .catch(() => setSettings(defaultEmpty as SiteSettings));
  }, []);

  if (!settings?.announcement?.enabled || !settings.announcement.message) return null;

  const handleClick = () => {
    if (settings.announcement.buttonAction === "scroll-to-plans" && onScrollToPlans) {
      onScrollToPlans();
    }
  };

  return (
    <div className="border-b border-cyan-400/20 bg-gradient-to-r from-cyan-500/15 via-slate-900/90 to-blue-500/15 px-3 py-2 text-center text-sm text-cyan-100 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 sm:flex-row">
        <span>🔔</span>
        <span className="font-semibold">{settings.announcement.message}</span>
        {settings.announcement.buttonText && (
          <button
            type="button"
            onClick={handleClick}
            className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/20"
          >
            {settings.announcement.buttonText}
          </button>
        )}
      </div>
    </div>
  );
}

export function FeaturedPlanCard({ planId, planLabel, enabled, badgeText }: { planId?: string; planLabel?: string; enabled?: boolean; badgeText?: string }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
      <span>⭐</span>
      <span>{enabled ? (badgeText || "MOST POPULAR") : "FEATURED PLAN"}</span>
      {planLabel && <span className="text-amber-100">• {planLabel}</span>}
    </div>
  );
}

export function FeaturedPlanSection({ plans }: { plans: Array<{ id: string; name: string; price: number; duration: string; icon?: string; gradient?: string; description?: string; badge?: string }> }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) setSettings(result.settings || defaultEmpty as SiteSettings);
      })
      .catch(() => setSettings(defaultEmpty as SiteSettings));
  }, []);

  const featuredPlan = useMemo(() => {
    if (!settings || !settings.featuredPlanEnabled) return null;
    return plans.find((plan) => plan.id === settings.featuredPlanId) || plans[1] || plans[0] || null;
  }, [plans, settings]);

  if (!featuredPlan) return null;

  return (
    <div className="mb-8 rounded-3xl border border-amber-300/30 bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-cyan-500/10 p-5 md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
            <span>⭐</span>
            <span>{settings?.featuredBadgeText || "MOST POPULAR"}</span>
          </div>
          <h3 className="text-2xl font-black text-white">{featuredPlan.name}</h3>
          <p className="text-sm text-slate-300">{featuredPlan.description || "Best choice for ongoing creative needs."}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text">Rs. {featuredPlan.price.toLocaleString()}</p>
          <p className="text-sm text-slate-400">{featuredPlan.duration}</p>
        </div>
      </div>
    </div>
  );
}

export function PlanComparisonTable({ plans }: { plans: Array<{ id: string; name: string; price: number; duration: string; features?: string[]; available?: boolean }> }) {
  const featureList = useMemo(() => {
    const extras = new Set<string>();
    plans.forEach((plan) => plan.features?.forEach((feature) => extras.add(feature)));
    return Array.from(extras);
  }, [plans]);

  return (
    <div className="mb-16 overflow-x-auto rounded-3xl border border-cyan-400/20 bg-slate-900/60 p-4 md:p-6">
      <div className="min-w-[800px]">
        <table className="w-full text-left text-sm text-slate-200">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="pb-4 pr-4 font-bold uppercase tracking-wide">Plan</th>
              {plans.map((plan) => (
                <th key={plan.id} className="pb-4 pr-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{plan.name}</p>
                    <p className="mt-2 text-xl font-black text-white">Rs. {plan.price.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{plan.duration}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureList.map((feature) => (
              <tr key={feature} className="border-b border-white/5">
                <td className="py-4 pr-4 font-medium text-slate-300">{feature}</td>
                {plans.map((plan) => (
                  <td key={`${plan.id}-${feature}`} className="py-4 pr-4">
                    {plan.features?.includes(feature) ? "✓" : "—"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-4 pr-4 font-medium text-slate-300">Availability</td>
              {plans.map((plan) => (
                <td key={`${plan.id}-availability`} className="py-4 pr-4">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${plan.available === false ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"}`}>
                    {plan.available === false ? "Unavailable" : "Available"}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-4 pr-4 font-medium text-slate-300">Action</td>
              {plans.map((plan) => (
                <td key={`${plan.id}-action`} className="py-4 pr-4">
                  <button type="button" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-bold uppercase text-white">
                    Order
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FAQAccordion() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) setSettings(result.settings || defaultEmpty as SiteSettings);
      })
      .catch(() => setSettings(defaultEmpty as SiteSettings));
  }, []);

  const faqs = (settings?.faqs || []).filter((faq) => faq.enabled).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="mb-16 space-y-3">
      {faqs.map((faq) => {
        const isOpen = openId === faq.id;
        return (
          <div key={faq.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : faq.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-white"
            >
              <span className="font-semibold">{faq.question}</span>
              <span className="text-xl text-cyan-300">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && <div className="border-t border-white/10 px-4 py-4 text-sm text-slate-300">{faq.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function OrderTrackingWidget() {
  const [orderId, setOrderId] = useState("");
  const [result, setResult] = useState<{ orderId?: string; selectedPlan?: string; status?: string; createdAt?: string; updatedAt?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTrack = async () => {
    if (!orderId.trim()) {
      setError("Please enter an order ID or reference number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders?orderId=${encodeURIComponent(orderId.trim())}`);
      const data = await response.json();
      if (!data.ok || !data.orders?.[0]) {
        setResult(null);
        setError("Order not found.");
        return;
      }

      const order = data.orders[0];
      setResult({
        orderId: order.orderId,
        selectedPlan: order.selectedPlan,
        status: order.status,
        createdAt: order.orderCreatedAt || order.createdAt,
        updatedAt: order.updatedAt || order.orderCreatedAt || order.createdAt,
      });
    } catch {
      setError("Unable to track order right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-16 rounded-3xl border border-cyan-400/20 bg-slate-900/60 p-5 md:p-6">
      <h3 className="mb-4 text-2xl font-black text-white">Track Order</h3>
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder="Enter Order ID"
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
        />
        <button type="button" onClick={handleTrack} disabled={loading} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-bold text-white disabled:opacity-60">
          {loading ? "Tracking..." : "Track Order"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {result && (
        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-slate-200">
          <div className="grid gap-3 md:grid-cols-2">
            <div><span className="text-slate-400">Order ID:</span> <strong className="text-white">{result.orderId}</strong></div>
            <div><span className="text-slate-400">Selected Plan:</span> <strong className="text-white">{result.selectedPlan}</strong></div>
            <div><span className="text-slate-400">Status:</span> <strong className="text-cyan-300">{result.status}</strong></div>
            <div><span className="text-slate-400">Last Updated:</span> <strong className="text-white">{result.updatedAt ? new Date(result.updatedAt).toLocaleString() : "N/A"}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PromoCodeWidget({
  planId,
  price,
  currentCode,
  onPromoApplied,
  onPromoRemoved,
}: {
  planId: string;
  price: number;
  currentCode?: string;
  onPromoApplied?: (payload: {
    code: string;
    discount: number;
    finalPrice: number;
    discountPercentage: number;
    applicablePlans: string[];
    message: string;
  }) => void;
  onPromoRemoved?: () => void;
}) {
  const [promoCode, setPromoCode] = useState(currentCode || "");
  const [result, setResult] = useState<{ valid: boolean; finalPrice: number; discount: number; message: string; discountPercentage?: number; applicablePlans?: string[]; code?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!promoCode.trim()) {
      setResult({ valid: false, finalPrice: price, discount: 0, message: "Please enter a promo code." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/site-settings/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, planId, originalPrice: price }),
      });
      const data = await response.json();
      setResult(data);

      if (data?.valid) {
        const payload = {
          code: String(data.code || promoCode).toUpperCase(),
          discount: Number(data.discount || 0),
          finalPrice: Number(data.finalPrice || price),
          discountPercentage: Number(data.discountPercentage || 0),
          applicablePlans: Array.isArray(data.applicablePlans) ? data.applicablePlans : [],
          message: String(data.message || "Promo code applied successfully."),
        };
        onPromoApplied?.(payload);
        setPromoCode(payload.code);
        return;
      }

      onPromoRemoved?.();
    } catch {
      setResult({ valid: false, finalPrice: price, discount: 0, message: "Unable to validate promo code right now." });
      onPromoRemoved?.();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setResult(null);
    setPromoCode("");
    onPromoRemoved?.();
  };

  return (
    <div className="mb-16 rounded-3xl border border-emerald-400/20 bg-slate-900/60 p-5 md:p-6">
      <h3 className="mb-4 text-2xl font-black text-white">Have a Promo Code?</h3>
      {currentCode ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 text-sm text-emerald-100">
          <p className="font-bold">✓ {String(currentCode).toUpperCase()} Applied</p>
          {result?.valid && (
            <>
              <p className="mt-2 text-base font-black text-white">{result.discountPercentage || 0}% OFF</p>
              <p className="mt-2">Original Price: Rs. {price.toLocaleString()}</p>
              <p className="mt-1">Promo Discount: - Rs. {result.discount.toLocaleString()}</p>
              <p className="mt-2 text-base font-black text-white">Final Price: Rs. {result.finalPrice.toLocaleString()}</p>
            </>
          )}
          <button type="button" onClick={handleRemove} className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">Remove</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder="Enter Promo Code"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "APPLYING..." : "APPLY"}
          </button>
        </div>
      )}
      {!currentCode && result && (
        <div className={`mt-4 rounded-2xl border p-4 text-sm ${result.valid ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-100" : "border-red-400/30 bg-red-500/5 text-red-100"}`}>
          <p className="font-bold">{result.valid ? "PROMO CODE APPLIED ✓" : "Promo Code Invalid"}</p>
          <p className="mt-2">{result.message}</p>
          {result.valid && (
            <div className="mt-3 space-y-2">
              <p>Original Price: Rs. {price.toLocaleString()}</p>
              <p>{result.discount > 0 ? `Promo Discount: - Rs. ${result.discount.toLocaleString()}` : "Promo Discount: Rs. 0"}</p>
              <p className="text-base font-black text-white">Final Price: Rs. {result.finalPrice.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DigitalReceipt({ order }: { order: any }) {
  if (!order) return null;

  return (
    <div className="mb-16 rounded-3xl border border-cyan-400/20 bg-slate-900/60 p-6 text-sm text-slate-200">
      <h3 className="mb-4 text-2xl font-black text-white">Receipt</h3>
      <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 font-mono text-xs">
        <p className="text-center text-base font-black text-cyan-300">MI CORTEX X INC.</p>
        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-slate-400">Receipt</p>
        <div className="mt-4 space-y-2">
          <p>Receipt No: RCPT-{String(order.orderId || "N/A").slice(-6)}</p>
          <p>Order ID: {order.orderId || "N/A"}</p>
          <p>Customer: {order.customerName || "N/A"}</p>
          <p>Plan: {order.plan || order.selectedPlan || "N/A"}</p>
          <p>Original Price: Rs. {(order.amount || 0).toLocaleString()}</p>
          <p>Status: {order.status || "PENDING"}</p>
          <p>Date: {new Date(order.createdAt || Date.now()).toLocaleString()}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 font-bold text-white">Download Receipt</button>
        <button type="button" className="rounded-full border border-white/20 px-5 py-3 font-bold text-white">Print Receipt</button>
      </div>
    </div>
  );
}
