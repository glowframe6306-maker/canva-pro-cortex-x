# Plan Expiry System — Complete Example Walkthrough

## 🎯 Example: Monthly Plan from Start to Expiration

This example shows a complete workflow for a customer purchasing a MONTHLY plan, from order submission through expiration.

---

## Day 1: August 30, 2026 — Customer Orders

### 1️⃣ Customer submits order form

**Time**: 13:45:00 (Asia/Colombo timezone)

**Form data**:
```
Full Name: Jane Smith
Email: jane@example.com
WhatsApp: +94712345678
Canva Email: jane@canva.com
Selected Plan: MONTHLY
Price: 500
Payment Method: Bank Transfer
Reference Number: REF-20260830-001
Receipt: [payment slip image]
Additional Notes: Photography business
```

### 2️⃣ Backend processes order

**API Call**: `POST /api/orders`

**What happens**:
```
✓ Generate Order ID: MI-20260830-0001
✓ Validate all fields
✓ Store receipt file
✓ Create order in database with status: PENDING
✓ Send Telegram message to admin
```

**Database entry**:
```json
{
  "orderId": "MI-20260830-0001",
  "customerName": "Jane Smith",
  "customerEmail": "jane@example.com",
  "canvaEmail": "jane@canva.com",
  "customerPhone": "+94712345678",
  "selectedPlan": "MONTHLY",
  "planPrice": "500",
  "paymentMethod": "Bank Transfer",
  "paymentDetails": "REF-20260830-001",
  "status": "PENDING",
  "orderCreatedAt": "2026-08-30T08:15:00.000Z",
  "receiptFilename": "MI-20260830-0001.jpg"
}
```

### 3️⃣ Telegram notification to admin

**Message**:
```
🚀 NEW CANVA PRO ORDER

🧾 Order Number: MI-20260830-0001
💎 Plan: MONTHLY
💰 Price: 500
⏱ Duration: 30 Days

👤 Full Name: Jane Smith
📧 Email: jane@example.com
📱 WhatsApp: +94712345678
🎨 Canva Email: jane@canva.com

🧾 Reference Number: REF-20260830-001
📎 Payment Slip: MI-20260830-0001.jpg

📅 Date: 2026-08-30
⏲️ Time: 13:45:00

📦 Status: NEW ORDER
📝 Remarks: Photography business
```

✅ **Admin sees the order and verifies payment**

---

## Day 1: August 30, 2026 — Admin Activates Order

### 4️⃣ Admin activates order

**Time**: 14:00:00 (After verifying payment and setting up Canva access)

**API Call**: `POST /api/orders/activate`

```javascript
fetch('/api/orders/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: 'MI-20260830-0001'
  })
})
```

### 5️⃣ Backend calculates expiry

**What happens**:
```
✓ Get current time: 2026-08-30 14:00:00
✓ Get plan type: MONTHLY → 30 days
✓ Calculate expiry: 2026-08-30 + 30 days = 2026-09-29 14:00:00
✓ Format for timezone (Asia/Colombo):
  - Activation Date: 2026-08-30
  - Activation Time: 14:00:00
  - Expiry Date: 2026-09-29
  - Expiry Time: 14:00:00
✓ Update order status to ACTIVE
✓ Store all dates in database
```

**Updated database entry**:
```json
{
  "orderId": "MI-20260830-0001",
  "customerName": "Jane Smith",
  "customerEmail": "jane@example.com",
  "canvaEmail": "jane@canva.com",
  "customerPhone": "+94712345678",
  "selectedPlan": "MONTHLY",
  "planPrice": "500",
  "paymentMethod": "Bank Transfer",
  "paymentDetails": "REF-20260830-001",
  "status": "ACTIVE",                          // ← Changed!
  "orderCreatedAt": "2026-08-30T08:15:00.000Z",
  "activatedAt": "2026-08-30T08:30:00.000Z",  // ← NEW
  "activationDate": "2026-08-30",             // ← NEW
  "activationTime": "14:00:00",               // ← NEW
  "expiryAt": "2026-09-29T08:30:00.000Z",     // ← NEW (ISO)
  "expiryDate": "2026-09-29",                 // ← NEW (formatted)
  "expiryTime": "14:00:00",                   // ← NEW (formatted)
  "durationDays": 30,                         // ← NEW
  "status": "ACTIVE",                         // ← Changed!
  "receiptFilename": "MI-20260830-0001.jpg"
}
```

