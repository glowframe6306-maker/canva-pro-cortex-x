"use client";

import { useEffect, useRef, useState } from "react";
import { plans, defaultBankSettings, type Plan, type BankSettings, type Order } from "@/components/site-data";
import { PremiumHeader } from "@/components/premium-header";
import { AboutCanvaModal } from "@/components/about-canva-modal";
import { LimitedTimeOfferBanner } from "@/components/limited-time-offer-banner";
import {
  AnnouncementBar,
  FeaturedPlanSection,
  PlanComparisonTable,
  FAQAccordion,
  OrderTrackingWidget,
  PromoCodeWidget,
} from "@/components/site-feature-widgets";
import { PromotionCountdown } from "@/components/promotion-countdown";
import { calculateCheckoutPlanPrice } from "@/lib/pricing-calculation";
import {
  validateCustomerDetails,
  validateCustomerDetailsAndContinue,
  type CustomerDetailsErrors,
} from "@/lib/customer-details";

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
  whatsapp: string;
  canvaEmail: string;
};

type SuccessState = {
  orderId: string;
  referenceNumber?: string;
  requestId?: string;
  plan: string;
  price: number;
  isTrial?: boolean;
  trialStartDate?: string;
  trialStartTime?: string;
  trialEndDate?: string;
  trialEndTime?: string;
};

type PaymentAccountDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  branchCode: string;
  swiftCode: string;
};

type CustomerServiceForm = {
  fullName: string;
  whatsappNumber: string;
  email: string;
  canvaEmail: string;
  reason: string;
  message: string;
};

type CustomerServiceSuccess = {
  requestId: string;
  createdDate: string;
  createdTime: string;
};

type RefundForm = {
  orderNumber: string;
  referenceNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  canvaEmail: string;
  refundReason: string;
  additionalDetails: string;
};

// Premium icons
function CheckCircleIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l2 2 4-4" />
    </svg>
  );
}

function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M5 15H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function UploadIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
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
    gradient: "from-purple-500 via-pink-500 to-red-500",
    borderGradient: "from-purple-400 to-pink-400",
    description: "Perfect for short-term creative projects.",
    accent: "#ec4899",
  },
  {
    id: "monthly",
    name: "MONTHLY",
    price: 500,
    duration: "For 30 Days",
    icon: "✨",
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    borderGradient: "from-blue-400 to-cyan-400",
    description: "Great for consistent monthly creative work.",
    accent: "#06b6d4",
  },
  {
    id: "annually",
    name: "ANNUALLY",
    price: 2000,
    duration: "For 1 Year",
    icon: "👑",
    gradient: "from-violet-500 via-purple-500 to-pink-500",
    borderGradient: "from-violet-400 to-purple-400",
    description: "The smart choice for long-term creativity.",
    badge: "BEST VALUE",
    accent: "#a855f7",
  },
  {
    id: "lifetime",
    name: "LIFETIME",
    price: 5000,
    duration: "Lifetime Access",
    icon: "💎",
    gradient: "from-amber-400 via-yellow-400 to-orange-400",
    borderGradient: "from-amber-300 to-yellow-300",
    description: "For customers who want premium forever.",
    badge: "PREMIUM",
    accent: "#fbbf24",
  },
];

const benefitCards = [
  ["🎨", "Premium Templates", "Create beautiful designs faster with thousands of professional templates."],
  ["✨", "Premium Elements", "Access exclusive creative resources and design elements."],
  ["🤖", "Powerful Tools", "Professional creative workflow with advanced design tools."],
  ["⚡", "AI Magic", "Powerful AI-powered creative assistance."],
];

