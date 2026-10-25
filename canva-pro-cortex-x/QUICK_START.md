# Plan Expiry System — Quick Start Guide

## 🚀 Getting Started

### 1. Environment Setup

Add to your `.env.local`:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TZ=Asia/Colombo

# Optional (for security)
ADMIN_API_KEY=your_admin_secret_key
EXPIRATION_CHECK_TOKEN=your_expiration_secret_key
```

### 2. Start the App

```bash
npm run dev
```

**✅ Expiration checker automatically starts!**
- Checks for expired orders every 5 minutes
- Runs in the background
- No configuration needed

---

## 📋 Basic Workflow

### Step 1: Customer Orders
Customer fills form → Submits order → Order status: **PENDING**

Telegram receives: **NEW ORDER** message

### Step 2: Admin Activates
Admin receives order → Prepares Canva access → Activates order

```bash
curl -X POST http://localhost:3000/api/orders/activate \
  -H "Content-Type: application/json" \
  -d '{"orderId": "MI-20260830-0001"}'
```

Order status changes to: **ACTIVE**

Telegram receives: **ACTIVATION** message with expiry date/time

### Step 3: Automatic Expiration
When expiry date/time arrives → Checker sends notification

Telegram receives: **EXPIRATION** message

---

## 🎯 Common Tasks

### View All Pending Orders (Need Activation)

```bash
curl "http://localhost:3000/api/admin/orders?status=PENDING" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### View All Active Orders

```bash
curl "http://localhost:3000/api/admin/orders?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### Manually Trigger Expiration Check

```bash
curl "http://localhost:3000/api/orders/check-expiration?token=YOUR_EXPIRATION_CHECK_TOKEN"
```

### Get Specific Order Details

```bash
curl "http://localhost:3000/api/admin/orders?orderId=MI-20260830-0001" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

---

## 📊 Order Statuses

| Status | Meaning | Next Action |
|--------|---------|------------|
| **PENDING** | Order submitted, awaiting activation | Admin activates when Canva access is ready |
| **ACTIVE** | Canva access activated, plan running | Wait for expiry date or customer cancellation |
| **EXPIRED** | Plan period ended | Notify customer, offer renewal |

---

## 📅 Plan Durations

| Plan | Duration | Example |
|------|----------|---------|
| WEEKLY | 7 days | Mon 13:53 → Next Mon 13:53 |
| MONTHLY | 30 days | Aug 30 → Sep 29 |
| ANNUALLY | 365 days | Aug 30 2026 → Aug 30 2027 |
| LIFETIME | Forever | Expires: NEVER |

---

## 💬 Telegram Messages

### When Order is Submitted (NEW ORDER)
```
🚀 NEW CANVA PRO ORDER

🧾 Order Number: MI-20260830-0001
💎 Plan: MONTHLY
💰 Price: 500

👤 Full Name: John Doe
📧 Email: john@example.com
🎨 Canva Email: john@canva.com

📦 Status: NEW ORDER
```

### When Order is Activated (ACTIVATION)
```
✅ CANVA PRO ACTIVATED

🧾 Order Number: MI-20260830-0001
💎 Plan: MONTHLY
⏱️ Duration: 30 Days

📅 Start Date: 2026-08-30
⏲️ Start Time: 13:53:12
📅 Expiry Date: 2026-09-29
⏲️ Expiry Time: 13:53:12

📦 Status: ACTIVE
```

### When Plan Expires (EXPIRATION)
```
⏰ CANVA PRO PLAN EXPIRED

🧾 Order Number: MI-20260830-0001
💎 Plan: MONTHLY

📅 Expiry Date: 2026-09-29
⏲️ Expiry Time: 13:53:12

📦 Status: EXPIRED
```

---

## 🔍 Checking System Status

### Is expiration checker running?

Look for logs:
```
[Expiration Checker] Started - checking every 5 minutes
```

### Did an order expire correctly?

Check logs:
```
[Expiration Checker] Sent expiration notification for order MI-20260830-0001
```

### Testing expiration manually

```bash
# Trigger immediate check
curl "http://localhost:3000/api/orders/check-expiration?token=YOUR_SECRET"

# View results
{
  "ok": true,
  "message": "Processed 2 expired orders",
  "ordersProcessed": 5,
  "ordersExpired": 2,
  "errors": []
}
```

---

## 🐛 Quick Troubleshooting

### Telegram messages not sending?
1. ✅ Check `TELEGRAM_BOT_TOKEN` is set
2. ✅ Check `TELEGRAM_CHAT_ID` is set
3. ✅ Check bot has access to chat
4. ✅ Try manually: `curl /api/orders/check-expiration?token=...`

### Expiration check not running?
1. ✅ Check app is running (`npm run dev`)
2. ✅ Check logs for `[Expiration Checker]` messages
3. ✅ Manually trigger: `curl /api/orders/check-expiration?token=...`

### Orders showing wrong status?
1. ✅ Check order ID exists: `/api/admin/orders?orderId=...`
2. ✅ Check activation time: `activatedAt` field
3. ✅ Check expiry calculation: `expiryDate` field

---

## 📱 For Frontend Integration

### After customer places order:
```javascript
const response = await fetch('/api/orders', { method: 'POST', body: formData });
const { orderId } = await response.json();
// Show: "Order received! Order #MI-20260830-0001"
// Wait for admin to activate (happens in Telegram chat)
```

### To show customer their plan status:
```javascript
const response = await fetch(`/api/admin/orders?orderId=${orderId}`, {
  headers: { 'Authorization': 'Bearer ...' }
});
const { orders: [order] } = await response.json();
// Show: Status, Expiry Date, Days Remaining
```

---

## 🚀 Deployment

### Vercel Deployment
1. Set environment variables in Vercel dashboard
2. Add `vercel.json` with cron configuration
3. Deploy: `vercel deploy`

### Other Platforms
1. Set environment variables
2. Call `/api/orders/check-expiration?token=...` from external cron every 5 minutes
3. Example: GitHub Actions, AWS CloudWatch, Google Cloud Scheduler

---

## 📚 Full Documentation

For complete details, see:
- **`PLAN_EXPIRY_GUIDE.md`** — Full implementation guide
- **`IMPLEMENTATION_SUMMARY.md`** — Technical summary

---

**Ready to use! 🎉**

Start the app and watch for `[Expiration Checker]` logs to confirm system is running.