### 6️⃣ Telegram activation notification

**Message to admin**:
```
✅ CANVA PRO ACTIVATED

🧾 Order Number: MI-20260830-0001
👤 Customer: Jane Smith
🎨 Canva Email: jane@canva.com

💎 Plan: MONTHLY
⏱️ Duration: 30 Days

📅 Start Date: 2026-08-30
⏲️ Start Time: 14:00:00
📅 Expiry Date: 2026-09-29
⏲️ Expiry Time: 14:00:00

📦 Status: ACTIVE
```

✅ **Customer's Canva access is now active!**
✅ **Admin knows exactly when plan expires**

---

## Days 2-28: August 31 - September 28, 2026

### Background Service Running

**Every 5 minutes**:
```
[Expiration Checker] Running check...
  - Found 1 ACTIVE order with expiryAt set
  - Order MI-20260830-0001: Expiry 2026-09-29 14:00:00
  - Current time: 2026-09-05 09:30:00
  - Not yet expired (24 days remaining)
  - Check complete
```

✅ **Plan is active and working normally**
✅ **System continuously monitoring for expiry**

---

## Day 30: September 29, 2026 — Plan Expires

### 7️⃣ Expiration time reached

**Time**: 14:00:00 (exactly 30 days after activation)

**Expiration Checker runs** (every 5 minutes):
```
[Expiration Checker] Running check...
  - Found 1 ACTIVE order: MI-20260830-0001
  - Current time: 2026-09-29 14:00:00
  - Expiry time: 2026-09-29 14:00:00
  - STATUS: EXPIRED ✓ (current time >= expiry time)
  - Sending expiration notification...
```

### 8️⃣ Backend marks order as expired

**What happens**:
```
✓ Fetch Telegram chat (no login needed, just API call)
✓ Send expiration message
✓ Update order in database:
  - status = EXPIRED
  - expirationNotificationSent = true
  - expirationNotificationSentAt = 2026-09-29 14:00:00
✓ Continue running in background (prevent duplicates)
```

**Final database entry**:
```json
{
  "orderId": "MI-20260830-0001",
  "customerName": "Jane Smith",
  "customerEmail": "jane@example.com",
  "canvaEmail": "jane@canva.com",
  "customerPhone": "+94712345678",
  "selectedPlan": "MONTHLY",
  "planPrice": "500",
  "paymentMethod": "Bank Transfer",
  "paymentDetails": "REF-20260830-001",
  "status": "EXPIRED",                              // ← Changed!
  "orderCreatedAt": "2026-08-30T08:15:00.000Z",
  "activatedAt": "2026-08-30T08:30:00.000Z",
  "activationDate": "2026-08-30",
  "activationTime": "14:00:00",
  "expiryAt": "2026-09-29T08:30:00.000Z",
  "expiryDate": "2026-09-29",
  "expiryTime": "14:00:00",
  "durationDays": 30,
  "expirationNotificationSent": true,              // ← NEW
  "expirationNotificationSentAt": "2026-09-29T08:30:00.000Z",  // ← NEW
  "receiptFilename": "MI-20260830-0001.jpg"
}
```

### 9️⃣ Telegram expiration notification

**Message to admin** (automatically sent):
```
⏰ CANVA PRO PLAN EXPIRED

🧾 Order Number: MI-20260830-0001
👤 Customer: Jane Smith
🎨 Canva Email: jane@canva.com

💎 Plan: MONTHLY
⏱️ Duration: 30 Days

📅 Start Date: 2026-08-30
⏲️ Start Time: 14:00:00
📅 Expiry Date: 2026-09-29
⏲️ Expiry Time: 14:00:00

📦 Status: EXPIRED

📝 Message: The customer's Canva Pro plan period has ended.
```

✅ **Admin automatically notified of expiration**
✅ **Exact date/time shown for records**
✅ **No manual intervention needed**

---

## Day 30+: September 29 Onwards

### Background Check Continues

**Every 5 minutes after expiration**:
```
[Expiration Checker] Running check...
  - Found 1 EXPIRED order: MI-20260830-0001
  - expirationNotificationSent = true
  - Skipping (already notified)
  - Check complete
```