export default function MicortexAppPremium() {
  const [step, setStep] = useState<"home" | "confirm" | "details" | "payment" | "review" | "success" | "trial">("home");
  const [selectedPlan, setSelectedPlan] = useState<(typeof planCards)[0] | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm>({ fullName: "", email: "", whatsapp: "", canvaEmail: "", remarks: "" });
  const [customerDetailErrors, setCustomerDetailErrors] = useState<CustomerDetailsErrors>({});
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ referenceNumber: "", receiptFile: null });
  const [trialForm, setTrialForm] = useState<TrialForm>({ fullName: "", email: "", whatsapp: "", canvaEmail: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [previewImg, setPreviewImg] = useState<string>("");
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [activePromotion, setActivePromotion] = useState<any>(null);
  const [orderNumberCopied, setOrderNumberCopied] = useState(false);
  const [referenceNumberCopied, setReferenceNumberCopied] = useState(false);
  const [savedOrderDetails, setSavedOrderDetails] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAboutCanvaModal, setShowAboutCanvaModal] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentAccountDetails | null>(null);
  const [paymentAccountCopied, setPaymentAccountCopied] = useState(false);
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [customerServiceForm, setCustomerServiceForm] = useState<CustomerServiceForm>({ fullName: "", whatsappNumber: "", email: "", canvaEmail: "", reason: "", message: "" });
  const [customerServiceLoading, setCustomerServiceLoading] = useState(false);
  const [customerServiceMessage, setCustomerServiceMessage] = useState("");
  const [customerServiceSuccess, setCustomerServiceSuccess] = useState<CustomerServiceSuccess | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState<RefundForm>({ orderNumber: "", referenceNumber: "", customerName: "", email: "", whatsapp: "", canvaEmail: "", refundReason: "", additionalDetails: "" });
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");
  const [refundSuccess, setRefundSuccess] = useState<{
    refundRequestId: string;
    refundCode: string;
    orderNumber: string;
    referenceNumber: string;
    plan: string;
    status: string;
  } | null>(null);
  const [customerPromo, setCustomerPromo] = useState<{
    code: string;
    discount: number;
    finalPrice: number;
    discountPercentage: number;
    applicablePlans: string[];
    message: string;
  } | null>(null);
  const customerServiceSubmittingRef = useRef(false);
  const submissionKeysRef = useRef<{ order: { fingerprint: string; key: string } | null; trial: { fingerprint: string; key: string } | null }>({
    order: null,
    trial: null,
  });
  const aboutModalContentRef = useRef<HTMLDivElement>(null);
  const aboutCanvaModalContentRef = useRef<HTMLDivElement>(null);
  const plansSectionRef = useRef<HTMLDivElement>(null);
  const aboutPreviousOverflowRef = useRef<string | null>(null);

  const getSubmissionKey = async (kind: "order" | "trial", fingerprint: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
    const fingerprintHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const storageKey = `cortex-order-idempotency-${kind}`;
    const existing = submissionKeysRef.current[kind];
    if (existing?.fingerprint === fingerprintHash) return existing.key;

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed === "object" &&
          "fingerprint" in parsed &&
          parsed.fingerprint === fingerprintHash &&
          "key" in parsed &&
          typeof parsed.key === "string"
        ) {
          submissionKeysRef.current[kind] = { fingerprint: fingerprintHash, key: parsed.key };
          return parsed.key;
        }
      }
    } catch {
      console.warn("Unable to read the order retry key from session storage.");
    }

    const next = { fingerprint: fingerprintHash, key: crypto.randomUUID() };
    submissionKeysRef.current[kind] = next;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      console.warn("Unable to persist the order retry key for this browser session.");
    }
    return next.key;
  };

  const clearSubmissionKey = (kind: "order" | "trial") => {
    submissionKeysRef.current[kind] = null;
    try {
      sessionStorage.removeItem(`cortex-order-idempotency-${kind}`);
    } catch {
      console.warn("Unable to clear the completed order retry key.");
    }
  };

  useEffect(() => {
    fetch("/api/promotions/active")
      .then((response) => response.json())
      .then((result) => setActivePromotion(result.promotion || null))
      .catch(() => setActivePromotion(null));
  }, []);

  useEffect(() => {
    if (!showAboutModal) return;

    const previousOverflow = document.body.style.overflow;
    aboutPreviousOverflowRef.current = previousOverflow;
    document.body.style.overflow = "hidden";
    aboutModalContentRef.current?.scrollTo({ top: 0, behavior: "auto" });

    return () => {
      document.body.style.overflow = aboutPreviousOverflowRef.current ?? previousOverflow;
      aboutPreviousOverflowRef.current = null;
    };
  }, [showAboutModal]);

  useEffect(() => {
    if (!showPaymentDetails || paymentDetails) return;

    fetch("/api/payment-details")
      .then((response) => response.json())
      .then((details: PaymentAccountDetails) => setPaymentDetails(details))
      .catch((error) => console.error("Payment details error:", error));
  }, [showPaymentDetails, paymentDetails]);

  useEffect(() => {
    if (!showPaymentDetails) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPaymentDetails]);

  useEffect(() => {
    if (!showCustomerService && !customerServiceSuccess) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCustomerService, customerServiceSuccess]);

  useEffect(() => {
    if (!showAboutCanvaModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aboutCanvaModalContentRef.current?.scrollTo({ top: 0, behavior: "auto" });

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showAboutCanvaModal]);

  const handleCopyPaymentAccount = async () => {
    if (!paymentDetails?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(paymentDetails.accountNumber);
      setPaymentAccountCopied(true);
      setTimeout(() => setPaymentAccountCopied(false), 2000);
    } catch (error) {
      console.error("Payment account copy failed:", error);
    }
  };

  const resetCustomerService = () => {
    setCustomerServiceForm({ fullName: "", whatsappNumber: "", email: "", canvaEmail: "", reason: "", message: "" });
    setCustomerServiceMessage("");
    setCustomerServiceLoading(false);
    customerServiceSubmittingRef.current = false;
  };

  const handleCloseCustomerService = () => {
    setShowCustomerService(false);
    resetCustomerService();
  };

  const handleCloseCustomerServiceSuccess = () => {
    setCustomerServiceSuccess(null);
  };

  const handleCustomerServiceSubmit = async () => {
    if (customerServiceSubmittingRef.current) return;

    const form = {
      fullName: customerServiceForm.fullName.trim(),
      whatsappNumber: customerServiceForm.whatsappNumber.trim(),
      email: customerServiceForm.email.trim(),
      canvaEmail: customerServiceForm.canvaEmail.trim(),
      reason: customerServiceForm.reason.trim(),
      message: customerServiceForm.message.trim(),
    };
    if (!form.fullName || !form.whatsappNumber || !form.email || !form.canvaEmail || !form.reason || !form.message) {
      setCustomerServiceMessage("Please complete all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setCustomerServiceMessage("Please enter a valid email address.");
      return;
    }
    if (!/^[+\d][\d\s().-]{6,}$/.test(form.whatsappNumber)) {
      setCustomerServiceMessage("Please enter a valid WhatsApp number.");
      return;
    }

    setCustomerServiceLoading(true);
    customerServiceSubmittingRef.current = true;
    setCustomerServiceMessage("");
    try {
      const response = await fetch("/api/customer-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setCustomerServiceMessage(result.error || "Unable to send your request right now. Please try again.");
        setCustomerServiceLoading(false);
        customerServiceSubmittingRef.current = false;
        return;
      }
      setShowCustomerService(false);
      resetCustomerService();
      setCustomerServiceSuccess({ requestId: result.requestId, createdDate: result.createdDate, createdTime: result.createdTime });
    } catch (error) {
      console.error("Customer service request error:", error);
      setCustomerServiceMessage("Unable to send your request right now. Please try again.");
      setCustomerServiceLoading(false);
      customerServiceSubmittingRef.current = false;
    }
  };

  // Check if order form has data
  const hasOrderData = () => {
    return orderForm.fullName || orderForm.email || orderForm.whatsapp || orderForm.canvaEmail || orderForm.remarks || paymentForm.referenceNumber || paymentForm.receiptFile;
  };

  // Check if trial form has data
  const hasTrialData = () => {
    return trialForm.fullName || trialForm.email || trialForm.whatsapp || trialForm.canvaEmail;
  };

  // Cancel the order flow without validation or confirmation.
  const cancelOrder = () => {
    setStep("home");
    setSelectedPlan(null);
    setOrderForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "", remarks: "" });
    setCustomerDetailErrors({});
    setPaymentForm({ referenceNumber: "", receiptFile: null });
    setTrialForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "" });
    setLoading(false);
    setMessage("");
    setPreviewImg("");
    setDiscardConfirm(false);
  };

  const handleCloseAbout = () => {
    document.body.style.overflow = aboutPreviousOverflowRef.current ?? "";
    aboutPreviousOverflowRef.current = null;
    setShowAboutModal(false);
  };

  const handleCloseAboutCanva = () => {
    setShowAboutCanvaModal(false);
  };

  const handleScrollToPlans = () => {
    if (plansSectionRef.current) {
      plansSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Discard and go home from the legacy confirmation dialog.
  const discardOrder = () => {
    setStep("home");
    setSelectedPlan(null);
    setOrderForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "", remarks: "" });
    setCustomerDetailErrors({});
    setPaymentForm({ referenceNumber: "", receiptFile: null });
    setTrialForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "" });
    setMessage("");
    setPreviewImg("");
    setDiscardConfirm(false);
  };

  const planDetail = plans.find((p) => p.id === selectedPlan?.id);

  const getEffectivePlanPrice = (planId: string, normalPrice: number) => {
    const normalized = (planId || "").toLowerCase();
    const planEntry = activePromotion?.planPrices?.[normalized];
    const applicableList = activePromotion?.applicablePlans?.length ? activePromotion.applicablePlans : Object.keys(activePromotion?.planPrices || {});
    const promotionApplies = Boolean(activePromotion && planEntry && planEntry.enabled && applicableList.includes(normalized));
    const promotionalPrice = promotionApplies
      ? Number(planEntry.promotionalPrice ?? normalPrice)
      : undefined;

    if (customerPromo) {
      const promoApplicablePlans = (customerPromo.applicablePlans || []).map((item) => String(item).toLowerCase());
      const appliesToPlan = promoApplicablePlans.length === 0 || promoApplicablePlans.includes(normalized);
      if (appliesToPlan) {
        const percentDiscount = Number(customerPromo.discountPercentage || 0);
        const discountRange = percentDiscount > 0
          ? Math.min(normalPrice, Math.round((normalPrice * percentDiscount) / 100))
          : Math.min(normalPrice, Number(customerPromo.discount || 0));
        return calculateCheckoutPlanPrice({
          mainPrice: normalPrice,
          promoCode: customerPromo.code,
          promoDiscount: discountRange,
        });
      }
    }

    return calculateCheckoutPlanPrice({
      mainPrice: normalPrice,
      promotionPrice: promotionalPrice,
    });
  };

  const getEffectivePlanDisplay = (planId: string, normalPrice: number) => {
    const finalPrice = getEffectivePlanPrice(planId, normalPrice);
    const discountAmount = Math.max(0, normalPrice - finalPrice);
    const discountPercent = normalPrice > 0 ? Math.round((discountAmount / normalPrice) * 100) : 0;
    return {
      finalPrice,
      discountAmount,
      discountPercent,
      hasDiscount: finalPrice < normalPrice,
    };
  };

  const handlePromoApplied = (payload: {
    code: string;
    discount: number;
    finalPrice: number;
    discountPercentage: number;
    applicablePlans: string[];
    message: string;
  }) => {
    setCustomerPromo({
      code: String(payload.code || "").toUpperCase(),
      discount: Number(payload.discount || 0),
      finalPrice: Number(payload.finalPrice || 0),
      discountPercentage: Number(payload.discountPercentage || 0),
      applicablePlans: Array.isArray(payload.applicablePlans) ? payload.applicablePlans.map((item) => String(item).toLowerCase()) : [],
      message: payload.message || "Promo code applied.",
    });
  };

  const handlePromoExpired = () => {
    setActivePromotion(null);
    setCustomerPromo(null);
    fetch("/api/promotions/active")
      .then((response) => response.json())
      .then((result) => setActivePromotion(result.promotion || null))
      .catch(() => setActivePromotion(null));
  };

  const handlePromoRemoved = () => {
    setCustomerPromo(null);
  };

  const getPromotionForPlan = (planId: string) => {
    if (!activePromotion) return null;
    const normalized = (planId || "").toLowerCase();
    const entry = activePromotion.planPrices?.[normalized];
    if (!entry || !entry.enabled) return null;
    return activePromotion;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentForm({ ...paymentForm, receiptFile: file });
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImg(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleOrderSubmit = async () => {
    const customerDetails = validateCustomerDetails({
      fullName: orderForm.fullName,
      email: orderForm.email,
      whatsapp: orderForm.whatsapp,
    });
    setCustomerDetailErrors(customerDetails.ok ? {} : customerDetails.errors);
    if (!customerDetails.ok) {
      setMessage("Please correct your customer details.");
      return;
    }
    if (!orderForm.canvaEmail.trim()) {
      setMessage("Please fill in all required fields.");
      return;
    }
    if (!paymentForm.referenceNumber || !paymentForm.receiptFile) {
      setMessage("Please provide both reference number and payment slip.");
      return;
    }

    setLoading(true);
    setMessage("Processing your order...");

    try {
      const fingerprint = JSON.stringify([
        customerDetails.fullName,
        customerDetails.email,
        customerDetails.whatsapp,
        orderForm.canvaEmail,
        orderForm.remarks,
        planDetail?.id,
        customerPromo?.code,
        paymentForm.referenceNumber,
        paymentForm.receiptFile.name,
        paymentForm.receiptFile.size,
        paymentForm.receiptFile.lastModified,
      ]);
      const idempotencyKey = await getSubmissionKey("order", fingerprint);
      const formData = new FormData();
      formData.append("customerName", customerDetails.fullName);
      formData.append("customerPhone", customerDetails.whatsapp);
      formData.append("customerEmail", customerDetails.email);
      formData.append("canvaEmail", orderForm.canvaEmail);
      formData.append("selectedPlan", planDetail?.id || "");
      formData.append("planPrice", String(getEffectivePlanPrice(planDetail?.id || "", planDetail?.price || 0)));
      formData.append("promoCode", customerPromo?.code || "");
      formData.append("paymentMethod", "Bank Transfer");
      formData.append("paymentDetails", paymentForm.referenceNumber);
      formData.append("orderDate", new Date().toISOString());
      formData.append("additionalInfo", orderForm.remarks);
      formData.append("receiptName", paymentForm.receiptFile.name);
      formData.append("receipt", paymentForm.receiptFile);

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.error || "Failed to submit order. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessState({
        orderId: result.orderId || "",
        referenceNumber: result.referenceNumber || paymentForm.referenceNumber || "",
        plan: planDetail?.name || "",
        price: planDetail?.price || 0,
      });
      setStep("success");
      clearSubmissionKey("order");
      setLoading(false);
    } catch (error) {
      console.error("Order error:", error);
      setMessage("Unable to submit order right now. Please try again.");
      setLoading(false);
    }
  };

  const updateCustomerDetail = (field: keyof CustomerDetailsErrors, value: string) => {
    const updatedForm = { ...orderForm, [field]: value };
    setOrderForm(updatedForm);
    const validation = validateCustomerDetails(updatedForm);
    setCustomerDetailErrors((errors) => ({
      ...errors,
      [field]: validation.ok ? undefined : validation.errors[field],
    }));
  };

  const handleCustomerDetailsNext = () => {
    const validation = validateCustomerDetailsAndContinue(orderForm, (details) => {
      setOrderForm((current) => ({
        ...current,
        fullName: details.fullName,
        email: details.email,
        whatsapp: details.whatsapp,
      }));
      setMessage("");
      setStep("payment");
    });
    setCustomerDetailErrors(validation.ok ? {} : validation.errors);
    if (!validation.ok) setMessage("");
  };

  const handleTrialSubmit = async () => {
    if (!trialForm.fullName.trim() || !trialForm.email.trim() || !trialForm.whatsapp.trim() || !trialForm.canvaEmail.trim()) {
      setMessage("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setMessage("Activating your free trial...");

    try {
      const fingerprint = JSON.stringify([
        trialForm.fullName,
        trialForm.email,
        trialForm.whatsapp,
        trialForm.canvaEmail,
      ]);
      const idempotencyKey = await getSubmissionKey("trial", fingerprint);
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 3);

      const formData = new FormData();
      formData.append("customerName", trialForm.fullName);
      formData.append("customerEmail", trialForm.email);
      formData.append("customerPhone", trialForm.whatsapp.trim());
      formData.append("canvaEmail", trialForm.canvaEmail);
      formData.append("selectedPlan", "3 Days Free Trial");
      formData.append("planPrice", "0");
      formData.append("paymentMethod", "Free Trial");
      formData.append("orderDate", now.toISOString());

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.error || "Failed to start free trial. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessState({
        orderId: result.orderId || "",
        requestId: result.requestId || "",
        referenceNumber: result.referenceNumber || "",
        plan: "3 Days Free Trial",
        price: 0,
        isTrial: true,
        trialStartDate: new Date().toLocaleDateString("en-CA"),
        trialStartTime: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        trialEndDate: result.trialEndDate,
        trialEndTime: result.trialEndTime,
      });
      setStep("success");
      clearSubmissionKey("trial");
      setLoading(false);
    } catch (error) {
      console.error("Trial error:", error);
      setMessage("Unable to start free trial right now. Please try again.");
      setLoading(false);
    }
  };

  const handleRefundSubmit = async () => {
    const form = {
      orderNumber: refundForm.orderNumber.trim(),
      referenceNumber: refundForm.referenceNumber.trim(),
      customerName: refundForm.customerName.trim(),
      email: refundForm.email.trim(),
      whatsapp: refundForm.whatsapp.trim(),
      canvaEmail: refundForm.canvaEmail.trim(),
      refundReason: refundForm.refundReason.trim(),
      additionalDetails: refundForm.additionalDetails.trim(),
    };

    if (!form.orderNumber || !form.referenceNumber || !form.customerName || !form.email || !form.whatsapp || !form.canvaEmail || !form.refundReason) {
      setRefundMessage("Please complete all required refund fields.");
      return;
    }

    if (form.refundReason === "Other" && !form.additionalDetails) {
      setRefundMessage("Please provide additional details for the selected refund reason.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.canvaEmail)) {
      setRefundMessage("Please enter valid email addresses for both the customer and Canva email.");
      return;
    }

    setRefundLoading(true);
    setRefundMessage("");

    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setRefundMessage(result.error || "Unable to submit refund request right now.");
        setRefundLoading(false);
        return;
      }

      setRefundSuccess({
        refundRequestId: result.refundRequestId || "REF-REQUEST",
        refundCode: result.refundCode || "RFD-N/A",
        orderNumber: result.orderNumber || refundForm.orderNumber,
        referenceNumber: result.referenceNumber || refundForm.referenceNumber,
        plan: result.plan || "N/A",
        status: result.status || "PENDING",
      });
      setRefundForm({ orderNumber: "", referenceNumber: "", customerName: "", email: "", whatsapp: "", canvaEmail: "", refundReason: "", additionalDetails: "" });
      setRefundLoading(false);
    } catch (error) {
      console.error("Refund request error:", error);
      setRefundMessage("Unable to submit refund request right now. Please try again.");
      setRefundLoading(false);
    }
  };

  const handleCopyOrderNumber = async () => {
    if (!successState?.orderId) return;
    try {
      await navigator.clipboard.writeText(successState.orderId);
      setOrderNumberCopied(true);
      setTimeout(() => setOrderNumberCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleCopyReferenceNumber = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setReferenceNumberCopied(true);
      setTimeout(() => setReferenceNumberCopied(false), 2000);
      setRefundMessage("✓ Copied");
      setTimeout(() => setRefundMessage(""), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleCopyRefundCode = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setRefundMessage("✓ Copied");
      setTimeout(() => setRefundMessage(""), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleCloseSuccess = () => {
    setStep("home");
    setSelectedPlan(null);
    setOrderForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "", remarks: "" });
    setCustomerDetailErrors({});
    setPaymentForm({ referenceNumber: "", receiptFile: null });
    setTrialForm({ fullName: "", email: "", whatsapp: "", canvaEmail: "" });
    setSuccessState(null);
    setMessage("");
    setPreviewImg("");
    setOrderNumberCopied(false);
    setReferenceNumberCopied(false);
    setSavedOrderDetails(false);
  };

  // Success Screen
  if (step === "success" && successState) {
    const orderReference = successState.referenceNumber || successState.requestId || "";
    const safetyTitle = successState.isTrial ? "🔐 IMPORTANT — KEEP YOUR DETAILS SAFE" : "🔐 IMPORTANT — KEEP THESE DETAILS SAFE";
    const safetyText = successState.isTrial
      ? "Please save your Order Number and Request ID safely. You may need them later to identify your Free Trial request or contact support."
      : "Please save your Order Number and Reference Number safely. You may need these details later to check your order, contact support, verify your purchase, or request a refund.";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
        <div className="w-full max-w-lg animate-in fade-in zoom-in duration-500">
          <div className="relative max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
            <button
              type="button"
              aria-label="Close request sent popup"
              onClick={handleCloseSuccess}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer pointer-events-auto items-center justify-center rounded-full border border-white/20 text-lg text-slate-300 transition-all hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-white"
            >
              ×
            </button>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 animate-pulse">
                <CheckCircleIcon className="h-9 w-9 text-cyan-400" />
              </div>

              <h2 className="mb-3 text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {successState.isTrial ? "🎉 FREE TRIAL REQUEST SUBMITTED" : "✅ ORDER SUBMITTED SUCCESSFULLY"}
              </h2>

              <div className="mb-6 space-y-2 text-slate-300">
                <p className="text-sm font-semibold">{successState.isTrial ? "Your free trial request has been submitted successfully." : "Your order has been submitted successfully."}</p>
                <p className="text-sm">Please keep the details below safely until your request is fully completed.</p>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-5 text-left">
                <div>
                  <h3 className="mb-2 text-sm font-bold text-white">🧾 YOUR ORDER NUMBER</h3>
                  <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-base font-black text-cyan-300 sm:text-lg">
                      {successState.orderId || "N/A"}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy order number"
                      title="Copy order number"
                      onClick={() => { if (successState.orderId) navigator.clipboard.writeText(successState.orderId); setOrderNumberCopied(true); setTimeout(() => setOrderNumberCopied(false), 2000); }}
                      className="flex h-9 w-9 shrink-0 cursor-pointer pointer-events-auto items-center justify-center rounded-lg border border-cyan-300/30 text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/15 active:scale-95"
                    >
                      {orderNumberCopied ? "✓" : <CopyIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  {orderNumberCopied && <p className="mt-2 text-xs font-semibold text-cyan-300">✓ COPIED</p>}
                </div>

                {!successState.isTrial && successState.referenceNumber ? (
                  <div>
                    <h3 className="mb-2 text-sm font-bold text-white">🔖 YOUR REFERENCE NUMBER</h3>
                    <div className="flex items-center gap-3 rounded-xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 px-4 py-3">
                      <span className="min-w-0 flex-1 truncate font-mono text-base font-black text-fuchsia-300 sm:text-lg">
                        {successState.referenceNumber}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy reference number"
                        title="Copy reference number"
                        onClick={() => { if (successState.referenceNumber) navigator.clipboard.writeText(successState.referenceNumber); setReferenceNumberCopied(true); setTimeout(() => setReferenceNumberCopied(false), 2000); }}
                        className="flex h-9 w-9 shrink-0 cursor-pointer pointer-events-auto items-center justify-center rounded-lg border border-fuchsia-300/30 text-fuchsia-200 transition-all hover:border-fuchsia-200 hover:bg-fuchsia-400/15 active:scale-95"
                      >
                        {referenceNumberCopied ? "✓" : <CopyIcon className="h-4 w-4" />}
                      </button>
                    </div>
                    {referenceNumberCopied && <p className="mt-2 text-xs font-semibold text-fuchsia-300">✓ COPIED</p>}
                  </div>
                ) : null}

                {successState.isTrial && successState.requestId ? (
                  <div>
                    <h3 className="mb-2 text-sm font-bold text-white">🆔 REQUEST ID</h3>
                    <div className="flex items-center gap-3 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 px-4 py-3">
                      <span className="min-w-0 flex-1 truncate font-mono text-base font-black text-violet-300 sm:text-lg">
                        {successState.requestId}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy request id"
                        title="Copy request id"
                        onClick={() => { if (successState.requestId) navigator.clipboard.writeText(successState.requestId); setReferenceNumberCopied(true); setTimeout(() => setReferenceNumberCopied(false), 2000); }}
                        className="flex h-9 w-9 shrink-0 cursor-pointer pointer-events-auto items-center justify-center rounded-lg border border-violet-300/30 text-violet-200 transition-all hover:border-violet-200 hover:bg-violet-400/15 active:scale-95"
                      >
                        {referenceNumberCopied ? "✓" : <CopyIcon className="h-4 w-4" />}
                      </button>
                    </div>
                    {referenceNumberCopied && <p className="mt-2 text-xs font-semibold text-violet-300">✓ COPIED</p>}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-left text-sm text-amber-100">
                <h3 className="mb-2 text-base font-black text-amber-200">{safetyTitle}</h3>
                <p className="mb-2">Please save your Order Number and {successState.isTrial ? "Request ID" : "Reference Number"} safely.</p>
                <p className="mb-2">{safetyText}</p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-50">
                  <li>Check your order</li>
                  <li>Contact MI CORTEX X support</li>
                  <li>Verify your purchase</li>
                  <li>Request a refund</li>
                  <li>Track your request</li>
                </ul>
                <p className="mt-2 font-bold text-amber-50">⚠️ Do not delete, lose, or forget these details.</p>
                <p className="mt-1 text-xs text-amber-50">⚠️ Please keep them safely until your subscription/order process is fully completed.</p>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={savedOrderDetails}
                  onChange={(e) => setSavedOrderDetails(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-500"
                />
                <span>I have saved my Order Number and Reference Number safely.</span>
              </label>

              <button
                type="button"
                onClick={handleCloseSuccess}
                disabled={!savedOrderDetails}
                className="mt-5 w-full cursor-pointer pointer-events-auto rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-2xl hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                I HAVE SAVED MY DETAILS
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950" />

        {/* Animated Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: "1s"}} />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: "2s"}} />
        <div className="absolute bottom-1/3 left-0 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: "1.5s"}} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* HOME STEP */}
        {step === "home" && (
          <div className="min-h-screen">
            <AnnouncementBar onScrollToPlans={handleScrollToPlans} />
            {/* Premium Header with Logo and Branding */}
            <PremiumHeader />

            {/* About Canva Navigation Button */}
            <div className="flex justify-center gap-3 px-4 py-6 border-b border-cyan-400/20 bg-gradient-to-r from-slate-900/30 via-slate-900/20 to-slate-900/30 backdrop-blur-sm flex-wrap">
              <button
                type="button"
                onClick={() => setShowAboutCanvaModal(true)}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 px-6 py-3 font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.05] active:scale-[0.95]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-transparent to-blue-400/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative text-lg">ℹ️</span>
                <span className="relative">About Canva</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPaymentDetails(true)}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 px-5 py-3 font-semibold text-sm text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.05] active:scale-[0.95]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-300/20 via-transparent to-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative text-base">🏦</span>
                <span className="relative">Payment Details</span>
              </button>
            </div>

            {/* Main Content */}
            <div className="p-4 md:p-8 lg:p-12">
              <div className="mx-auto max-w-6xl">
                {/* Limited-Time Offer Banner */}
                <div className="mb-8 md:mb-12">
                  <LimitedTimeOfferBanner onScrollToPlans={handleScrollToPlans} />
                </div>

                <FeaturedPlanSection plans={planCards} />

                {/* Pricing Section */}
                <div className="mb-16" ref={plansSectionRef}>
                  <h2 className="text-4xl font-black text-center mb-2 text-white">Choose Your Plan</h2>
                  <p className="text-center text-slate-400 mb-12">Simple plans. Premium creativity.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {planCards.map((card, idx) => (
                      <div
                        key={card.id}
                        className="animate-in fade-in zoom-in duration-700 group"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/30 hover:shadow-2xl hover:scale-105 hover:-translate-y-2">
                          {/* Premium Badge */}
                          {card.badge && (
                            <div className="absolute top-4 right-4 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3 py-1 text-xs font-bold text-slate-900">
                              {card.badge}
                            </div>
                          )}

                          {/* Icon Circle */}
                          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 text-2xl">
                            {card.icon}
                          </div>

                          {/* Title */}
                          <h3 className="mb-2 text-2xl font-black text-white">{card.name}</h3>

                          {/* Price */}
                          <div className="mb-1 flex flex-col items-start gap-1">
                            {(() => {
                              const effective = getEffectivePlanDisplay(card.id, card.price);
                              if (effective.hasDiscount) {
                                return (
                                  <>
                                    <span className="text-sm text-slate-400 line-through">Rs. {card.price.toLocaleString()}</span>
                                    <span className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
                                      Rs. {effective.finalPrice.toLocaleString()}
                                    </span>
                                    <span className="text-xs font-bold uppercase tracking-wide text-amber-300">{effective.discountPercent}% OFF</span>
                                  </>
                                );
                              }
                              return (
                                <span className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
                                  Rs. {card.price.toLocaleString()}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Duration */}
                          <p className="mb-3 text-sm text-slate-400">{card.duration}</p>

                          {/* Description */}
                          <p className="mb-4 text-sm text-slate-400">{card.description}</p>

                          {/* Countdown for active promotions */}
                          {(() => {
                            const promo = getPromotionForPlan(card.id);
                            if (!promo) return null;
                            return (
                              <PromotionCountdown
                                endDate={promo.endDate}
                                endTime={promo.endTime}
                                onExpired={handlePromoExpired}
                                compact={false}
                              />
                            );
                          })()}

                          {/* Button */}
                          <button
                            onClick={() => {
                              setSelectedPlan(card);
                              setStep("confirm");
                            }}
                            className={`w-full rounded-full bg-gradient-to-r ${card.gradient} py-3 font-bold text-white shadow-lg transition-all hover:shadow-2xl hover:scale-105 active:scale-95`}
                          >
                            ORDER NOW →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <PlanComparisonTable plans={planCards.map((card) => ({ ...card, features: ["Premium design resources", "Premium templates", "Advanced design tools", "AI-related design features", "Additional premium resources"], available: true }))} />

                {/* Free Trial Section */}
                <div className="mb-16 animate-in fade-in duration-700 rounded-3xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-orange-500/10 p-8 md:p-12 text-center backdrop-blur-xl">
                  <div className="text-4xl mb-3">✨</div>
                  <h2 className="text-3xl font-black text-white mb-2">ENJOY 3 DAYS FREE TRIAL</h2>
                  <p className="mb-8 text-slate-300">Try the premium experience for 3 days. No payment slip required.</p>
                  <button
                    onClick={() => setStep("trial")}
                    className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-8 py-4 font-bold text-slate-900 shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                  >
                    START FREE TRIAL →
                  </button>
                </div>

                <div className="mb-16 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setRefundMessage("");
                      setRefundSuccess(null);
                      setShowRefundModal(true);
                    }}
                    className="group relative inline-flex w-full max-w-xl cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-8 py-4 text-base font-black text-white shadow-xl shadow-orange-950/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-red-950/30 active:scale-[0.98] md:text-lg"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-yellow-300/20 via-transparent to-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="relative text-xl">💰</span>
                    <span className="relative">REFUND YOUR SUBSCRIPTION</span>
                  </button>
                </div>

                <div className="mb-16 grid gap-6 lg:grid-cols-2">
                  <OrderTrackingWidget />
                  <PromoCodeWidget
                    planId={selectedPlan?.id || "monthly"}
                    price={selectedPlan?.price || 500}
                    currentCode={customerPromo?.code}
                    onPromoApplied={handlePromoApplied}
                    onPromoRemoved={handlePromoRemoved}
                  />
                </div>

                <div className="mb-16">
                  <h2 className="mb-6 text-3xl font-black text-white text-center">Frequently Asked Questions</h2>
                  <FAQAccordion />
                </div>

                {/* Why Canva Pro */}
                <div className="mb-16 animate-in fade-in duration-700">
                  <h2 className="text-4xl font-black text-center mb-12 text-white">Why Canva Pro?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {benefitCards.map(([icon, title, desc], idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/60 p-6 backdrop-blur-xl transition-all hover:border-white/30 hover:shadow-xl"
                      >
                        <div className="text-3xl mb-3">{icon}</div>
                        <h3 className="font-bold text-white mb-2">{title}</h3>
                        <p className="text-sm text-slate-400">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* About and Customer Service Buttons */}
                <div className="mb-16 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-700 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowAboutModal(true)}
                    className="group relative inline-flex w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-8 py-4 font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95 sm:w-auto"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="relative text-lg">📖</span>
                    <span className="relative">ABOUT MI CORTEX X INC.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomerService(true)}
                    className="group relative inline-flex w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-8 py-4 font-bold text-white shadow-xl shadow-cyan-950/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95 sm:w-auto"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-cyan-300/20 via-transparent to-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="relative text-lg">🎧</span>
                    <span className="relative">CUSTOMER SERVICE</span>
                  </button>
                </div>

                {/* Footer */}
                <div className="animate-in fade-in duration-700 border-t border-white/10 pt-12 text-center">
                  <div className="mb-4 flex justify-center">
                    <img
                      src="/Cortex.png"
                      alt="MI CORTEX X Logo"
                      className="h-10 w-10 rounded-full border border-cyan-400/30 bg-slate-900/70 object-cover shadow-[0_0_18px_rgba(34,211,238,0.25)] sm:h-12 sm:w-12"
                    />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4">ALL RIGHTS RESERVED BY MI CORTEX X</h3>
                  <div className="mb-6 flex justify-center gap-6">
                    <a
                      href="https://wa.me/94756390621"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-300 hover:text-green-400 transition-colors"
                    >
                      📱 WhatsApp: 0756390621
                    </a>
                  </div>
                  <p className="text-sm text-slate-500">© 2026 MI CORTEX X INC. All Rights Reserved.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT ACCOUNT DETAILS MODAL */}
        {showPaymentDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="relative max-h-[90vh] w-full max-w-lg animate-in zoom-in duration-300">
              <div className="relative max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-300/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
                <button
                  type="button"
                  aria-label="Close payment account details"
                  onClick={() => {
                    setShowPaymentDetails(false);
                    setPaymentAccountCopied(false);
                  }}
                  className="absolute right-4 top-4 z-[100] flex h-9 w-9 cursor-pointer pointer-events-auto items-center justify-center rounded-full border border-white/20 text-xl text-slate-300 transition-all hover:border-amber-300 hover:bg-amber-400/10 hover:text-white"
                >
                  ×
                </button>

                <div className="pr-8">
                  <h2 className="text-2xl font-black text-white sm:text-3xl">🏦 PAYMENT ACCOUNT DETAILS</h2>
                  <p className="mt-2 text-sm text-slate-400">Use these details to complete your payment.</p>
                </div>

                <div className="mt-6 space-y-3">
                  {paymentDetails ? (
                    ([
                      ["Bank", paymentDetails.bankName],
                      ["Account Holder", paymentDetails.accountName],
                      ["Branch", paymentDetails.branch],
                      ["Branch Code", paymentDetails.branchCode],
                      ["SWIFT Code", paymentDetails.swiftCode],
                    ] as [string, string][]).filter(([, value]) => value).map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-1 break-words font-semibold text-white">{value}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">Loading payment details...</p>
                  )}

                  {paymentDetails?.accountNumber && (
                    <div className="rounded-xl border border-amber-300/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Number</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="min-w-0 flex-1 break-all font-mono text-lg font-black text-amber-200">{paymentDetails.accountNumber}</span>
                        <button
                          type="button"
                          aria-label="Copy account number"
                          title="Copy account number"
                          onClick={handleCopyPaymentAccount}
                          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-300/30 text-amber-200 transition-all hover:border-amber-200 hover:bg-amber-300/15 active:scale-95"
                        >
                          {paymentAccountCopied ? "✓" : <CopyIcon className="h-4 w-4" />}
                        </button>
                      </div>
                      {paymentAccountCopied && <p className="mt-2 text-xs font-semibold text-amber-300">Copied!</p>}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentDetails(false);
                    setPaymentAccountCopied(false);
                  }}
                  className="mt-6 w-full cursor-pointer rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl active:scale-[0.98]"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER SERVICE MODAL */}
        {showCustomerService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="relative max-h-[90vh] w-full max-w-2xl animate-in zoom-in duration-300">
              <div className="relative max-h-[90vh] overflow-y-auto rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
                <button
                  type="button"
                  aria-label="Close customer service"
                  onClick={handleCloseCustomerService}
                  className="absolute right-4 top-4 z-[100] flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 text-xl text-slate-300 transition-all hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-white"
                >
                  ×
                </button>
                <div className="pr-8">
                  <h2 className="text-2xl font-black text-white sm:text-3xl">🎧 CUSTOMER SERVICE</h2>
                  <p className="mt-2 text-slate-400">How can we help you?</p>
                </div>

                <div className="mt-6 space-y-4">
                  <input
                    type="text"
                    placeholder="👤 Full Name"
                    value={customerServiceForm.fullName}
                    onChange={(event) => setCustomerServiceForm({ ...customerServiceForm, fullName: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="📱 WhatsApp Number"
                    value={customerServiceForm.whatsappNumber}
                    onChange={(event) => setCustomerServiceForm({ ...customerServiceForm, whatsappNumber: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="📧 Email Address"
                    value={customerServiceForm.email}
                    onChange={(event) => setCustomerServiceForm({ ...customerServiceForm, email: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="🎨 Canva Email Address"
                    value={customerServiceForm.canvaEmail}
                    onChange={(event) => setCustomerServiceForm({ ...customerServiceForm, canvaEmail: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                  <select
                    aria-label="Reason"
                    value={customerServiceForm.reason}
                    onChange={(event) => setCustomerServiceForm({ ...customerServiceForm, reason: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:border-cyan-400/50 focus:outline-none"
                  >
                    <option value="">📋 Select Reason</option>
                    {['Account / Access Issue', 'Payment Issue', 'Canva Pro Issue', 'Free Trial Issue', 'Order Issue', 'Technical Issue', 'Customer Service', 'Other'].map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                  <textarea
                    placeholder="📝 Message / Details"
                    value={customerServiceForm.message}
                    onChange={(event) => setCustomerServiceForm({ ...customerServiceForm, message: event.target.value })}
                    rows={5}
                    className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                </div>

                {customerServiceMessage && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{customerServiceMessage}</p>}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={handleCloseCustomerService} className="w-full cursor-pointer rounded-full border border-white/20 px-6 py-3 font-bold text-white transition-all hover:border-white/40 sm:w-1/3">CLOSE</button>
                  <button type="button" onClick={handleCustomerServiceSubmit} disabled={customerServiceLoading} className="w-full cursor-pointer rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1">{customerServiceLoading ? "Sending..." : "SUBMIT"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER SERVICE SUCCESS MODAL */}
        {customerServiceSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto animate-in zoom-in duration-300 rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 text-center shadow-2xl backdrop-blur-2xl sm:p-8">
              <button type="button" aria-label="Close customer service success" onClick={handleCloseCustomerServiceSuccess} className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 text-xl text-slate-300 transition-all hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-white">×</button>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20"><CheckCircleIcon className="h-9 w-9 text-cyan-400" /></div>
              <h2 className="text-2xl font-black text-transparent bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text">✓ THANK YOU FOR YOUR SUBMISSION</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>Thank you for contacting MI CORTEX X Customer Service.</p>
                <p>Your request has been successfully received by our customer service team.</p>
                <p>We will review your request and contact you using the details you provided.</p>
              </div>
              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left text-sm">
                <p><span className="text-slate-400">🆔 Request ID:</span> <strong className="text-cyan-300">{customerServiceSuccess.requestId}</strong></p>
                <p><span className="text-slate-400">📅 Submitted:</span> <strong className="text-white">{customerServiceSuccess.createdDate}</strong></p>
                <p><span className="text-slate-400">⏲️ Time:</span> <strong className="text-white">{customerServiceSuccess.createdTime}</strong></p>
                <p><span className="text-slate-400">📦 Status:</span> <strong className="text-cyan-300">REQUEST SENT</strong></p>
              </div>
              <button type="button" onClick={handleCloseCustomerServiceSuccess} className="mt-6 w-full cursor-pointer rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl">CLOSE</button>
            </div>
          </div>
        )}

        {showRefundModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
              <button type="button" aria-label="Close refund modal" onClick={() => { setShowRefundModal(false); setRefundMessage(""); setRefundSuccess(null); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 text-xl text-slate-300 transition-all hover:border-amber-300 hover:bg-amber-400/10 hover:text-white">×</button>
              <div className="mb-6">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Refund Policy</div>
                <h2 className="mt-2 text-3xl font-black text-white"># REFUND YOUR SUBSCRIPTION</h2>
              </div>

              <div className="mb-6 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-slate-200">
                <div>
                  <p className="font-black text-amber-200">WEEKLY PLAN</p>
                  <p>Refund requests are available within 3 days from subscription activation.</p>
                </div>
                <div>
                  <p className="font-black text-amber-200">MONTHLY PLAN</p>
                  <p>Refund requests are available within 14 days from subscription activation.</p>
                </div>
                <div>
                  <p className="font-black text-amber-200">YEARLY PLAN</p>
                  <p>Refund requests are available within 15 days from subscription activation.</p>
                </div>
                <div>
                  <p className="font-black text-amber-200">FREE TRIAL</p>
                  <p>No paid refund applies to the Free Trial.</p>
                </div>
                <div>
                  <p className="font-black text-red-300">AFTER THE APPLICABLE REFUND PERIOD HAS ENDED</p>
                  <p>❌ REFUND NOT AVAILABLE</p>
                </div>
              </div>

              {refundSuccess ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    <p className="font-black text-emerald-200">💰 REFUND REQUEST RECEIVED</p>
                    <p className="mt-2">Your refund request has been successfully submitted.</p>
                    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Refund Request ID</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="font-mono text-emerald-300">{refundSuccess.refundRequestId}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(refundSuccess.refundRequestId)} className="rounded-lg border border-emerald-300/30 px-2 py-1 text-xs">Copy</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Refund Code</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="font-mono text-amber-300">{refundSuccess.refundCode}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(refundSuccess.refundCode)} className="rounded-lg border border-amber-300/30 px-2 py-1 text-xs">Copy</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Order Number</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="font-mono text-cyan-300">{refundSuccess.orderNumber}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(refundSuccess.orderNumber)} className="rounded-lg border border-cyan-300/30 px-2 py-1 text-xs">Copy</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reference Number</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="font-mono text-pink-300">{refundSuccess.referenceNumber}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(refundSuccess.referenceNumber)} className="rounded-lg border border-pink-300/30 px-2 py-1 text-xs">Copy</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Plan</p>
                        <p className="mt-1 font-semibold text-white">{refundSuccess.plan}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                        <p className="mt-1 font-semibold text-emerald-300">{refundSuccess.status}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-amber-200">Refund requests are reviewed and processed within a maximum of 48 hours.</p>
                    <p className="mt-2 text-xs text-slate-300">Please keep your Order Number, Reference Number, Refund Request ID, and Refund Code safe until processing is complete.</p>
                  </div>
                  <button type="button" onClick={() => setShowRefundModal(false)} className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-white">DONE</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-sm text-amber-100">
                    <p className="font-black text-amber-200">⚠️ IMPORTANT</p>
                    <p className="mt-1">Please make sure your Order Number and Reference Number are correct. A refund request cannot be properly verified without the required order information.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">FULL NAME</label>
                      <input value={refundForm.customerName} onChange={(e) => setRefundForm({ ...refundForm, customerName: e.target.value })} placeholder="Full Name" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">EMAIL ADDRESS</label>
                      <input type="email" value={refundForm.email} onChange={(e) => setRefundForm({ ...refundForm, email: e.target.value })} placeholder="Email Address" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">WHATSAPP NUMBER</label>
                      <input value={refundForm.whatsapp} onChange={(e) => setRefundForm({ ...refundForm, whatsapp: e.target.value })} placeholder="WhatsApp Number" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">CANVA EMAIL ADDRESS</label>
                      <input type="email" value={refundForm.canvaEmail} onChange={(e) => setRefundForm({ ...refundForm, canvaEmail: e.target.value })} placeholder="Canva Email" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">ORDER NUMBER</label>
                      <input value={refundForm.orderNumber} onChange={(e) => setRefundForm({ ...refundForm, orderNumber: e.target.value })} placeholder="Order Number" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">REFERENCE NUMBER</label>
                      <input value={refundForm.referenceNumber} onChange={(e) => setRefundForm({ ...refundForm, referenceNumber: e.target.value })} placeholder="Reference Number" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">REFUND REASON</label>
                    <select value={refundForm.refundReason} onChange={(e) => setRefundForm({ ...refundForm, refundReason: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
                      <option value="">Select a reason</option>
                      <option value="Service Issue">Service Issue</option>
                      <option value="Subscription Problem">Subscription Problem</option>
                      <option value="Duplicate Payment">Duplicate Payment</option>
                      <option value="Incorrect Purchase">Incorrect Purchase</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {refundForm.refundReason === "Other" && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">ADDITIONAL DETAILS</label>
                      <textarea value={refundForm.additionalDetails} onChange={(e) => setRefundForm({ ...refundForm, additionalDetails: e.target.value })} rows={3} placeholder="Additional details" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500" />
                    </div>
                  )}

                  {refundMessage && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{refundMessage}</p>}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowRefundModal(false)} className="flex-1 rounded-full border border-white/20 px-6 py-3 font-bold text-white">CLOSE</button>
                    <button type="button" onClick={handleRefundSubmit} disabled={refundLoading} className="flex-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-white disabled:opacity-60">{refundLoading ? "SUBMITTING..." : "💰 SUBMIT REFUND REQUEST"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABOUT MODAL */}
        {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="w-full max-w-4xl max-h-[90vh] animate-in zoom-in duration-500">
              <div className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-purple-400/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 shadow-2xl backdrop-blur-2xl">
                {/* Close Button */}
                <button
                  type="button"
                  aria-label="Close About MI CORTEX X"
                  onClick={handleCloseAbout}
                  className="absolute top-6 right-6 z-[100] flex h-10 w-10 cursor-pointer pointer-events-auto items-center justify-center rounded-full border border-purple-400/30 bg-slate-900/80 text-purple-300 hover:border-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-all backdrop-blur-sm"
                >
                  ×
                </button>

                {/* Content */}
                <div
                  ref={aboutModalContentRef}
                  className="about-modal-scroll relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
                >
                  {/* Header with logo and branding */}
                  <div className="relative overflow-hidden border-b border-purple-400/20 px-6 py-12 text-center md:px-8 md:py-16">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />

                    <div className="relative z-10">
                      {/* Logo Container */}
                      <div className="flex items-center justify-center mb-6">
                        {/* Cortex Logo - Circular, Larger */}
                        <div className="h-32 w-32 rounded-full border-2 border-purple-400/50 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center overflow-hidden backdrop-blur-sm flex-shrink-0">
                          <img
                            src="/Cortex.png"
                            alt="MI CORTEX X Logo"
                            className="h-full w-full object-cover"
                          />
                        </div>

                      </div>

                      <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent mb-2">
                        MI CORTEX X INC.
                      </h1>
                      <p className="text-lg md:text-xl font-bold text-purple-300 mb-4">
                        Technology • Creativity • Innovation
                      </p>
                      <p className="text-sm md:text-base text-slate-300 italic">
                        "Building the Future with AI, Technology and Creativity."
                      </p>
                    </div>
                  </div>

                  <div className="space-y-12 px-6 py-12 md:space-y-16 md:px-8">
                  {/* About Section */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                    <h2 className="text-2xl font-black text-white mb-4">About MI CORTEX X INC.</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      MI CORTEX X INC. is a modern digital technology company founded in 2026, focused on creating innovative AI-powered services, professional digital solutions, applications, websites and technology-driven experiences.
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      Our goal is to make powerful technology more accessible, useful and creative while continuously developing modern digital solutions for individuals, businesses and online communities.
                    </p>
                  </div>

                  {/* Leadership */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                    <h2 className="text-2xl font-black text-white mb-6">Leadership</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {[
                        ["👑", "OWNER"],
                        ["💼", "CHIEF EXECUTIVE OFFICER"],
                        ["🚀", "FOUNDER"],
                        ["🏛️", "CHAIRMAN"],
                      ].map(([icon, role]) => (
                        <div key={role} className="rounded-xl border border-purple-400/30 bg-slate-950/80 p-6">
                          <div className="mb-4 text-3xl">{icon}</div>
                          <h3 className="mb-2 text-lg font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
                            {role}
                          </h3>
                          <p className="font-semibold text-white">M.I. Muhammadh</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-6 text-slate-300">
                      M.I. Muhammadh serves as the Owner, Chief Executive Officer, Founder and Chairman of MI CORTEX X INC.
                    </p>
                  </div>

                  {/* What We Do */}
                  <div>
                    <h2 className="text-2xl font-black text-white mb-6">What We Do</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        ["🤖", "AI-BASED SERVICES", "Develop innovative AI-powered solutions designed to improve productivity, creativity and digital experiences."],
                        ["💎", "PRO DIGITAL SERVICES", "Provide professional digital services and technology solutions designed for modern users and online businesses."],
                        ["🌐", "WEBSITE DEVELOPMENT", "Build modern, responsive and professional websites with attractive user interfaces and useful functionality."],
                        ["📱", "APPLICATION DEVELOPMENT", "Create modern applications and digital platforms for different needs and use cases."],
                        ["⚡", "DIGITAL INNOVATION", "Continuously explore new technologies and develop creative digital solutions."],
                        ["🛠️", "CUSTOM TECHNOLOGY SOLUTIONS", "Develop customized websites, applications and digital systems based on specific requirements."],
                      ].map(([icon, title, desc], idx) => (
                        <div key={idx} className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-6 backdrop-blur-sm hover:border-purple-300/40 hover:bg-gradient-to-br hover:from-slate-800/60 hover:to-slate-900/60 transition-all">
                          <div className="text-3xl mb-3">{icon}</div>
                          <h3 className="font-bold text-white mb-2">{title}</h3>
                          <p className="text-sm text-slate-300">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mission */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                    <h3 className="text-xl font-black text-white mb-4">Our Mission</h3>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      To create accessible, innovative and reliable digital solutions by combining artificial intelligence, modern technology and creativity.
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      We aim to transform ideas into useful digital experiences while maintaining professionalism, simplicity and continuous innovation.
                    </p>
                  </div>

                  {/* Vision */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                    <h3 className="text-xl font-black text-white mb-4">Our Vision</h3>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      To become a trusted digital technology company known for innovation, creativity, quality and intelligent technology solutions.
                    </p>
                    <p className="text-slate-300 mb-4">We believe the future of technology should be:</p>
                    <div className="flex flex-wrap gap-2">
                      {["Smart", "Accessible", "Creative", "Reliable", "Innovative"].map((value, idx) => (
                        <span key={idx} className="rounded-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-400/50 px-4 py-2 text-sm font-semibold text-purple-200">
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Why MI CORTEX X INC. */}
                  <div>
                    <h2 className="text-2xl font-black text-white mb-6">Why MI CORTEX X INC.?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        ["🚀", "Innovation", "We continuously explore new technologies and creative ideas."],
                        ["🤖", "AI Powered", "We focus on practical and intelligent AI-based solutions."],
                        ["🎨", "Creative", "We combine technology with modern design and creativity."],
                        ["⚡", "Modern", "We build with modern digital technologies and user experiences."],
                        ["🔐", "Professional", "We aim to provide reliable and professional digital services."],
                        ["🌍", "Online", "Our services are designed to be accessible through digital platforms."],
                      ].map(([icon, title, desc], idx) => (
                        <div key={idx} className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-6 backdrop-blur-sm hover:border-purple-300/40 hover:bg-gradient-to-br hover:from-slate-800/60 hover:to-slate-900/60 transition-all">
                          <div className="text-3xl mb-3">{icon}</div>
                          <h3 className="font-bold text-white mb-2">{title}</h3>
                          <p className="text-sm text-slate-300">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Values */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                    <h3 className="text-xl font-black text-white mb-6">Our Values</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {["Innovation", "Creativity", "Technology", "Quality", "Professionalism", "Continuous Improvement"].map((value, idx) => (
                        <div key={idx} className="rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/40 p-4 text-center">
                          <p className="font-bold text-purple-200">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Founded */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm text-center">
                    <p className="text-sm text-slate-400 mb-2">Since</p>
                    <h3 className="text-5xl md:text-6xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text mb-2">2026</h3>
                    <p className="text-lg font-semibold text-purple-300">Founded in 2026</p>
                  </div>

                  {/* Brand Statement */}
                  <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-900/40 to-pink-900/40 p-8 backdrop-blur-sm text-center">
                    <p className="text-2xl md:text-3xl font-black text-transparent bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text italic mb-8">
                      "Ideas become innovation when technology gives them the power to grow."
                    </p>
                    <p className="text-lg font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text mb-2">
                      MI CORTEX X INC.
                    </p>
                    <p className="text-purple-300 font-semibold">
                      Building the Future with AI, Technology and Creativity.
                    </p>
                  </div>

                  {/* Contact */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                    <h3 className="text-2xl font-black text-white mb-6 text-center">CONTACT MI CORTEX X INC.</h3>
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-purple-300 font-semibold mb-2">📱 WhatsApp / Telegram</p>
                        <p className="text-white font-bold text-lg mb-4">0756390621</p>
                        <div className="flex gap-4 justify-center">
                          <a
                            href="https://wa.me/94756390621"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-gradient-to-r from-green-500 to-teal-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                          >
                            WHATSAPP
                          </a>
                          <a
                            href="https://t.me/MICORTEXX"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                          >
                            TELEGRAM
                          </a>
                        </div>
                      </div>
                      <div className="border-t border-purple-400/20 pt-4">
                        <p className="text-slate-300 text-center">🌐 Online Digital Services</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Logo and Info */}
                  <div className="border-t border-purple-400/20 pt-12 text-center">
                    <div className="mx-auto mb-6 h-24 w-24 rounded-full border-2 border-purple-400/50 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                      <img
                        src="/Cortex.png"
                        alt="MI CORTEX X Logo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">MI CORTEX X INC.</h2>
                    <p className="text-purple-300 font-semibold mb-4">Technology • Creativity • Innovation</p>
                    <p className="text-sm text-slate-400">© 2026 MI CORTEX X INC. All rights reserved.</p>
                    <p className="text-sm text-slate-500 mt-2">Founded by M.I. Muhammadh</p>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT CANVA MODAL */}
        <AboutCanvaModal
          isOpen={showAboutCanvaModal}
          onClose={handleCloseAboutCanva}
          contentRef={aboutCanvaModalContentRef}
        />

        {/* DISCARD CONFIRMATION MODAL */}
        {discardConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md animate-in zoom-in duration-300">
              <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-2xl">
                <h2 className="mb-4 text-2xl font-black text-white">Discard This Order?</h2>
                <p className="mb-8 text-slate-400">All entered information will be lost. Continue?</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setDiscardConfirm(false)}
                    className="flex-1 rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    CONTINUE ORDER
                  </button>
                  <button
                    onClick={discardOrder}
                    className="flex-1 rounded-full bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                  >
                    DISCARD
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM MODAL */}
        {step === "confirm" && selectedPlan && !discardConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-2xl animate-in zoom-in duration-300">
              <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-2xl relative">
                {/* Close Button */}
                <button
                  onClick={cancelOrder}
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  ✕
                </button>

                {/* Header */}
                <div className="mb-8">
                  <div className="text-sm text-slate-400 mb-2">MI CORTEX X</div>
                  <h2 className="text-3xl font-black text-white">Confirm Your Selection</h2>
                </div>

                <div className="mb-8 rounded-2xl border border-white/10 bg-slate-950/60 p-8">
                  <div className="mb-4 text-5xl">{selectedPlan.icon}</div>
                  <h3 className="mb-2 text-2xl font-black text-white">{selectedPlan.name}</h3>
                  {(() => {
                    const effective = getEffectivePlanDisplay(selectedPlan.id, selectedPlan.price);
                    return (
                      <div className="mb-3">
                        {effective.hasDiscount && (
                          <p className="mb-1 text-sm text-slate-400 line-through">Rs. {selectedPlan.price.toLocaleString()}</p>
                        )}
                        <p className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
                          Rs. {effective.finalPrice.toLocaleString()}
                        </p>
                        {effective.hasDiscount && (
                          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-amber-300">{effective.discountPercent}% OFF</p>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-slate-300">{selectedPlan.duration}</p>

                  {/* Countdown for active promotions */}
                  {(() => {
                    const promo = getPromotionForPlan(selectedPlan.id);
                    if (!promo) return null;
                    return (
                      <PromotionCountdown
                        endDate={promo.endDate}
                        endTime={promo.endTime}
                        onExpired={handlePromoExpired}
                        compact={false}
                      />
                    );
                  })()}
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={cancelOrder}
                    className="z-10 flex-1 cursor-pointer pointer-events-auto rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => setStep("details")}
                    className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                  >
                    CONFIRM →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DETAILS FORM */}
        {step === "details" && !discardConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md overflow-y-auto"
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
                event.preventDefault();
                handleCustomerDetailsNext();
              }
            }}
          >
            <div className="w-full max-w-2xl my-8 animate-in zoom-in duration-300">
              <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-2xl relative">
                {/* Close Button */}
                <button
                  onClick={cancelOrder}
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  ✕
                </button>

                {/* Header */}
                <div className="mb-8">
                  <div className="text-sm text-slate-400 mb-2">MI CORTEX X</div>
                  <h2 className="mb-4 text-3xl font-black text-white">CANVA PRO ORDER</h2>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold">①</div>
                      <span className="font-bold text-white">DETAILS</span>
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-500 font-bold">②</div>
                      <span className="text-slate-500">PAYMENT</span>
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-500 font-bold">③</div>
                      <span className="text-slate-500">REVIEW</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <input
                      type="text"
                      placeholder="Full Name"
                      required
                      aria-invalid={Boolean(customerDetailErrors.fullName)}
                      aria-describedby={customerDetailErrors.fullName ? "order-full-name-error" : undefined}
                      value={orderForm.fullName}
                      onChange={(e) => updateCustomerDetail("fullName", e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none backdrop-blur-sm"
                    />
                    {customerDetailErrors.fullName && <p id="order-full-name-error" className="mt-1 text-sm text-red-300">{customerDetailErrors.fullName}</p>}
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="Email Address"
                      required
                      aria-invalid={Boolean(customerDetailErrors.email)}
                      aria-describedby={customerDetailErrors.email ? "order-email-error" : undefined}
                      value={orderForm.email}
                      onChange={(e) => updateCustomerDetail("email", e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none backdrop-blur-sm"
                    />
                    {customerDetailErrors.email && <p id="order-email-error" className="mt-1 text-sm text-red-300">{customerDetailErrors.email}</p>}
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="WhatsApp Number"
                      required
                      aria-invalid={Boolean(customerDetailErrors.whatsapp)}
                      aria-describedby={customerDetailErrors.whatsapp ? "order-whatsapp-error" : undefined}
                      value={orderForm.whatsapp}
                      onChange={(e) => updateCustomerDetail("whatsapp", e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none backdrop-blur-sm"
                    />
                    {customerDetailErrors.whatsapp && <p id="order-whatsapp-error" className="mt-1 text-sm text-red-300">{customerDetailErrors.whatsapp}</p>}
                  </div>
                  <input
                    type="email"
                    placeholder="Canva Email Address"
                    value={orderForm.canvaEmail}
                    onChange={(e) => setOrderForm({ ...orderForm, canvaEmail: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none backdrop-blur-sm"
                  />
                  <textarea
                    placeholder="Remarks (Optional)"
                    value={orderForm.remarks}
                    onChange={(e) => setOrderForm({ ...orderForm, remarks: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none backdrop-blur-sm"
                  />
                </div>

                {message && (
                  <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {message}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep("confirm")}
                    className="flex-1 rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    BACK
                  </button>
                  <button
                    onClick={cancelOrder}
                    className="z-10 flex-1 cursor-pointer pointer-events-auto rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleCustomerDetailsNext}
                    className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                  >
                    NEXT →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT FORM */}
        {step === "payment" && !discardConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-2xl my-8 animate-in zoom-in duration-300">
              <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-2xl relative">
                <button
                  onClick={cancelOrder}
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  ✕
                </button>

                <div className="mb-8">
                  <div className="text-sm text-slate-400 mb-2">MI CORTEX X</div>
                  <h2 className="mb-4 text-3xl font-black text-white">CANVA PRO ORDER</h2>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-500 font-bold">①</div>
                      <span className="text-slate-500">DETAILS</span>
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold">②</div>
                      <span className="font-bold text-white">PAYMENT</span>
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-500 font-bold">③</div>
                      <span className="text-slate-500">REVIEW</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-sm text-slate-400">Selected Plan</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xl">{selectedPlan?.icon}</span>
                    <span className="text-lg font-bold text-white">{selectedPlan?.name}</span>
                    <span className="ml-auto text-xl font-black text-cyan-400">
                      {selectedPlan ? (() => {
                        const effective = getEffectivePlanDisplay(selectedPlan.id, selectedPlan.price);
                        return effective.hasDiscount ? `Rs. ${effective.finalPrice.toLocaleString()} (${effective.discountPercent}% OFF)` : `Rs. ${selectedPlan.price.toLocaleString()}`;
                      })() : "Rs. 0"}
                    </span>
                  </div>
                </div>

                {/* Countdown for active promotions */}
                {(() => {
                  const promo = getPromotionForPlan(selectedPlan?.id || "");
                  if (!promo) return null;
                  return (
                    <div className="mb-6">
                      <PromotionCountdown
                        endDate={promo.endDate}
                        endTime={promo.endTime}
                        onExpired={handlePromoExpired}
                        compact={true}
                      />
                    </div>
                  );
                })()}

                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    placeholder="Reference Number"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none backdrop-blur-sm"
                  />

                  <div>
                    <label className="block rounded-2xl border-2 border-dashed border-cyan-400/30 bg-slate-950/40 p-8 text-center cursor-pointer hover:border-cyan-400/50 transition-all">
                      <UploadIcon className="mx-auto mb-3 h-8 w-8 text-cyan-400" />
                      <p className="font-bold text-white">Upload your payment slip</p>
                      <p className="text-sm text-slate-400">JPG, PNG or WEBP</p>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {paymentForm.receiptFile && (
                      <div className="mt-4">
                        <p className="text-sm text-slate-400 mb-2">Preview:</p>
                        {previewImg && (
                          <img src={previewImg} alt="preview" className="max-h-40 rounded-lg border border-white/10" />
                        )}
                        <p className="mt-2 text-sm text-cyan-300">{paymentForm.receiptFile.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {message && (
                  <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {message}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep("details")}
                    className="flex-1 rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    BACK
                  </button>
                  <button
                    onClick={cancelOrder}
                    className="z-10 flex-1 cursor-pointer pointer-events-auto rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => {
                      setMessage("");
                      setStep("review");
                    }}
                    className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
                  >
                    NEXT →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REVIEW FORM */}
        {step === "review" && !discardConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-2xl my-8 animate-in zoom-in duration-300">
              <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-2xl relative">
                {/* Close Button */}
                <button
                  onClick={cancelOrder}
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  ✕
                </button>

                {/* Header */}
                <div className="mb-8">
                  <div className="text-sm text-slate-400 mb-2">MI CORTEX X</div>
                  <h2 className="mb-4 text-3xl font-black text-white">CANVA PRO ORDER</h2>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-500 font-bold">①</div>
                      <span className="text-slate-500">DETAILS</span>
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-500 font-bold">②</div>
                      <span className="text-slate-500">PAYMENT</span>
                    </div>
                    <div className="text-slate-500">→</div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold">③</div>
                      <span className="font-bold text-white">REVIEW</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6 space-y-2 rounded-xl border border-white/10 bg-slate-950/60 p-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Plan</span>
                    <span className="font-bold text-white">{selectedPlan?.name}</span>
                  </div>
                  {(() => {
                    const effective = getEffectivePlanDisplay(selectedPlan?.id || "", selectedPlan?.price || 0);
                    return (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">{effective.hasDiscount ? "Final Price" : "Price"}</span>
                        <div className="flex flex-col items-end">
                          {effective.hasDiscount && (
                            <span className="text-xs text-slate-400 line-through">Rs. {(selectedPlan?.price || 0).toLocaleString()}</span>
                          )}
                          <span className="font-bold text-cyan-300">Rs. {effective.finalPrice.toLocaleString()}</span>
                          {effective.hasDiscount && (
                            <span className="text-xs font-bold text-amber-300">{effective.discountPercent}% OFF</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm">
                    <span className="text-slate-400">Duration</span>
                    <span className="font-bold text-white">{selectedPlan?.duration}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm">
                    <span className="text-slate-400">Full Name</span>
                    <span className="font-bold text-white">{orderForm.fullName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Email</span>
                    <span className="font-bold text-white">{orderForm.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">WhatsApp</span>
                    <span className="font-bold text-white">{orderForm.whatsapp}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Canva Email</span>
                    <span className="font-bold text-white">{orderForm.canvaEmail}</span>
                  </div>
                  {orderForm.remarks && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Remarks</span>
                      <span className="font-bold text-white">{orderForm.remarks}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm">
                    <span className="text-slate-400">Reference</span>
                    <span className="font-bold text-white">{paymentForm.referenceNumber}</span>
                  </div>
                  {paymentForm.receiptFile && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Payment Slip</span>
                      <span className="font-bold text-white">{paymentForm.receiptFile.name}</span>
                    </div>
                  )}
                </div>

                {message && (
                  <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {message}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep("payment")}
                    className="flex-1 rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    BACK
                  </button>
                  <button
                    onClick={cancelOrder}
                    className="z-10 flex-1 cursor-pointer pointer-events-auto rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleOrderSubmit}
                    disabled={loading}
                    className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-bold text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-60"
                  >
                    {loading ? "SUBMITTING..." : "SUBMIT ORDER"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRIAL FORM */}
        {step === "trial" && !discardConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-2xl animate-in zoom-in duration-300">
              <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-2xl relative">
                {/* Close Button */}
                <button
                  onClick={cancelOrder}
                  className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  ✕
                </button>

                <h2 className="mb-2 text-3xl font-black text-white">✨ 3 DAYS FREE TRIAL</h2>
                <p className="mb-6 text-slate-400">No payment required. Trial starts immediately.</p>

                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={trialForm.fullName}
                    onChange={(e) => setTrialForm({ ...trialForm, fullName: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none backdrop-blur-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={trialForm.email}
                    onChange={(e) => setTrialForm({ ...trialForm, email: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none backdrop-blur-sm"
                  />
                  <input
                    type="tel"
                    placeholder="WhatsApp Number"
                    value={trialForm.whatsapp}
                    onChange={(e) => setTrialForm({ ...trialForm, whatsapp: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none backdrop-blur-sm"
                  />
                  <input
                    type="email"
                    placeholder="Canva Email Account"
                    value={trialForm.canvaEmail}
                    onChange={(e) => setTrialForm({ ...trialForm, canvaEmail: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none backdrop-blur-sm"
                  />
                </div>

                {message && (
                  <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {message}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={cancelOrder}
                    className="z-10 flex-1 cursor-pointer pointer-events-auto rounded-full border-2 border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleTrialSubmit}
                    disabled={loading}
                    className="flex-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-6 py-3 font-bold text-slate-900 shadow-lg hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-60"
                  >
                    {loading ? "ACTIVATING..." : "SUBMIT →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-white/10 bg-gradient-to-b from-slate-900/50 to-black/80 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 md:px-8 lg:px-12 py-12 md:py-16">
            {/* Main Footer Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">MI CORTEX X INC.</h3>
                <p className="text-sm text-slate-400">Professional digital services by MI CORTEX X.</p>
              </div>

              {/* Quick Links */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Quick Links</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">• Home</a></li>
                  <li><a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">• Plans</a></li>
                  <li><a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">• Free Trial</a></li>
                  <li><a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">• Contact</a></li>
                </ul>
              </div>

              {/* Support */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Support</h4>
                <a
                  href="https://wa.me/94756390621"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-green-400 transition-colors"
                >
                  <span>📱</span>
                  <span className="text-sm">WhatsApp: 0756390621</span>
                </a>
              </div>

              {/* Legal */}
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Legal</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">• Terms & Conditions</a></li>
                  <li><a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">• Privacy Policy</a></li>
                  <li><button type="button" onClick={() => setShowRefundModal(true)} className="text-left text-slate-400 hover:text-cyan-400 transition-colors">• Refund Policy</button></li>
                </ul>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6"></div>

            {/* Bottom Footer */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 text-center md:text-left">© 2026 MI CORTEX X INC. All Rights Reserved.</p>
              <p className="text-xs font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">All Rights Reserved by MI CORTEX X</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
