# Canva Pro Plan Expiry System — Implementation Guide

## Overview

This implementation adds automatic plan expiration tracking and notifications to the Canva Pro ordering system. It tracks when plans are activated, calculates expiry dates based on plan duration, and automatically sends Telegram notifications when plans expire.

## Key Features

✅ **Automatic Expiry Calculation** — Plans automatically calculate expiry based on duration (7 days, 30 days, 365 days, or lifetime)

✅ **Activation Time Tracking** — Records the exact date and time when Canva access is activated

✅ **Telegram Notifications** — Sends formatted Telegram messages showing plan duration, start date, and expiry date

✅ **Scheduled Expiration Checker** — Background service that periodically checks for expired plans and sends expiration notifications

✅ **Admin Dashboard API** — Endpoints to view order status, activation dates, and expiry dates

✅ **Backward Compatible** — Doesn't break existing order, trial, or payment systems

## New Files & Components

### Core Utilities

1. **`lib/expiry-calculator.ts`** — Expiry calculation and timezone utilities
   - `calculateExpiry()` — Calculate plan expiry date from activation time
   - `formatDateInTimezone()` — Format dates in app timezone
   - `getPlanDurationDisplay()` — Get human-readable plan duration
   - `hasExpired()` — Check if a plan has expired
   - `getDaysUntilExpiry()` — Get remaining days until expiry

2. **`lib/order-database.ts`** — Order persistence and querying
   - `saveOrder()` — Save a new order
   - `updateOrder()` — Update an existing order
   - `getOrderById()` — Retrieve order by ID
   - `getOrdersReadyForExpiration()` — Get expired orders awaiting notification
   - `markExpirationNotificationSent()` — Mark order as notified
   - Stores orders in `.orders.json` file in `PAYMENTS` directory

3. **`lib/telegram-messages.ts`** — Telegram message formatting
   - `buildPaidOrderActivationMessage()` — Format activation notification
   - `buildPaidOrderExpirationMessage()` — Format expiration notification
   - `buildTrialActivationMessage()` — Format trial notification
   - `escapeMarkdown()` — Escape markdown for Telegram MarkdownV2

4. **`lib/expiration-checker.ts`** — Automatic expiration checking
   - `checkAndNotifyExpiredOrders()` — Check for expired orders and send notifications
   - `startExpirationChecker()` — Start background interval checker
   - Can be called every 5-15 minutes

### API Endpoints

1. **`POST /api/orders`** (Updated)
   - Existing endpoint, now saves orders to database
   - Still sends "NEW ORDER" message when order is initially submitted
   - Order status starts as "PENDING"

2. **`POST /api/orders/activate`** (New)
   - Activates a paid order
   - Calculates expiry based on plan
   - Sends activation notification to Telegram
   - Changes order status to "ACTIVE"
   - Example:
     ```bash
     curl -X POST http://localhost:3000/api/orders/activate \
       -H "Content-Type: application/json" \
       -d '{"orderId": "MI-20260830-0001"}'
     ```

3. **`GET /api/orders/check-expiration`** (New)
   - Manually trigger expiration checking
   - Returns count of expired orders processed
   - Supports authentication token
   - Can be called by external cron services
   - Example:
     ```bash
     curl http://localhost:3000/api/orders/check-expiration?token=YOUR_SECRET
     ```

4. **`GET /api/admin/orders`** (New)
   - View all orders with status
   - Filter by status: `?status=PENDING|ACTIVE|EXPIRED`
   - View specific order: `?orderId=MI-20260830-0001`
   - Requires admin authentication
   - Response includes activation dates and expiry information

### Components

1. **`components/initialize-app.tsx`** (New)
   - Server component that starts background services
   - Initializes expiration checker on app startup
   - Checks for expired orders every 5 minutes

2. **`app/layout.tsx`** (Updated)
   - Now includes `<InitializeApp />` to start background services

## Plan Durations

| Plan     | Duration | Expiry Calculation |
|----------|----------|-------------------|
| WEEKLY   | 7 days   | Activation + 7 days |
| MONTHLY  | 30 days  | Activation + 30 days |
| ANNUALLY | 1 year   | Activation + 365 days |
| LIFETIME | Forever  | No expiry (NEVER) |

