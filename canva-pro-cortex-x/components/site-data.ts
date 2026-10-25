export type Language = "en";
export type ThemeMode = "dark" | "light";

export type Plan = {
  id: string;
  name: string;
  price: number;
  duration: string;
  badge?: string;
  features: string[];
  popular?: boolean;
  available?: boolean;
};

export type OrderStatus =
  | "Pending"
  | "Payment Verification"
  | "Approved"
  | "Processing"
  | "Completed"
  | "Rejected"
  | "Cancelled"
  | "Expired";

export type Order = {
  id: string;
  customerName: string;
  email: string;
  whatsapp: string;
  canvaEmail: string;
  planId: string;
  planName: string;
  amount: number;
  orderDate: string;
  paymentStatus: "Pending" | "Approved" | "Rejected";
  status: OrderStatus;
  transactionId: string;
  paymentMethod?: string;
  paymentReference?: string;
  receiptName?: string;
  receiptFilename?: string;
  receiptPath?: string;
  storageKey?: string;
  notes?: string;
  adminReason?: string;
  expiryDate: string;
  createdAt?: string;
};

export type BankSettings = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  paymentInstructions: string;
};

export const plans: Plan[] = [
  {
    id: "weekly",
    name: "Weekly",
    price: 200,
    duration: "For 7 Days",
    features: [
      "Premium design resources",
      "Premium templates",
      "Advanced design tools",
      "AI-related design features",
      "Additional premium resources",
    ],
    available: true,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: 500,
    duration: "For 30 Days",
    badge: "MOST POPULAR",
    popular: true,
    features: [
      "Premium design resources",
      "Premium templates",
      "Advanced design tools",
      "AI-related design features",
      "Additional premium resources",
    ],
    available: true,
  },
  {
    id: "annually",
    name: "Yearly",
    price: 2000,
    duration: "For 1 Year",
    badge: "BEST VALUE",
    features: [
      "Premium design resources",
      "Premium templates",
      "Advanced design tools",
      "AI-related design features",
      "Additional premium resources",
    ],
    available: true,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: 5000,
    duration: "Lifetime Access",
    badge: "PREMIUM",
    features: [
      "Premium design resources",
      "Premium templates",
      "Advanced design tools",
      "AI-related design features",
      "Additional premium resources",
    ],
    available: true,
  },
];

export const defaultBankSettings: BankSettings = {
  bankName: "[BANK NAME]",
  accountName: "[ACCOUNT NAME]",
  accountNumber: "[ACCOUNT NUMBER]",
  branch: "[BRANCH]",
  paymentInstructions:
    "1. Transfer the required amount.\n2. Keep the payment receipt.\n3. Enter the transaction ID.\n4. Upload the payment receipt.\n5. Submit the order.",
};

export const defaultOrders: Order[] = [
  {
    id: "MCX-1001",
    customerName: "Demo Customer",
    email: "customer@example.com",
    whatsapp: "0771234567",
    canvaEmail: "customer@canva.com",
    planId: "monthly",
    planName: "Monthly",
    amount: 600,
    orderDate: "2026-08-29",
    paymentStatus: "Pending",
    status: "Payment Verification",
    transactionId: "TXN-20260829-1001",
    receiptName: "receipt-1.png",
    notes: "Payment sent from personal account.",
    expiryDate: "2026-09-28",
  },
];

export const defaultAppState = {
  language: "en" as Language,
  theme: "dark" as ThemeMode,
  user: null as
    | { name: string; email: string; role: "customer" | "admin"; whatsapp: string; canvaEmail: string }
    | null,
  orders: defaultOrders,
  plans,
  bankSettings: defaultBankSettings,
};

export const translations = {
  en: {
    nav: {
      home: "Home",
      plans: "Plans",
      orders: "My Orders",
      support: "Support",
      account: "Account",
      logout: "Logout",
      login: "Login",
      signup: "Get Started",
      admin: "Admin",
      language: "English",
      theme: "Dark / Light",
    },
    hero: {
      eyebrow: "Premium digital access",
      headline: "Create More. Design Better.",
      subheading: "Choose the plan that fits your needs.",
      ctaPrimary: "BUY NOW",
      ctaSecondary: "VIEW PLANS",
    },
    pricing: {
      title: "Flexible access plans",
      weekly: "Weekly",
      monthly: "Monthly",
      annually: "Annually",
      lifetime: "Lifetime",
      viewFeatures: "View Features",
      buyNow: "BUY NOW",
      popular: "POPULAR",
      bestValue: "BEST VALUE",
      oneTime: "ONE-TIME PAYMENT",
    },
    dashboard: {
      welcome: "Welcome,",
      activePlan: "Active Plan",
      orderStatus: "Order Status",
      paymentStatus: "Payment Status",
      expiryDate: "Expiry Date",
      buyNow: "Buy Now",
      myOrders: "My Orders",
      support: "Support",
      profile: "Profile",
    },
    forms: {
      fullName: "Full Name",
      whatsapp: "WhatsApp Number",
      email: "Email",
      canvaEmail: "Canva Account Email",
      notes: "Additional Notes",
      transactionId: "Transaction ID",
      receipt: "Payment Receipt",
      submitOrder: "SUBMIT ORDER",
      paymentInstructions: "Payment Instructions",
      bankTransfer: "Bank Transfer",
      orderSubmitted: "Order Submitted Successfully",
      paymentPending: "Payment Verification Pending",
      receiptReceived: "Your payment receipt has been received. Our team will verify your payment and process your order.",
    },
    support: {
      title: "Support",
      subject: "Subject",
      orderId: "Order ID",
      message: "Message",
      attachment: "Optional attachment",
      send: "Send Ticket",
    },
    common: {
      noOrders: "No Orders Yet",
      noOrdersMessage: "You haven't placed any orders yet.",
      viewMyOrder: "VIEW MY ORDER",
      contactSupport: "CONTACT SUPPORT",
      orderId: "Order ID",
      plan: "Plan",
      amount: "Amount",
      date: "Date",
      status: "Status",
      expiryDate: "Expiry Date",
      paymentVerification: "Payment Verification Pending",
      bankDetails: "Bank Details",
      search: "Search",
      rejectReason: "Reason",
      confirm: "Confirm",
      loading: "Loading...",
      submitting: "Submitting Order...",
      uploading: "Uploading Receipt...",
      admin: "Admin",
    },
  },
};
