"use client";

import { useEffect, useMemo, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { plans } from "@/components/site-data";
import { PromotionsManagement } from "@/components/promotions-management";
import { validatePromoCodeEntry } from "@/lib/promo-code-utils";
import type { FAQItem, PromoCode, SiteSettings } from "@/lib/site-settings";

const statusOptions = [
  "ALL",
  "PENDING",
  "APPROVED",
  "ACTIVE",
  "EXPIRING_IN_1_DAY",
  "EXPIRED",
  "REJECTED",
  "REQUEST_SENT",
];

const adminNavigation = [
  { id: "orders" as const, label: "Orders", icon: "▣" },
  { id: "refunds" as const, label: "Refunds", icon: "↩" },
  { id: "promotions" as const, label: "Promotions", icon: "✦" },
  { id: "settings" as const, label: "Settings", icon: "⚙" },
];

const adminPinLength = 15;

// Professional Button Component
type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "outline" | "ghost";
type ButtonSize = "sm" | "md";

interface AdminButtonProps {
  variant: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: string;
  className?: string;
}

function AdminButton({
  variant,
  size = "md",
  disabled = false,
  onClick,
  children,
  icon,
  className = ""
}: AdminButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-bold uppercase transition-all duration-200 cursor-pointer";

  const sizeStyles: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[10px] rounded-lg",
    md: "h-10 px-4 text-[13px] rounded-xl"
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed",
    danger: "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed",
    outline: "border border-white/20 text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
  };

  const minWidthStyles: Record<string, string> = {
    "VIEW": "min-w-[72px]",
    "APPROVE & ACTIVATE": "min-w-[130px]",
    "APPROVE": "min-w-[100px]",
    "REJECT": "min-w-[90px]",
    "PROCESSED": "min-w-[120px]",
    "CLOSE": "min-w-[72px]",
    "REFRESH": "min-w-[100px]"
  };

  const childText = typeof children === "string" ? children : "";
  const minWidth = minWidthStyles[childText] || "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${minWidth} whitespace-nowrap ${className}`}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

type OrderRecord = {
  orderId: string;
  requestId: string;
  referenceNumber?: string;
  paymentReference?: string;
  customerName: string;
  customerEmail: string;
  canvaEmail: string;
  customerPhone: string;
  selectedPlan: string;
  planPrice: string;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  activatedAt?: string | null;
  activationDate?: string | null;
  activationTime?: string | null;
  expiryAt?: string | null;
  expiryDate?: string | null;
  expiryTime?: string | null;
  reminderAt?: string | null;
  reminderDate?: string | null;
  reminderTime?: string | null;
  reminderStatus?: string | null;
  reminderSentAt?: string | null;
  expiryNotificationStatus?: string | null;
  expirationNotificationSentAt?: string | null;
  orderCreatedAt: string;
  createdAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  expiredAt?: string | null;
  paymentProof?: string | null;
  paymentProofUrl?: string | null;
};

function formatReadableDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeStatus(status?: string | null): string {
  const value = status || "PENDING";
  if (value === "REQUEST_SENT") return "PENDING";
  if (value === "APPROVED") return "ACTIVE";
  return ["PENDING", "ACTIVE", "EXPIRING_IN_1_DAY", "EXPIRED", "REJECTED", "CANCELLED"].includes(value)
    ? value
    : "PENDING";
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    PENDING: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    APPROVED: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    ACTIVE: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    EXPIRING_IN_1_DAY: "border-orange-400/40 bg-orange-500/10 text-orange-200",
    EXPIRED: "border-red-400/40 bg-red-500/10 text-red-200",
    REJECTED: "border-rose-400/40 bg-rose-500/10 text-rose-200",
    REQUEST_SENT: "border-slate-400/40 bg-slate-500/10 text-slate-200",
    CANCELLED: "border-gray-400/40 bg-gray-500/10 text-gray-200",
  };
  return map[status] || "border-slate-400/40 bg-slate-500/10 text-slate-200";
}

