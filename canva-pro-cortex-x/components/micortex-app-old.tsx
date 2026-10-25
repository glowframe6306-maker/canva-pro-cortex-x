"use client";

import { useEffect, useState } from "react";
import { plans, defaultBankSettings, type Plan, type BankSettings, type Order } from "@/components/site-data";

type OrderForm = {
  fullName: string;
  email: string;
  whatsapp: string;
  canvaEmail: string;
  remarks: string;
};

type PaymentForm = {
  referenceNumber: string;
  receiptFile: File | null;
};

type TrialForm = {
  fullName: string;
  email: string;
  canvaEmail: string;
};

type SuccessState = {
  orderId: string;
  plan: string;
  price: number;
  isTrial?: boolean;
  trialStartDate?: string;
  trialStartTime?: string;
  trialEndDate?: string;
  trialEndTime?: string;
};

function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function CheckCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.6 12.3 2.2 2.2 4.6-5.1" />
    </svg>
  );
}

function XCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
    </svg>
  );
}

function UploadIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

const planCards = [
  {
    id: "weekly",
    name: "WEEKLY",
    price: 200,
    duration: "For 7 Days",
    icon: "📅",
    color: "from-blue-500 to-blue-600",
    borderColor: "border-blue-400/30",
  },
  {
    id: "monthly",
    name: "MONTHLY",
    price: 500,
    duration: "For 30 Days",
    icon: "📆",
    color: "from-purple-500 to-purple-600",
    borderColor: "border-purple-400/30",
  },
  {
    id: "annually",
    name: "ANNUALLY",
    price: 2000,
    duration: "For 1 Year",
    icon: "👑",
    color: "from-green-500 to-green-600",
    borderColor: "border-green-400/30",
  },
  {
    id: "lifetime",
    name: "LIFETIME",
    price: 5000,
    duration: "Lifetime Access",
    icon: "💎",
    color: "from-yellow-500 to-yellow-600",
    borderColor: "border-yellow-400/30",
  },
];