## Database Schema

Orders are stored in `PAYMENTS/.orders.json` with the following structure:

```typescript
{
  orderId: string;                    // e.g., "MI-20260830-0001"
  customerName: string;
  customerEmail: string;
  canvaEmail: string;
  customerPhone?: string;
  paymentMethod: "Free Trial" | "Bank Transfer" | "Other";
  selectedPlan: string;               // e.g., "WEEKLY", "MONTHLY"
  planPrice?: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED";

  // Activation tracking
  activatedAt?: string;               // ISO timestamp
  activationDate?: string;            // YYYY-MM-DD
  activationTime?: string;            // HH:mm:ss

  // Expiry tracking
  expiryAt?: string;                  // ISO timestamp
  expiryDate?: string;                // YYYY-MM-DD or "NEVER"
  expiryTime?: string;                // HH:mm:ss or "NEVER"
  durationDays?: number;

  // Notification tracking
  expirationNotificationSent?: boolean;
  expirationNotificationSentAt?: string;  // ISO timestamp

  orderCreatedAt: string;             // ISO timestamp
}
```

## Telegram Message Format

### Activation Message (NEW — with activation)
```
✅ CANVA PRO ACTIVATED

🧾 Order Number: MI-20260830-0001
👤 Customer: John Doe
🎨 Canva Email: john@canva.com

💎 Plan: MONTHLY
⏱️ Duration: 30 Days

📅 Start Date: 2026-08-30
⏲️ Start Time: 13:53:12
📅 Expiry Date: 2026-09-29
⏲️ Expiry Time: 13:53:12

📦 Status: ACTIVE
```

### Expiration Message (Automatic — when expiry date reached)
```
⏰ CANVA PRO PLAN EXPIRED

🧾 Order Number: MI-20260830-0001
👤 Customer: John Doe
🎨 Canva Email: john@canva.com

💎 Plan: MONTHLY
⏱️ Duration: 30 Days

📅 Start Date: 2026-08-30
⏲️ Start Time: 13:53:12
📅 Expiry Date: 2026-09-29
⏲️ Expiry Time: 13:53:12

📦 Status: EXPIRED

📝 Message: The customer's Canva Pro plan period has ended.
```

## Configuration

### Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TZ=Asia/Colombo  # Your application timezone

# Optional
ADMIN_API_KEY=your_admin_api_key_here
EXPIRATION_CHECK_TOKEN=your_secret_token_here
ORDERS_DIR=path/to/orders/directory
```

## Usage Workflow

### 1. Customer Submits Order
```bash
POST /api/orders
{
  customerName: "John Doe",
  customerEmail: "john@example.com",
  canvaEmail: "john@canva.com",
  customerPhone: "+94123456789",
  selectedPlan: "MONTHLY",
  planPrice: "500",
  paymentMethod: "Bank Transfer",
  paymentDetails: "REF-123456",
  receipt: [File object]
}

Response:
{
  ok: true,
  orderId: "MI-20260830-0001",
  message: "Order submitted successfully."
}

Telegram: Sends "NEW ORDER" message
Order Status: PENDING
```

### 2. Admin Activates Order (When Canva Access is Ready)
```bash
POST /api/orders/activate
{
  orderId: "MI-20260830-0001"
}

Response:
{
  ok: true,
  orderId: "MI-20260830-0001",
  message: "Order activated successfully.",
  activationDate: "2026-08-30",
  activationTime: "13:53:12",
  expiryDate: "2026-09-29",
  expiryTime: "13:53:12",
  durationDays: 30
}

Telegram: Sends activation message with exact expiry date/time
Order Status: ACTIVE
```

### 3. Automatic Expiration Checking (Every 5 minutes)
```
Check all ACTIVE orders where expiryAt <= now
For each expired order:
  - Send expiration notification to Telegram
  - Mark expirationNotificationSent = true
  - Change status to EXPIRED