✅ **Prevents duplicate notifications**
✅ **Still works even if admin offline**

---

## 📊 Complete Timeline Summary

```
2026-08-30 13:45:00 — Customer submits order
                       Status: PENDING
                       ↓
2026-08-30 14:00:00 — Admin activates order
                       Status: ACTIVE
                       Expiry set: 2026-09-29 14:00:00
                       ↓
2026-08-31 to 2026-09-28 — Plan active (28 days)
                       Background checks running
                       No action needed
                       ↓
2026-09-29 13:59:00 — Background check (not yet expired)
                       ↓
2026-09-29 14:00:00 — EXPIRATION TIME REACHED
                       Background check triggers
                       Status: EXPIRED
                       Telegram notification sent
                       ↓
2026-09-29 14:05:00+ — Continued checks (no duplicates)
                        Status remains: EXPIRED
                        Notification already sent
```

---

## 🔑 Key Points

### Order Status Flow
```
PENDING → ACTIVE → EXPIRED
  ↓         ↓        ↓
Submitted  Plan     Plan
           Running  Ended
```

### Dates Stored (All in app timezone)
| Field | Value | Format |
|-------|-------|--------|
| Order Date | 2026-08-30 | YYYY-MM-DD |
| Order Time | 13:45:00 | HH:mm:ss |
| Activation Date | 2026-08-30 | YYYY-MM-DD |
| Activation Time | 14:00:00 | HH:mm:ss |
| Expiry Date | 2026-09-29 | YYYY-MM-DD |
| Expiry Time | 14:00:00 | HH:mm:ss |

### Telegram Messages
| Event | Message Type | Auto? |
|-------|--------------|-------|
| New Order | NEW ORDER | Immediate |
| Activation | CANVA PRO ACTIVATED | When activated |
| Expiration | CANVA PRO PLAN EXPIRED | Automatic at expiry time |

---

## 🎨 Alternative: LIFETIME Plan

If Jane had chosen LIFETIME instead:

```json
{
  "orderId": "MI-20260830-0001",
  "selectedPlan": "LIFETIME",
  "status": "ACTIVE",
  "activationDate": "2026-08-30",
  "activationTime": "14:00:00",
  "expiryDate": "NEVER",        // ← Special value
  "expiryTime": "NEVER",        // ← Special value
  "durationDays": 0
  // NO expiryAt - no expiration time to check
  // NO expiration notification will EVER be sent
}
```

Telegram message shows:
```
💎 Plan: LIFETIME
⏱️ Duration: Lifetime
📅 Expiry: NEVER
```

---

## 🎬 Admin Dashboard View

### All Orders
```bash
GET /api/admin/orders
→ Returns: All orders with their current status
```

### Pending Orders (Need Activation)
```bash
GET /api/admin/orders?status=PENDING
→ Jane's order: Not yet visible here (it's already ACTIVE)
```

### Active Orders (Customers with access)
```bash
GET /api/admin/orders?status=ACTIVE
→ Jane's order: MI-20260830-0001, Expires 2026-09-29 14:00:00
```

### Expired Orders (Plan ended)
```bash
GET /api/admin/orders?status=EXPIRED
→ Jane's order: MI-20260830-0001, Expired on 2026-09-29 14:00:00
```

---

## ✨ Key Features Demonstrated

✅ **Automatic activation** — Admin activates, system calculates expiry
✅ **Exact date/time** — Shows when access starts and ends (not ISO)
✅ **Background monitoring** — Checks automatically every 5 minutes
✅ **Telegram notifications** — Automatically sent at expiry time
✅ **No manual intervention** — Works even if no one is online
✅ **Duplicate prevention** — Won't send same message twice
✅ **Complete records** — All dates tracked for audit trail
✅ **Timezone aware** — Consistent timezone throughout system

---

## 🚀 Ready to Deploy!

This system is production-ready and will:
- ✅ Track every order from creation to expiration
- ✅ Send clear Telegram messages with exact dates/times
- ✅ Automatically expire plans at the right moment
- ✅ Prevent duplicate notifications
- ✅ Work 24/7 without admin intervention
- ✅ Support all plan types (WEEKLY, MONTHLY, ANNUALLY, LIFETIME)