export default function MicortexApp() {
  const [step, setStep] = useState<"home" | "confirm" | "details" | "payment" | "review" | "success" | "trial">("home");
  const [selectedPlan, setSelectedPlan] = useState<typeof planCards[0] | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm>({ fullName: "", email: "", whatsapp: "", canvaEmail: "", remarks: "" });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ referenceNumber: "", receiptFile: null });
  const [trialForm, setTrialForm] = useState<TrialForm>({ fullName: "", email: "", canvaEmail: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [bankSettings] = useState(defaultBankSettings);

  const planDetail = plans.find((p) => p.id === selectedPlan?.id);

  const handleOrderSubmit = async () => {
    if (!orderForm.fullName || !orderForm.email || !orderForm.whatsapp || !orderForm.canvaEmail) {
      setMessage("Please fill in all required fields.");
      return;
    }

    if (!paymentForm.referenceNumber || !paymentForm.receiptFile) {
      setMessage("Please provide both reference number and payment slip.");
      return;
    }

    setLoading(true);
    setMessage("Submitting your order...");

    try {
      const formData = new FormData();
      formData.append("customerName", orderForm.fullName);
      formData.append("customerPhone", orderForm.whatsapp);
      formData.append("customerEmail", orderForm.email);
      formData.append("canvaEmail", orderForm.canvaEmail);
      formData.append("selectedPlan", planDetail?.name || "");
      formData.append("planPrice", String(planDetail?.price || 0));
      formData.append("paymentMethod", "Bank Transfer");
      formData.append("paymentDetails", paymentForm.referenceNumber);
      formData.append("orderDate", new Date().toISOString());
      formData.append("additionalInfo", orderForm.remarks);
      formData.append("receiptName", paymentForm.receiptFile.name);
      formData.append("receipt", paymentForm.receiptFile);

      const response = await fetch("/api/orders", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.error || "Failed to submit order. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessState({
        orderId: result.orderId,
        plan: planDetail?.name || "",
        price: planDetail?.price || 0,
      });
      setStep("success");
      setLoading(false);
    } catch (error) {
      console.error("Order error:", error);
      setMessage("Unable to submit order right now. Please try again.");
      setLoading(false);
    }
  };

  const handleTrialSubmit = async () => {
    if (!trialForm.fullName || !trialForm.email || !trialForm.canvaEmail) {
      setMessage("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setMessage("Submitting free trial request...");

    try {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 3);

      const formData = new FormData();
      formData.append("customerName", trialForm.fullName);
      formData.append("customerEmail", trialForm.email);
      formData.append("canvaEmail", trialForm.canvaEmail);
      formData.append("selectedPlan", "3 Days Free Trial");
      formData.append("planPrice", "0");
      formData.append("paymentMethod", "Free Trial");
      formData.append("orderDate", now.toISOString());

      const response = await fetch("/api/orders", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.error || "Failed to start free trial. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessState({
        orderId: result.orderId,
        plan: "3 Days Free Trial",
        price: 0,
        isTrial: true,
        trialStartDate: new Date().toLocaleDateString("en-CA"),
        trialStartTime: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        trialEndDate: result.trialEndDate,
        trialEndTime: result.trialEndTime,
      });
      setStep("success");
      setLoading(false);
    } catch (error) {
      console.error("Trial error:", error);
      setMessage("Unable to start free trial right now. Please try again.");
      setLoading(false);
    }
  };

  if (step === "success" && successState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4 md:p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[30px] border border-cyan-400/20 bg-slate-900/80 p-8 text-center shadow-[0_0_60px_rgba(34,211,238,0.2)] backdrop-blur-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/25 to-violet-500/25 text-cyan-100 shadow-[0_0_45px_rgba(34,211,238,0.18)]">
              <CheckCircleIcon className="h-10 w-10" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-white md:text-4xl">
              {successState.isTrial ? "✨ Free Trial Activated" : "🎉 Order Received"}
            </h2>
            <p className="mt-3 text-slate-300">
              {successState.isTrial
                ? "Your 3-day free trial has been activated successfully."
                : "Your order has been successfully submitted."}
            </p>
            <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/60 p-6">
              <div className="text-sm text-slate-400">Your Request Number</div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 px-4 py-3">
                <span className="text-xl font-black text-white">{successState.orderId}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(successState.orderId)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300"
                >
                  <CopyIcon className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <div className="mt-4 space-y-2 text-left text-sm text-slate-300">
                {successState.isTrial ? (
                  <>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="font-semibold text-green-400">Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trial Start</span>
                      <span className="font-semibold text-white">
                        {successState.trialStartDate} {successState.trialStartTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trial Ends</span>
                      <span className="font-semibold text-white">
                        {successState.trialEndDate} {successState.trialEndTime}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Plan</span>
                      <span className="font-semibold text-white">{successState.plan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Price</span>
                      <span className="font-semibold text-white">{successState.price === 0 ? "FREE" : `Rs. ${successState.price}`}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400">Thank you for choosing MI CORTEX X INC.</p>
            <button
              onClick={() => {
                setStep("home");
                setSelectedPlan(null);
                setOrderForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "", remarks: "" });
                setPaymentForm({ referenceNumber: "", receiptFile: null });
                setTrialForm({ fullName: "", email: "", canvaEmail: "" });
                setSuccessState(null);
                setMessage("");
              }}
              className="mt-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-3 font-bold text-white hover:shadow-lg"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        {step === "home" && (
          <>
            <div className="mb-12 text-center">
              <img src="/logo.svg" alt="Cortex" className="mx-auto mb-6 h-16 w-auto" />
              <h1 className="text-5xl font-black text-white md:text-6xl">CANVA PRO</h1>
              <p className="mt-4 text-lg text-slate-300">Choose the plan that fits your needs. Simple, fast and easy.</p>
            </div>

            {/* Plan Cards */}
            <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {planCards.map((card) => (
                <div
                  key={card.id}
                  className={`group rounded-[24px] border ${card.borderColor} bg-slate-900/60 p-6 transition duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(34,211,238,0.3)]`}
                >
                  <div className={`mb-4 text-4xl`}>{card.icon}</div>
                  <h3 className="text-xl font-bold text-white">{card.name}</h3>
                  <p className="mt-2 text-3xl font-black text-white">Rs. {card.price.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-400">{card.duration}</p>
                  <button
                    onClick={() => {
                      setSelectedPlan(card);
                      setStep("confirm");
                    }}
                    className={`mt-6 w-full rounded-full px-4 py-2 font-bold text-white transition hover:scale-105 ${card.color} bg-gradient-to-r shadow-lg`}
                  >
                    ORDER NOW →
                  </button>
                </div>
              ))}
            </div>

            {/* Free Trial */}
            <div className="mb-12 rounded-[24px] border border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 p-8 text-center">
              <p className="text-2xl font-bold text-white">✨ ENJOY 3 DAYS FREE TRIAL</p>
              <p className="mt-2 text-slate-300">Try Canva Pro for 3 days — no payment slip required.</p>
              <button
                onClick={() => setStep("trial")}
                className="mt-6 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-8 py-3 font-bold text-white hover:shadow-lg"
              >
                START FREE TRIAL →
              </button>
            </div>

            {/* Why Canva Pro */}
            <div className="mb-12">
              <h2 className="mb-6 text-center text-3xl font-bold text-white">Why Canva Pro?</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[
                  ["🎨", "Premium Design Resources"],
                  ["✨", "More Creative Possibilities"],
                  ["🤖", "Powerful Creative Tools"],
                  ["⚡", "Faster Design Workflow"],
                ].map(([icon, title]) => (
                  <div key={title} className="rounded-[20px] border border-white/10 bg-slate-900/60 p-4 text-center">
                    <div className="text-3xl">{icon}</div>
                    <p className="mt-2 font-semibold text-white">{title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-8 text-center">
              <p className="text-2xl font-bold text-white">ALL RIGHTS RESERVED BY MI CORTEX X</p>
              <div className="mt-4 flex justify-center gap-6">
                <a href="https://wa.me/94756390621" className="flex items-center gap-2 text-slate-300 hover:text-cyan-300">
                  WhatsApp: 0756390621
                </a>
              </div>
              <p className="mt-6 text-sm text-slate-400">© 2026 MI CORTEX X INC. All Rights Reserved.</p>
            </div>
          </>
        )}

        {/* Confirm Plan */}
        {step === "confirm" && selectedPlan && (
          <div className="mx-auto max-w-2xl rounded-[30px] border border-cyan-400/20 bg-slate-900/80 p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white">Confirm Your Plan</h2>
            <div className="mt-6 rounded-[20px] border border-white/10 bg-slate-950/60 p-6">
              <div className="text-4xl mb-4">{selectedPlan.icon}</div>
              <p className="text-3xl font-bold text-white">{selectedPlan.name}</p>
              <p className="mt-2 text-2xl font-black text-cyan-300">Rs. {selectedPlan.price.toLocaleString()}</p>
              <p className="mt-1 text-slate-300">{selectedPlan.duration}</p>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={() => setStep("home")}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 font-bold text-white hover:border-cyan-300"
              >
                CANCEL
              </button>
              <button
                onClick={() => setStep("details")}
                className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-bold text-white hover:shadow-lg"
              >
                CONFIRM
              </button>
            </div>
          </div>
        )}

        {/* Details Form */}
        {step === "details" && (
          <div className="mx-auto max-w-2xl rounded-[30px] border border-cyan-400/20 bg-slate-900/80 p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white">YOUR DETAILS</h2>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={orderForm.fullName}
                onChange={(e) => setOrderForm({ ...orderForm, fullName: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={orderForm.email}
                onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
              <input
                type="tel"
                placeholder="WhatsApp Number"
                value={orderForm.whatsapp}
                onChange={(e) => setOrderForm({ ...orderForm, whatsapp: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
              <input
                type="email"
                placeholder="Canva Email Address"
                value={orderForm.canvaEmail}
                onChange={(e) => setOrderForm({ ...orderForm, canvaEmail: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
              <textarea
                placeholder="Remarks (Optional)"
                value={orderForm.remarks}
                onChange={(e) => setOrderForm({ ...orderForm, remarks: e.target.value })}
                className="w-full min-h-24 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
            </div>
            {message && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                {message}
              </div>
            )}
            <div className="mt-6 flex gap-4">
              <button
                onClick={() => {
                  setStep("confirm");
                  setMessage("");
                }}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 font-bold text-white hover:border-cyan-300"
              >
                BACK
              </button>
              <button
                onClick={() => {
                  setMessage("");
                  setStep("payment");
                }}
                className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-bold text-white hover:shadow-lg"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* Payment Form */}
        {step === "payment" && selectedPlan && (
          <div className="mx-auto max-w-2xl rounded-[30px] border border-cyan-400/20 bg-slate-900/80 p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white">PAYMENT</h2>
            <div className="mt-6 rounded-[20px] border border-cyan-400/20 bg-cyan-500/5 p-4">
              <p className="text-slate-300">
                Plan: <span className="font-bold text-white">{selectedPlan.name}</span>
              </p>
              <p className="mt-1 text-slate-300">
                Amount: <span className="font-bold text-white">Rs. {selectedPlan.price}</span>
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white">Reference Number</label>
                <input
                  type="text"
                  placeholder="Enter payment reference"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white">Upload Your Slip</label>
                <label className="mt-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-400/30 bg-slate-950/60 p-6 cursor-pointer hover:border-cyan-400/50 transition">
                  <UploadIcon className="mb-2 text-cyan-300" />
                  <span className="text-sm text-slate-300">
                    {paymentForm.receiptFile ? paymentForm.receiptFile.name : "Click to upload JPG, PNG, WEBP"}
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(e) => setPaymentForm({ ...paymentForm, receiptFile: e.target.files?.[0] || null })}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {message && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                {message}
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => {
                  setStep("details");
                  setMessage("");
                }}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 font-bold text-white hover:border-cyan-300"
              >
                BACK
              </button>
              <button
                onClick={() => {
                  setMessage("");
                  setStep("review");
                }}
                className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-bold text-white hover:shadow-lg"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* Review Form */}
        {step === "review" && selectedPlan && planDetail && (
          <div className="mx-auto max-w-2xl rounded-[30px] border border-cyan-400/20 bg-slate-900/80 p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white">REVIEW YOUR ORDER</h2>

            <div className="mt-6 space-y-3 rounded-[20px] border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Plan</span>
                <span className="font-semibold text-white">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Price</span>
                <span className="font-semibold text-white">Rs. {selectedPlan.price}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="font-semibold text-white">{selectedPlan.duration}</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="flex justify-between">
                  <span>Full Name</span>
                  <span className="font-semibold text-white">{orderForm.fullName}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span>Email</span>
                  <span className="font-semibold text-white">{orderForm.email}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span>WhatsApp</span>
                  <span className="font-semibold text-white">{orderForm.whatsapp}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span>Canva Email</span>
                  <span className="font-semibold text-white">{orderForm.canvaEmail}</span>
                </div>
                {orderForm.remarks && (
                  <div className="mt-2 flex justify-between">
                    <span>Remarks</span>
                    <span className="font-semibold text-white">{orderForm.remarks}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between">
                  <span>Reference</span>
                  <span className="font-semibold text-white">{paymentForm.referenceNumber}</span>
                </div>
              </div>
            </div>

            {message && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                {message}
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => {
                  setStep("payment");
                  setMessage("");
                }}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 font-bold text-white hover:border-cyan-300"
              >
                BACK
              </button>
              <button
                onClick={handleOrderSubmit}
                disabled={loading}
                className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-bold text-white hover:shadow-lg disabled:opacity-60"
              >
                {loading ? "SUBMITTING..." : "SUBMIT ORDER"}
              </button>
            </div>
          </div>
        )}

        {/* Trial Form */}
        {step === "trial" && (
          <div className="mx-auto max-w-2xl rounded-[30px] border border-yellow-400/20 bg-slate-900/80 p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white">3 DAYS FREE TRIAL</h2>

            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={trialForm.fullName}
                onChange={(e) => setTrialForm({ ...trialForm, fullName: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={trialForm.email}
                onChange={(e) => setTrialForm({ ...trialForm, email: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
              <input
                type="email"
                placeholder="Canva Email Account"
                value={trialForm.canvaEmail}
                onChange={(e) => setTrialForm({ ...trialForm, canvaEmail: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
              />
            </div>

            {message && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                {message}
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => {
                  setStep("home");
                  setMessage("");
                }}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 font-bold text-white hover:border-cyan-300"
              >
                CANCEL
              </button>
              <button
                onClick={handleTrialSubmit}
                disabled={loading}
                className="flex-1 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-3 font-bold text-white hover:shadow-lg disabled:opacity-60"
              >
                {loading ? "SUBMITTING..." : "SUBMIT →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