Cron: GET /api/orders/check-expiration?token=SECRET
```

## Deployment Instructions

### Local Development

The expiration checker starts automatically when the app starts. Orders are checked every 5 minutes.

```bash
npm run dev
# App will start checking for expired orders immediately
```

### Vercel Deployment

1. Set environment variables in Vercel:
   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   TZ=Asia/Colombo
   EXPIRATION_CHECK_TOKEN=...
   ```

2. Add `vercel.json` to project root:
   ```json
   {
     "crons": [{
       "path": "/api/orders/check-expiration",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

   This calls the endpoint every 5 minutes to check for expired orders.

3. Deploy:
   ```bash
   vercel deploy
   ```

### Manual Cron Job (External Service)

For any deployment platform, you can call the expiration checker manually:

```bash
# Using cron (Linux/Mac)
*/5 * * * * curl -s "https://yourdomain.com/api/orders/check-expiration?token=YOUR_SECRET" >> /var/log/canva-expiration.log 2>&1
```

Or using a cron service like:
- GitHub Actions (scheduled workflow)
- AWS CloudWatch Events
- Google Cloud Scheduler
- External services like EasyCron or RemoteCron

## Admin Dashboard Usage

### View All Pending Orders (Need Activation)
```bash
curl "http://localhost:3000/api/admin/orders?status=PENDING" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### View All Active Orders (Currently Subscribed)
```bash
curl "http://localhost:3000/api/admin/orders?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### View All Expired Orders
```bash
curl "http://localhost:3000/api/admin/orders?status=EXPIRED" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### View Specific Order
```bash
curl "http://localhost:3000/api/admin/orders?orderId=MI-20260830-0001" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

## Timezone Configuration

All dates and times are stored and displayed in the configured timezone (default: `Asia/Colombo`).

To change timezone, set the `TZ` environment variable:
```bash
TZ=America/New_York
TZ=Europe/London
TZ=UTC
```

Timezone is applied to:
- Activation dates and times
- Expiry dates and times
- Telegram notifications
- Admin dashboard

## Database Backup

Orders are stored in JSON file: `PAYMENTS/.orders.json`

Backup regularly:
```bash
cp PAYMENTS/.orders.json PAYMENTS/.orders.json.backup
```

## Troubleshooting

### Expiration notifications not sending
1. Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set
2. Check Telegram bot has access to chat
3. Review logs: Look for "[Expiration Checker]" messages
4. Manually trigger check: `GET /api/orders/check-expiration?token=...`

### Orders not showing in admin dashboard
1. Check `ADMIN_API_KEY` matches in Authorization header
2. Verify `PAYMENTS/.orders.json` file exists and has proper permissions
3. Check file is valid JSON

### Expiry dates seem incorrect
1. Verify `TZ` environment variable matches your timezone
2. Check system clock is correct
3. Verify activation time was set correctly via `/api/orders/activate`

## Testing

### Test Activation
```javascript
// In browser console
fetch('/api/orders/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId: 'MI-20260830-0001' })
})
.then(r => r.json())
.then(d => console.log(d))
```

### Test Expiration Check
```javascript
// In browser console
fetch('/api/orders/check-expiration?token=YOUR_SECRET')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Test Admin Orders API
```javascript
// In browser console
fetch('/api/admin/orders?status=PENDING', {
  headers: { 'Authorization': 'Bearer YOUR_ADMIN_KEY' }
})
.then(r => r.json())
.then(d => console.log(d))
```

## Performance Notes

- **Order Database**: JSON file stored locally, suitable for <100,000 orders
- **Expiration Checker**: Runs every 5 minutes, typically completes in <1 second
- **Telegram API**: Each notification takes ~0.5-1 second
- **Scalability**: For >100k orders, consider migrating to a database (PostgreSQL, MongoDB, etc.)

## Future Enhancements

1. Migrate to SQL database for better scalability
2. Add order analytics dashboard
3. Add automatic renewal reminders (7 days before expiry)
4. Add customer portal to view plan status
5. Support multiple payment methods and refunds
6. Add usage tracking and plan downgrade options