function statusLabel(status?: string | null) {
  const normalized = normalizeStatus(status);
  const labels: Record<string, string> = {
    PENDING: "Pending Approval",
    ACTIVE: "Active",
    EXPIRING_IN_1_DAY: "Expiring in 1 Day",
    EXPIRED: "Expired",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return labels[normalized] || normalized;
}

type Toast = {
  id: string;
  message: string;
  type: "success" | "error";
};

type RefundRecord = {
  refundRequestId: string;
  refundCode: string;
  orderNumber: string;
  referenceNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  canvaEmail: string;
  originalPlan: string;
  originalPlanType: "WEEKLY" | "MONTHLY" | "YEARLY";
  originalPaidAmount: number;
  requestedRefundAmount: number;
  startedDate: string;
  startedTime: string;
  expiresDate: string;
  expiresTime: string;
  refundEligibleUntilDate: string;
  refundEligibleUntilTime: string;
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PROCESSED";
  telegramNotificationStatus: "PENDING" | "SENT" | "FAILED";
  createdAt: string;
  refundReason?: string;
  additionalDetails?: string;
  originalOrder?: {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    canvaEmail?: string;
    selectedPlan?: string;
    planPrice?: string;
    paymentMethod?: string;
    paymentDetails?: string;
  };
};

export default function AdminPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refundFilter, setRefundFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [refundsLoading, setRefundsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "refunds" | "promotions" | "settings">("orders");
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(true);
  const [siteSettingsError, setSiteSettingsError] = useState<string | null>(null);
  const [authStage, setAuthStage] = useState<"loading" | "login" | "pin" | "success" | "verified">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authShake, setAuthShake] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState("");

  const showToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    fetch("/api/admin/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => setAuthStage(result.authenticated ? "verified" : "login"))
      .catch(() => setAuthStage("login"));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      fetch("/api/admin/auth/passkey/login")
        .then((response) => setPasskeyAvailable(response.ok))
        .catch(() => setPasskeyAvailable(false));
    }
  }, []);

  const submitAdminLogin = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setAuthError(result.error || "Unable to sign in.");
        return;
      }
      setPassword("");
      setAuthStage("pin");
    } catch {
      setAuthError("Unable to sign in.");
    } finally {
      setAuthBusy(false);
    }
  };

  const submitAdminPin = async (enteredPin = pin) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/admin/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPin("");
        setAuthError(result.error || "Incorrect Security PIN");
        setAuthShake(true);
        window.setTimeout(() => setAuthShake(false), 450);
        return;
      }
      setPin("");
      setAuthStage("success");
      window.setTimeout(() => setAuthStage("verified"), 900);
    } catch {
      setPin("");
      setAuthError("Unable to verify Jsecurity PIN.");
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutAdmin = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.reload();
  };

  const loginWithFaceId = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const optionsResponse = await fetch("/api/admin/auth/passkey/login");
      const optionsResult = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsResult.error || "Face ID is not configured yet.");
      const credential = await startAuthentication({ optionsJSON: optionsResult.options });
      const response = await fetch("/api/admin/auth/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Face ID verification failed.");
      setAuthStage("success");
      window.setTimeout(() => setAuthStage("verified"), 900);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Face ID verification failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const registerFaceId = async () => {
    setAuthBusy(true);
    setPasskeyMessage("");
    try {
      const optionsResponse = await fetch("/api/admin/auth/passkey/register");
      const optionsResult = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsResult.error || "Unable to start Face ID setup.");
      const credential = await startRegistration({ optionsJSON: optionsResult.options });
      const response = await fetch("/api/admin/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Face ID setup failed.");
      setPasskeyAvailable(true);
      setPasskeyMessage("Face ID is ready for your next login.");
    } catch (error) {
      setPasskeyMessage(error instanceof Error ? error.message : "Face ID setup failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders");
      const result = await response.json();

      if (!result.ok) {
        setOrders([]);
        setOrdersError("⚠️ UNABLE TO LOAD ORDERS\nPlease check the Admin API/database connection.");
        return;
      }

      setOrdersError(null);
      setOrders(result.orders || []);
    } catch {
      setOrders([]);
      setOrdersError("⚠️ UNABLE TO LOAD ORDERS\nPlease check the Admin API/database connection.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRefunds = async () => {
    setRefundsLoading(true);
    try {
      const response = await fetch("/api/admin/refunds?filter=" + refundFilter);
      const result = await response.json();
      if (result.ok) setRefunds(result.refunds || []);
    } catch {
      setRefunds([]);
    } finally {
      setRefundsLoading(false);
    }
  };

  const fetchSiteSettings = async () => {
    setSiteSettingsLoading(true);
    setSiteSettingsError(null);
    try {
      const response = await fetch("/api/site-settings");
      const result = await response.json();
      if (!response.ok || !result.ok || !result.settings) {
        setSiteSettings(null);
        setSiteSettingsError(result.error || "Unable to load site settings.");
        return;
      }
      setSiteSettings(result.settings);
    } catch {
      setSiteSettings(null);
      setSiteSettingsError("Unable to load site settings. Please try again.");
    } finally {
      setSiteSettingsLoading(false);
    }
  };

  const saveSiteSettings = async (nextSettings: SiteSettings) => {
    try {
      const promoErrors = (nextSettings.promoCodes || [])
        .map((promo) => validatePromoCodeEntry(promo, nextSettings.promoCodes || []))
        .filter(Boolean) as string[];
      if (promoErrors.length > 0) {
        showToast(promoErrors[0] || "Promo code validation failed.", "error");
        return;
      }

      const response = await fetch("/api/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const result = await response.json();
      if (result.ok) {
        setSiteSettings(result.settings || nextSettings);
        showToast("✅ Settings saved successfully.", "success");
      } else {
        showToast(result.error || "Unable to save settings.", "error");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save settings.", "error");
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [refundFilter]);

  useEffect(() => {
    fetchSiteSettings();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((order) => {
      const matchesFilter = statusFilter === "ALL" || normalizeStatus(order.status) === statusFilter;
      const haystack = [
        order.orderId,
        order.requestId,
        order.customerName,
        order.customerEmail,
        order.canvaEmail,
        order.selectedPlan,
        order.paymentMethod,
        order.status,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const totals = useMemo(() => {
    const records = {
      total: orders.length,
      pending: orders.filter((order) => normalizeStatus(order.status) === "PENDING").length,
      active: orders.filter((order) => normalizeStatus(order.status) === "ACTIVE").length,
      expiring: orders.filter((order) => normalizeStatus(order.status) === "EXPIRING_IN_1_DAY").length,
      expired: orders.filter((order) => normalizeStatus(order.status) === "EXPIRED").length,
      rejected: orders.filter((order) => normalizeStatus(order.status) === "REJECTED").length,
    };
    return records;
  }, [orders]);

  const updateOrderAction = async (orderId: string, action: "activate" | "reject") => {
    setActionInProgress(orderId);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderId }),
      });
      const result = await response.json();

      if (!result.ok) {
        const errorMsg = result.error || "Unable to update order.";
        showToast(errorMsg, "error");
        setActionInProgress(null);
        return;
      }

      const successMsg =
        action === "activate"
          ? "✅ Subscription activated successfully."
          : "✅ Order rejected successfully.";
      showToast(successMsg, "success");

      await fetchOrders();

      if (selectedOrder?.orderId === orderId) {
        const refreshed = await fetch("/api/admin/orders?orderId=" + encodeURIComponent(orderId));
        const refreshedResult = await refreshed.json();
        if (refreshedResult.ok && refreshedResult.orders?.[0]) {
          setSelectedOrder(refreshedResult.orders[0]);
        } else {
          setSelectedOrder(null);
        }
      }

      setActionInProgress(null);
    } catch (error) {
      showToast("Unable to process request.", "error");
      setActionInProgress(null);
    }
  };

  const openRefundDetail = async (refund: RefundRecord) => {
    try {
      // Fetch the full refund data with original order included
      const response = await fetch(`/api/admin/refunds?filter=all&includeOrder=true`);
      const result = await response.json();
      if (result.ok && result.refunds) {
        const fullRefund = result.refunds.find((r: RefundRecord) => r.refundRequestId === refund.refundRequestId);
        if (fullRefund) {
          setSelectedRefund(fullRefund);
        } else {
          setSelectedRefund(refund);
        }
      } else {
        setSelectedRefund(refund);
      }
    } catch (error) {
      console.error("Error fetching refund details:", error);
      setSelectedRefund(refund);
    }
  };

  const updateRefundAction = async (refundRequestId: string, action: "APPROVE" | "REJECT" | "PROCESSED") => {
    setActionInProgress(refundRequestId);
    try {
      const response = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundRequestId, action }),
      });
      const result = await response.json();

      if (!result.ok) {
        const errorMsg = result.error || "Unable to update refund.";
        showToast(errorMsg, "error");
        setActionInProgress(null);
        return;
      }

      showToast(`✅ Refund ${action.toLowerCase()} successfully.`, "success");
      await fetchRefunds();
      setSelectedRefund(null);
      setActionInProgress(null);
    } catch (error) {
      showToast("Unable to process request.", "error");
      setActionInProgress(null);
    }
  };

  if (authStage !== "verified") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
        <div className={`w-full max-w-md rounded-[28px] border border-cyan-400/20 bg-slate-900/90 p-6 shadow-2xl shadow-cyan-950/30 sm:p-8 ${authShake ? "admin-auth-shake" : ""}`}>
          {authStage === "loading" ? (
            <div className="py-12 text-center text-sm uppercase tracking-[0.2em] text-cyan-300">Checking secure session...</div>
          ) : authStage === "login" ? (
            <form onSubmit={(event) => { event.preventDefault(); void submitAdminLogin(); }}>
              <div className="mb-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-3xl">⌁</div>
                <div className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Restricted Area</div>
                <h1 className="mt-2 text-2xl font-black">Admin Sign In</h1>
              </div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Username</label>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              {authError && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{authError}</p>}
              <button type="submit" disabled={authBusy} className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-bold uppercase text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">{authBusy ? "Verifying..." : "Continue"}</button>
              {passkeyAvailable && <button type="button" onClick={() => void loginWithFaceId()} disabled={authBusy} className="mt-3 w-full rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 font-bold uppercase text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60">{authBusy ? "Checking..." : "Use Face ID"}</button>}
            </form>
          ) : authStage === "success" ? (
            <div className="py-8 text-center">
              <div className="admin-auth-check mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-400/15 text-5xl text-emerald-300">✓</div>
              <h1 className="mt-6 text-2xl font-black text-emerald-200">Verified</h1>
              <p className="mt-2 text-sm text-slate-400">Security Verification Successful</p>
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void submitAdminPin(); }}>
              <div className="mb-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/40 bg-cyan-400/10 text-4xl shadow-lg shadow-cyan-500/10">🔐</div>
                <h1 className="mt-5 text-2xl font-black">Security Verification</h1>
                <p className="mt-2 text-sm text-slate-400">Enter Admin Security PIN</p>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={adminPinLength}
                value={pin}
                onChange={(event) => {
                  const nextPin = event.target.value.replace(/\D/g, "");
                  setPin(nextPin);
                  if (nextPin.length === adminPinLength && !authBusy) void submitAdminPin(nextPin);
                }}
                autoComplete="one-time-code"
                aria-label="Admin Security PIN"
                required
                className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-4 text-center text-xl tracking-[0.45em] text-white outline-none focus:border-cyan-400"
              />
              {authError && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">❌ {authError}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Admin Panel</div>
            <h1 className="mt-2 text-3xl font-black">MI CORTEX X INC.</h1>
          </div>
          <div className="flex gap-3 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <AdminButton
              variant="secondary"
              size="md"
              onClick={() => window.location.href = "/"}
            >
              BACK TO SITE
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="md"
              onClick={() => void logoutAdmin()}
            >
              LOG OUT
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="md"
              onClick={() => void registerFaceId()}
              disabled={authBusy}
            >
              {passkeyAvailable ? "REPLACE FACE ID" : "SET UP FACE ID"}
            </AdminButton>
            {passkeyMessage && <span className="text-xs text-emerald-300">{passkeyMessage}</span>}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 lg:sticky lg:top-6">
            <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</div>
            <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
              {adminNavigation.map((item) => {
                const isActive = activeTab === item.id;
                const count = item.id === "orders" ? totals.total : item.id === "refunds" ? refunds.length : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex min-w-max flex-1 items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-bold uppercase transition-colors lg:w-full ${
                      isActive
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950/60 text-base text-cyan-300">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {count !== null && <span className="text-xs text-slate-500">{count}</span>}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {activeTab === "orders" ? (
            [
              { label: "PENDING ORDERS", value: totals.pending },
              { label: "ACTIVE SUBSCRIPTIONS", value: totals.active },
              { label: "EXPIRING IN 1 DAY", value: totals.expiring },
              { label: "EXPIRED SUBSCRIPTIONS", value: totals.expired },
              { label: "REJECTED ORDERS", value: totals.rejected },
              { label: "TOTAL ORDERS", value: totals.total },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                <div className="mt-3 text-3xl font-black text-white">{item.value}</div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">TOTAL REFUND REQUESTS</div>
              <div className="mt-3 text-3xl font-black text-white">{refunds.length}</div>
            </div>
          )}
        </section>

        {activeTab === "orders" && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                    statusFilter === status
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-slate-950/40 text-slate-300"
                  }`}
                >
                  {status.replace("_"," ")}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeTab === "refunds" && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex flex-wrap gap-2">
              {["all", "pending", "approved", "rejected"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setRefundFilter(filter)}
                  className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                    refundFilter === filter
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-slate-950/40 text-slate-300"
                  }`}
                >
                  {filter === "all" ? "All Refunds" : filter}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeTab === "orders" && (
          <section className="rounded-[28px] border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">ORDERS</h2>
              <div className="flex items-center gap-2">
                <AdminButton
                  variant="secondary"
                  size="md"
                  onClick={() => fetchOrders()}
                  icon="🔄"
                >
                  REFRESH
                </AdminButton>
                <span className="text-sm text-slate-400">{filteredOrders.length} records</span>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-slate-300">Loading orders...</div>
            ) : ordersError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200 whitespace-pre-line">
                {ordersError}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-8 text-center text-slate-400 whitespace-pre-line">
                📦 NO ORDERS FOUND

                There are currently no orders in the database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="px-3 py-3 font-semibold">Order Number</th>
                      <th className="px-3 py-3 font-semibold">Reference Number</th>
                      <th className="px-3 py-3 font-semibold">Customer</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-3 py-3 font-semibold">WhatsApp</th>
                      <th className="px-3 py-3 font-semibold">Canva Email</th>
                      <th className="px-3 py-3 font-semibold">Plan</th>
                      <th className="px-3 py-3 font-semibold">Amount</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Created</th>
                      <th className="px-3 py-3 font-semibold">Activated</th>
                      <th className="px-3 py-3 font-semibold">Expires</th>
                      <th className="px-3 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredOrders.map((order) => {
                      const normalizedStatus = normalizeStatus(order.status);
                      const canActivate = normalizedStatus === "PENDING";
                      const referenceNumber = order.referenceNumber || order.paymentDetails || order.requestId || order.orderId;

                      return (
                        <tr key={order.orderId} className="align-top text-slate-200">
                          <td className="px-3 py-3 font-semibold text-cyan-300">{order.orderId}</td>
                          <td className="px-3 py-3">{referenceNumber}</td>
                          <td className="px-3 py-3">{order.customerName}</td>
                          <td className="px-3 py-3 text-xs">{order.customerEmail}</td>
                          <td className="px-3 py-3">{order.customerPhone || "-"}</td>
                          <td className="px-3 py-3 text-xs">{order.canvaEmail || "-"}</td>
                          <td className="px-3 py-3">{order.selectedPlan || "-"}</td>
                          <td className="px-3 py-3">{order.planPrice || "-"}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusBadgeClass(normalizedStatus)}`}>
                              {statusLabel(normalizedStatus)}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatReadableDate(order.orderCreatedAt || order.createdAt)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatReadableDate(order.activatedAt || order.activationDate)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatReadableDate(order.expiryAt || order.expiryDate)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <AdminButton
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedOrder(order)}
                                icon="👁"
                              >
                                VIEW
                              </AdminButton>
                              {canActivate && (
                                <AdminButton
                                  variant="primary"
                                  size="sm"
                                  onClick={() => updateOrderAction(order.orderId, "activate")}
                                  disabled={actionInProgress === order.orderId}
                                  icon={actionInProgress === order.orderId ? "⏳" : "✓"}
                                >
                                  {actionInProgress === order.orderId ? "ACTIVATING..." : "APPROVE & ACTIVATE"}
                                </AdminButton>
                              )}
                              {canActivate && (
                                <AdminButton
                                  variant="danger"
                                  size="sm"
                                  onClick={() => updateOrderAction(order.orderId, "reject")}
                                  disabled={actionInProgress === order.orderId}
                                  icon={actionInProgress === order.orderId ? "⏳" : "✕"}
                                >
                                  {actionInProgress === order.orderId ? "REJECTING..." : "REJECT"}
                                </AdminButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "refunds" && (
          <section className="rounded-[28px] border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">REFUND REQUESTS</h2>
              <span className="text-sm text-slate-400">{refunds.length} records</span>
            </div>

            {refundsLoading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-slate-300">Loading refunds...</div>
            ) : refunds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-8 text-center text-slate-400">
                No refund requests found.
              </div>
            ) : (
              <div className="space-y-3">
                {refunds.map((refund) => {
                  const refundStatusClasses: Record<string, string> = {
                    PENDING: "border-amber-400/40 bg-amber-500/10 text-amber-200",
                    UNDER_REVIEW: "border-blue-400/40 bg-blue-500/10 text-blue-200",
                    APPROVED: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
                    REJECTED: "border-red-400/40 bg-red-500/10 text-red-200",
                    PROCESSED: "border-purple-400/40 bg-purple-500/10 text-purple-200",
                  };
                  const telegramStatusClasses: Record<string, string> = {
                    PENDING: "border-slate-400/40 bg-slate-500/10 text-slate-200",
                    SENT: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
                    FAILED: "border-red-400/40 bg-red-500/10 text-red-200",
                  };

                  return (
                    <div key={refund.refundRequestId} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-bold text-cyan-300">{refund.refundCode}</span>
                            <span className="font-bold text-slate-200">{refund.customerName}</span>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${refundStatusClasses[refund.status]}`}>
                              {refund.status}
                            </span>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${telegramStatusClasses[refund.telegramNotificationStatus]}`}>
                              📱 {refund.telegramNotificationStatus}
                            </span>
                          </div>
                        </div>
                        <div className="grid gap-4 text-sm md:grid-cols-2">
                          <div className="space-y-1">
                            <div className="text-slate-400">Order Number</div>
                            <div className="font-semibold text-white">{refund.orderNumber}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Reference Number</div>
                            <div className="font-semibold text-white">{refund.referenceNumber}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Plan</div>
                            <div className="font-semibold text-white">{refund.originalPlanType} ({refund.originalPlan})</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Refund Amount</div>
                            <div className="font-semibold text-white">${refund.requestedRefundAmount}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Subscription Started</div>
                            <div className="font-semibold text-white">{refund.startedDate} {refund.startedTime}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Eligible Until</div>
                            <div className="font-semibold text-white">{refund.refundEligibleUntilDate} {refund.refundEligibleUntilTime}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Customer Email</div>
                            <div className="font-semibold text-white text-xs">{refund.email}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400">Requested At</div>
                            <div className="font-semibold text-white">{formatReadableDate(refund.createdAt)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-white/10">
                          <AdminButton
                            variant="secondary"
                            size="sm"
                            onClick={() => openRefundDetail(refund)}
                            icon="👁"
                          >
                            VIEW
                          </AdminButton>
                          {refund.status === "PENDING" && (
                            <>
                              <AdminButton
                                variant="success"
                                size="sm"
                                onClick={() => updateRefundAction(refund.refundRequestId, "APPROVE")}
                                disabled={actionInProgress === refund.refundRequestId}
                                icon={actionInProgress === refund.refundRequestId ? "⏳" : "✓"}
                              >
                                {actionInProgress === refund.refundRequestId ? "APPROVING..." : "APPROVE"}
                              </AdminButton>
                              <AdminButton
                                variant="danger"
                                size="sm"
                                onClick={() => updateRefundAction(refund.refundRequestId, "REJECT")}
                                disabled={actionInProgress === refund.refundRequestId}
                                icon={actionInProgress === refund.refundRequestId ? "⏳" : "✕"}
                              >
                                {actionInProgress === refund.refundRequestId ? "REJECTING..." : "REJECT"}
                              </AdminButton>
                            </>
                          )}
                          {refund.status === "APPROVED" && (
                            <AdminButton
                              variant="success"
                              size="sm"
                              onClick={() => updateRefundAction(refund.refundRequestId, "PROCESSED")}
                              disabled={actionInProgress === refund.refundRequestId}
                              icon={actionInProgress === refund.refundRequestId ? "⏳" : "✓"}
                            >
                              {actionInProgress === refund.refundRequestId ? "PROCESSING..." : "MARK AS PROCESSED"}
                            </AdminButton>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "promotions" && (
          <section className="rounded-[28px] border border-white/10 bg-slate-900/60 p-5">
            <PromotionsManagement />
          </section>
        )}

        {activeTab === "settings" && siteSettings && (
          <section className="space-y-6 rounded-[28px] border border-white/10 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white">Website Features</h2>
              <AdminButton
                variant="primary"
                onClick={() => saveSiteSettings(siteSettings)}
                icon="💾"
              >
                Save Settings
              </AdminButton>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="mb-4 text-lg font-bold text-cyan-300">Featured Plan</h3>
                <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Plan</label>
                <select
                  value={siteSettings.featuredPlanId}
                  onChange={(e) => setSiteSettings({ ...siteSettings, featuredPlanId: e.target.value })}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
                <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Badge Text</label>
                <input
                  value={siteSettings.featuredBadgeText}
                  onChange={(e) => setSiteSettings({ ...siteSettings, featuredBadgeText: e.target.value })}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={siteSettings.featuredPlanEnabled}
                    onChange={(e) => setSiteSettings({ ...siteSettings, featuredPlanEnabled: e.target.checked })}
                  />
                  Enable featured plan
                </label>
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/50 p-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(siteSettings.discountStacking)}
                      onChange={(e) => setSiteSettings({ ...siteSettings, discountStacking: e.target.checked })}
                    />
                    Allow stacking promo codes with active promotions
                  </label>
                  <p className="mt-2 text-xs text-slate-400">Disabled by default to keep pricing rules predictable and prevent accidental stacked discounts.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="mb-4 text-lg font-bold text-cyan-300">Announcement Bar</h3>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={siteSettings.announcement.enabled}
                    onChange={(e) => setSiteSettings({
                      ...siteSettings,
                      announcement: { ...siteSettings.announcement, enabled: e.target.checked },
                    })}
                  />
                  Enable announcement
                </label>
                <input
                  value={siteSettings.announcement.message}
                  onChange={(e) => setSiteSettings({
                    ...siteSettings,
                    announcement: { ...siteSettings.announcement, message: e.target.value },
                  })}
                  placeholder="Announcement message"
                  className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                />
                <input
                  value={siteSettings.announcement.buttonText}
                  onChange={(e) => setSiteSettings({
                    ...siteSettings,
                    announcement: { ...siteSettings.announcement, buttonText: e.target.value },
                  })}
                  placeholder="Button text"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="mb-4 text-lg font-bold text-cyan-300">FAQ Management</h3>
                <div className="space-y-3">
                  {siteSettings.faqs.map((faq: FAQItem, index: number) => (
                    <div key={faq.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">#{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => setSiteSettings({
                            ...siteSettings,
                            faqs: siteSettings.faqs.filter((item: FAQItem) => item.id !== faq.id),
                          })}
                          className="text-xs font-bold uppercase text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                      <input
                        value={faq.question}
                        onChange={(e) => setSiteSettings({
                          ...siteSettings,
                          faqs: siteSettings.faqs.map((item: FAQItem) => item.id === faq.id ? { ...item, question: e.target.value } : item),
                        })}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                      />
                      <textarea
                        value={faq.answer}
                        onChange={(e) => setSiteSettings({
                          ...siteSettings,
                          faqs: siteSettings.faqs.map((item: FAQItem) => item.id === faq.id ? { ...item, answer: e.target.value } : item),
                        })}
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={faq.enabled}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              faqs: siteSettings.faqs.map((item: FAQItem) => item.id === faq.id ? { ...item, enabled: e.target.checked } : item),
                            })}
                          />
                          Enabled
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={faq.order}
                          onChange={(e) => setSiteSettings({
                            ...siteSettings,
                            faqs: siteSettings.faqs.map((item: FAQItem) => item.id === faq.id ? { ...item, order: Number(e.target.value || 1) } : item),
                          })}
                          className="w-20 rounded-xl border border-white/10 bg-slate-900 px-2 py-2 text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSiteSettings({
                    ...siteSettings,
                    faqs: [
                      ...siteSettings.faqs,
                      {
                        id: `faq-${Date.now()}`,
                        question: "New Question",
                        answer: "Answer text here.",
                        enabled: true,
                        order: siteSettings.faqs.length + 1,
                      },
                    ],
                  })}
                  className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-bold uppercase text-cyan-200"
                >
                  + Add FAQ
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-cyan-300">Promo Codes</h3>
                  <button
                    type="button"
                    onClick={() => setSiteSettings({
                      ...siteSettings,
                      promoCodes: [
                        ...siteSettings.promoCodes,
                        {
                          id: `promo-${Date.now()}`,
                          code: "",
                          name: "",
                          type: "percentage",
                          discountPercentage: 10,
                          value: 10,
                          applicablePlans: ["weekly", "monthly"],
                          startDate: "",
                          startTime: "",
                          expiryDate: "",
                          expiryTime: "",
                          usageLimit: 100,
                          usedCount: 0,
                          totalDiscountGiven: 0,
                          enabled: true,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          usageHistory: [],
                        },
                      ],
                    })}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold uppercase text-emerald-200"
                  >
                    + Add Promo Code
                  </button>
                </div>

                <div className="space-y-4">
                  {siteSettings.promoCodes.map((promo: PromoCode) => (
                    <div key={promo.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Promo Code</div>
                          <div className="font-bold text-white">{promo.code || "UNSAVED CODE"}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSiteSettings({
                            ...siteSettings,
                            promoCodes: siteSettings.promoCodes.filter((item: PromoCode) => item.id !== promo.id),
                          })}
                          className="text-xs font-bold uppercase text-red-300"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Promo Code</span>
                          <input
                            value={promo.code || ""}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, code: e.target.value.toUpperCase() } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                            placeholder="CORTEX10"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Promo Name</span>
                          <input
                            value={promo.name || ""}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, name: e.target.value } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                            placeholder="September Special Offer"
                          />
                        </label>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Discount Percentage</span>
                          <span className="text-lg font-black text-cyan-300">{Number(promo.discountPercentage ?? promo.value ?? 0)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Number(promo.discountPercentage ?? promo.value ?? 0)}
                          onChange={(e) => {
                            const nextValue = Number(e.target.value || 0);
                            setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, discountPercentage: nextValue, value: nextValue, type: "percentage" } : item),
                            });
                          }}
                          className="w-full accent-cyan-400"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Number(promo.discountPercentage ?? promo.value ?? 0)}
                          onChange={(e) => {
                            const nextValue = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                            setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, discountPercentage: nextValue, value: nextValue, type: "percentage" } : item),
                            });
                          }}
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                        />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Start Date</span>
                          <input
                            type="date"
                            value={promo.startDate || ""}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, startDate: e.target.value } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Start Time</span>
                          <input
                            type="time"
                            value={promo.startTime || ""}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, startTime: e.target.value } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Expiry Date</span>
                          <input
                            type="date"
                            value={promo.expiryDate || ""}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, expiryDate: e.target.value } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Expiry Time</span>
                          <input
                            type="time"
                            value={promo.expiryTime || ""}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, expiryTime: e.target.value } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Usage Limit</span>
                          <input
                            type="number"
                            min={0}
                            value={promo.usageLimit ?? 0}
                            onChange={(e) => setSiteSettings({
                              ...siteSettings,
                              promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, usageLimit: Number(e.target.value || 0) } : item),
                            })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                          />
                        </label>
                        <div className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</span>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setSiteSettings({
                                ...siteSettings,
                                promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, enabled: true } : item),
                              })}
                              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${promo.enabled ? "bg-emerald-500 text-white" : "border border-white/10 bg-slate-950 text-slate-300"}`}
                            >
                              ON
                            </button>
                            <button
                              type="button"
                              onClick={() => setSiteSettings({
                                ...siteSettings,
                                promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, enabled: false } : item),
                              })}
                              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${!promo.enabled ? "bg-red-500 text-white" : "border border-white/10 bg-slate-950 text-slate-300"}`}
                            >
                              OFF
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Applicable Plans</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            { id: "weekly", label: "Weekly" },
                            { id: "monthly", label: "Monthly" },
                            { id: "annually", label: "Annual" },
                            { id: "lifetime", label: "Lifetime" },
                          ].map((plan) => {
                            const checked = (promo.applicablePlans || []).includes(plan.id);
                            return (
                              <label key={plan.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const nextPlans = e.target.checked
                                      ? [...(promo.applicablePlans || []), plan.id]
                                      : (promo.applicablePlans || []).filter((item) => item !== plan.id);
                                    setSiteSettings({
                                      ...siteSettings,
                                      promoCodes: siteSettings.promoCodes.map((item: PromoCode) => item.id === promo.id ? { ...item, applicablePlans: nextPlans } : item),
                                    });
                                  }}
                                />
                                {plan.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                        <span>Usage: {promo.usedCount || 0} / {promo.usageLimit && promo.usageLimit > 0 ? promo.usageLimit : "∞"}</span>
                        <span>Discount: {promo.discountPercentage ?? promo.value ?? 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveSiteSettings(siteSettings)}
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 font-bold uppercase text-white"
                  >
                    SAVE SETTINGS
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && !siteSettings && (
          <section className="space-y-4 rounded-[28px] border border-white/10 bg-slate-900/60 p-5">
            <h2 className="text-2xl font-black text-white">Website Features</h2>
            <p role="alert" className="text-sm text-rose-200">
              {siteSettingsLoading ? "Loading site settings..." : siteSettingsError}
            </p>
            {!siteSettingsLoading && (
              <AdminButton variant="outline" onClick={fetchSiteSettings}>Retry loading settings</AdminButton>
            )}
          </section>
        )}
          </main>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Order Details</div>
                <h3 className="mt-2 text-2xl font-black">{selectedOrder.orderId}</h3>
              </div>
              <AdminButton
                variant="outline"
                size="md"
                onClick={() => setSelectedOrder(null)}
                icon="✕"
              >
                CLOSE
              </AdminButton>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Order Information</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-slate-400">Order Number:</span><div className="font-semibold">{selectedOrder.orderId}</div></div>
                  <div><span className="text-slate-400">Reference Number:</span><div className="font-semibold">{selectedOrder.requestId}</div></div>
                  <div><span className="text-slate-400">Order Created:</span><div className="font-semibold">{formatReadableDate(selectedOrder.orderCreatedAt || selectedOrder.createdAt)}</div></div>
                  <div><span className="text-slate-400">Status:</span><div className="font-semibold">{statusLabel(selectedOrder.status)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Customer</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-slate-400">Full Name:</span><div className="font-semibold">{selectedOrder.customerName}</div></div>
                  <div><span className="text-slate-400">Email:</span><div className="font-semibold">{selectedOrder.customerEmail}</div></div>
                  <div><span className="text-slate-400">WhatsApp:</span><div className="font-semibold">{selectedOrder.customerPhone || "-"}</div></div>
                  <div><span className="text-slate-400">Canva Email:</span><div className="font-semibold">{selectedOrder.canvaEmail || "-"}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Subscription</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-slate-400">Plan:</span><div className="font-semibold">{selectedOrder.selectedPlan}</div></div>
                  <div><span className="text-slate-400">Amount:</span><div className="font-semibold">{selectedOrder.planPrice || "-"}</div></div>
                  <div><span className="text-slate-400">Activated At:</span><div className="font-semibold">{formatReadableDate(selectedOrder.activatedAt)}</div></div>
                  <div><span className="text-slate-400">Expires At:</span><div className="font-semibold">{formatReadableDate(selectedOrder.expiryAt)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Payment</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-slate-400">Payment Method:</span><div className="font-semibold">{selectedOrder.paymentMethod || "-"}</div></div>
                  <div><span className="text-slate-400">Payment Reference:</span><div className="font-semibold">{selectedOrder.paymentDetails || "-"}</div></div>
                </div>
              </section>

              {(() => {
                const normalizedStatus = normalizeStatus(selectedOrder.status);
                if (normalizedStatus === "PENDING") {
                  return (
                    <div className="flex flex-wrap gap-3 items-center">
                      <AdminButton
                        variant="primary"
                        size="md"
                        onClick={() => updateOrderAction(selectedOrder.orderId, "activate")}
                        disabled={actionInProgress === selectedOrder.orderId}
                        icon={actionInProgress === selectedOrder.orderId ? "⏳" : "✓"}
                      >
                        {actionInProgress === selectedOrder.orderId ? "ACTIVATING..." : "APPROVE & ACTIVATE"}
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        size="md"
                        onClick={() => updateOrderAction(selectedOrder.orderId, "reject")}
                        disabled={actionInProgress === selectedOrder.orderId}
                        icon={actionInProgress === selectedOrder.orderId ? "⏳" : "✕"}
                      >
                        {actionInProgress === selectedOrder.orderId ? "REJECTING..." : "REJECT"}
                      </AdminButton>
                    </div>
                  );
                }

                if (normalizedStatus === "ACTIVE") {
                  return <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200">🟢 ACTIVE SUBSCRIPTION</div>;
                }

                if (normalizedStatus === "EXPIRING_IN_1_DAY") {
                  return <div className="inline-flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-200">⏳ EXPIRING IN 1 DAY</div>;
                }

                if (normalizedStatus === "EXPIRED") {
                  return <div className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200">🚨 EXPIRED</div>;
                }

                if (normalizedStatus === "REJECTED") {
                  return <div className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-200">❌ REJECTED</div>;
                }

                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Refund Request Details</div>
                <h3 className="mt-2 text-2xl font-black">{selectedRefund.refundCode}</h3>
              </div>
              <AdminButton
                variant="outline"
                size="md"
                onClick={() => setSelectedRefund(null)}
                icon="✕"
              >
                CLOSE
              </AdminButton>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Refund Information</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-slate-400">Refund Request ID:</span><div className="font-semibold">{selectedRefund.refundRequestId}</div></div>
                  <div><span className="text-slate-400">Refund Code:</span><div className="font-semibold">{selectedRefund.refundCode}</div></div>
                  <div><span className="text-slate-400">Order Number:</span><div className="font-semibold">{selectedRefund.orderNumber}</div></div>
                  <div><span className="text-slate-400">Reference Number:</span><div className="font-semibold">{selectedRefund.referenceNumber}</div></div>
                  <div><span className="text-slate-400">Status:</span><div className="font-semibold">{selectedRefund.status}</div></div>
                  <div><span className="text-slate-400">Requested At:</span><div className="font-semibold">{formatReadableDate(selectedRefund.createdAt)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Verification Comparison</div>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-300">Original Order</div>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-slate-400">Name:</span> <span className="font-semibold">{selectedRefund.originalOrder?.customerName || "N/A"}</span></div>
                        <div><span className="text-slate-400">Email:</span> <span className="font-semibold text-xs">{selectedRefund.originalOrder?.customerEmail || "N/A"}</span></div>
                        <div><span className="text-slate-400">WhatsApp:</span> <span className="font-semibold">{selectedRefund.originalOrder?.customerPhone || "N/A"}</span></div>
                        <div><span className="text-slate-400">Canva Email:</span> <span className="font-semibold text-xs">{selectedRefund.originalOrder?.canvaEmail || "N/A"}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-500/30 bg-slate-500/5 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">Refund Submission</div>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-slate-400">Name:</span> <span className="font-semibold">{selectedRefund.customerName}</span></div>
                        <div><span className="text-slate-400">Email:</span> <span className="font-semibold text-xs">{selectedRefund.email}</span></div>
                        <div><span className="text-slate-400">WhatsApp:</span> <span className="font-semibold">{selectedRefund.whatsapp}</span></div>
                        <div><span className="text-slate-400">Canva Email:</span> <span className="font-semibold text-xs">{selectedRefund.canvaEmail}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">Subscription Details</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-slate-400">Plan:</span><div className="font-semibold">{selectedRefund.originalPlanType} ({selectedRefund.originalPlan})</div></div>
                  <div><span className="text-slate-400">Refund Amount:</span><div className="font-semibold">${selectedRefund.requestedRefundAmount}</div></div>
                  <div><span className="text-slate-400">Subscription Started:</span><div className="font-semibold">{selectedRefund.startedDate} {selectedRefund.startedTime}</div></div>
                  <div><span className="text-slate-400">Eligible Until:</span><div className="font-semibold">{selectedRefund.refundEligibleUntilDate} {selectedRefund.refundEligibleUntilTime}</div></div>
                  <div><span className="text-slate-400">Refund Reason:</span><div className="font-semibold">{selectedRefund.refundReason || "N/A"}</div></div>
                  <div><span className="text-slate-400">Telegram Status:</span><div className="font-semibold">{selectedRefund.telegramNotificationStatus}</div></div>
                </div>
              </section>

              {selectedRefund.status === "PENDING" && (
                <div className="flex flex-wrap gap-3 items-center">
                  <AdminButton
                    variant="success"
                    size="md"
                    onClick={() => updateRefundAction(selectedRefund.refundRequestId, "APPROVE")}
                    disabled={actionInProgress === selectedRefund.refundRequestId}
                    icon={actionInProgress === selectedRefund.refundRequestId ? "⏳" : "✓"}
                  >
                    {actionInProgress === selectedRefund.refundRequestId ? "APPROVING..." : "APPROVE"}
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    size="md"
                    onClick={() => updateRefundAction(selectedRefund.refundRequestId, "REJECT")}
                    disabled={actionInProgress === selectedRefund.refundRequestId}
                    icon={actionInProgress === selectedRefund.refundRequestId ? "⏳" : "✕"}
                  >
                    {actionInProgress === selectedRefund.refundRequestId ? "REJECTING..." : "REJECT"}
                  </AdminButton>
                </div>
              )}

              {selectedRefund.status === "APPROVED" && (
                <div className="flex flex-wrap gap-3 items-center">
                  <AdminButton
                    variant="success"
                    size="md"
                    onClick={() => updateRefundAction(selectedRefund.refundRequestId, "PROCESSED")}
                    disabled={actionInProgress === selectedRefund.refundRequestId}
                    icon={actionInProgress === selectedRefund.refundRequestId ? "⏳" : "✓"}
                  >
                    {actionInProgress === selectedRefund.refundRequestId ? "PROCESSING..." : "MARK AS PROCESSED"}
                  </AdminButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white animate-in fade-in slide-in-from-bottom-2 ${
              toast.type === "success"
                ? "bg-emerald-500/90"
                : "bg-red-500/90"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
