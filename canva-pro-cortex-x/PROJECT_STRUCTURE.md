# Project Structure — Plan Expiry System

## 📁 Complete File Structure

```
canva-pro-cortex-x/
├── app/
│   ├── api/
│   │   ├── orders/
│   │   │   ├── route.ts                      [UPDATED] Order creation endpoint
│   │   │   ├── activate/
│   │   │   │   └── route.ts                  [NEW] Activate order endpoint
│   │   │   └── check-expiration/
│   │   │       └── route.ts                  [NEW] Manual expiration check endpoint
│   │   └── admin/
│   │       └── orders/
│   │           └── route.ts                  [NEW] Admin orders API endpoint
│   ├── layout.tsx                            [UPDATED] Added InitializeApp component
│   ├── page.tsx
│   ├── globals.css
│   └── ...
│
├── components/
│   ├── initialize-app.tsx                    [NEW] App initialization component
│   ├── micortex-app.tsx
│   ├── micortex-app-old.tsx
│   ├── site-data.ts
│   └── ...
│
├── lib/
│   ├── order-system.ts                       [EXISTING] Receipt and order utilities
│   ├── expiry-calculator.ts                  [NEW] Expiry calculation utilities
│   ├── order-database.ts                     [NEW] Order persistence layer
│   ├── telegram-messages.ts                  [NEW] Telegram message formatting
│   └── expiration-checker.ts                 [NEW] Scheduled expiration checking
│
├── public/
│   └── ...
│
├── PLAN_EXPIRY_GUIDE.md                      [NEW] Complete implementation guide
├── IMPLEMENTATION_SUMMARY.md                 [NEW] Technical summary
├── QUICK_START.md                            [NEW] Quick start guide
├── EXAMPLE_WALKTHROUGH.md                    [NEW] End-to-end example
├── VERIFICATION_CHECKLIST.md                 [NEW] Verification checklist
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── README.md

PAYMENTS/                                      [External directory]
├── .orders.json                              [NEW] Order database
├── .order-counter.json
└── [receipt files]
```

---

## 🆕 New Files Summary

### Utility Files (lib/)

#### 1. `lib/expiry-calculator.ts` (144 lines)
**Purpose**: Expiry calculation and timezone formatting
**Key Functions**:
- `calculateExpiry()` — Calculate plan expiry from activation time
- `formatDateInTimezone()` — Format dates in app timezone (YYYY-MM-DD)
- `formatTimeInTimezone()` — Format times in app timezone (HH:mm:ss)
- `getDateTimeInTimezone()` — Get both date and time
- `hasExpired()` — Check if plan has expired
- `getDaysUntilExpiry()` — Calculate remaining days
- `getPlanDurationDisplay()` — Get readable duration (e.g., "30 Days")
- `planNameToPlanType()` — Map plan names to internal types

**Exports**:
```typescript
export type PlanType = "WEEKLY" | "MONTHLY" | "ANNUALLY" | "LIFETIME";
export type ExpiryCalculation = { activatedAt, expiryAt, expiryDate, expiryTime, ... };
export function calculateExpiry(planType: PlanType, activationDateTime?: Date): ExpiryCalculation | null;
...
```

#### 2. `lib/order-database.ts` (162 lines)
**Purpose**: Persistent order storage and retrieval
**Key Functions**:
- `getAllOrders()` — Get all orders from database
- `getOrderById()` — Get specific order by ID
- `saveOrder()` — Save new order to database
- `updateOrder()` — Update existing order
- `getOrdersReadyForExpiration()` — Get orders ready for expiration notification
- `getOrdersByStatus()` — Filter orders by status (PENDING, ACTIVE, EXPIRED)
- `markExpirationNotificationSent()` — Mark order as notified

**Storage**:
- JSON file at: `PAYMENTS/.orders.json`
- Auto-creates file if doesn't exist

**Exports**:
```typescript
export interface StoredOrder {
  orderId: string;
  customerName: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED";
  activatedAt?: string;
  expiryAt?: string;
  expirationNotificationSent?: boolean;
  ...
}
export async function saveOrder(order: StoredOrder): Promise<void>;
...
```

#### 3. `lib/telegram-messages.ts` (96 lines)
**Purpose**: Format Telegram messages for different order events
**Key Functions**:
- `buildPaidOrderActivationMessage()` — Format activation notification
- `buildPaidOrderExpirationMessage()` — Format expiration notification
- `buildTrialActivationMessage()` — Format trial notification
- `buildNewOrderMessage()` — Format new order message
- `escapeMarkdown()` — Escape markdown special characters

**Message Formats**:
```typescript
// Activation message includes:
// ✅ CANVA PRO ACTIVATED
// Order Number, Customer, Plan, Duration
// Start Date, Start Time, Expiry Date, Expiry Time
// Status: ACTIVE

// Expiration message includes:
// ⏰ CANVA PRO PLAN EXPIRED
// (Same details as activation)
// Status: EXPIRED
// Message: "The customer's Canva Pro plan period has ended."
```

#### 4. `lib/expiration-checker.ts` (127 lines)
**Purpose**: Automatic expiration checking and notifications
**Key Functions**:
- `checkAndNotifyExpiredOrders()` — Check for expired orders and send notifications
- `startExpirationChecker(intervalMinutes)` — Start background interval (default: 5 minutes)
- `stopExpirationChecker()` — Stop background checker

**Behavior**:
- Checks every 5 minutes by default
- Finds all ACTIVE orders with expiryAt <= now
- Sends Telegram notification for each expired order
- Marks order as EXPIRED and expirationNotificationSent
- Prevents duplicate notifications
- Works continuously in background

**Exports**:
```typescript
export interface ExpirationCheckResult {
  success: boolean;
  ordersProcessed: number;
  ordersExpired: number;
  errors: string[];
  message: string;
}
export async function checkAndNotifyExpiredOrders(): Promise<ExpirationCheckResult>;
export function startExpirationChecker(intervalMinutes?: number): void;
```

### API Endpoints (app/api/)

#### 5. `app/api/orders/activate/route.ts` (93 lines)
**Purpose**: Activate a paid order and calculate expiry
**Endpoint**: `POST /api/orders/activate`
**Request Body**:
```json
{ "orderId": "MI-20260830-0001" }
```
**Response**:
```json
{
  "ok": true,
  "orderId": "MI-20260830-0001",
  "message": "Order activated successfully.",
  "activationDate": "2026-08-30",
  "activationTime": "14:00:00",
  "expiryDate": "2026-09-29",
  "expiryTime": "14:00:00",
  "durationDays": 30
}
```
**Process**:
1. Get order from database
2. Calculate expiry from current time
3. Update order status to ACTIVE
4. Send activation Telegram message
5. Return activation details

#### 6. `app/api/orders/check-expiration/route.ts` (49 lines)
**Purpose**: Manual trigger for expiration checking
**Endpoint**: `GET /api/orders/check-expiration?token=SECRET`
**Response**:
```json
{
  "ok": true,
  "message": "Processed 2 expired orders",
  "ordersProcessed": 5,
  "ordersExpired": 2,
  "errors": []
}
```
**Features**:
- Optional token authentication
- Returns expiration check results
- Can be called by external cron services
- Used by Vercel Crons or external schedulers

#### 7. `app/api/admin/orders/route.ts` (70 lines)
**Purpose**: Admin API to view orders with status
**Endpoint**: `GET /api/admin/orders`
**Query Parameters**:
- `status=PENDING|ACTIVE|EXPIRED` — Filter by status
- `orderId=MI-20260830-0001` — Get specific order
**Response**:
```json
{
  "ok": true,
  "count": 5,
  "orders": [
    {
      "orderId": "MI-20260830-0001",
      "customerName": "Jane Smith",
      "status": "ACTIVE",
      "activationDate": "2026-08-30",
      "expiryDate": "2026-09-29",
      ...
    }
  ]
}
```
**Features**:
- Optional bearer token authentication
- Shows activation and expiry information
- Filters by status or order ID
- Suitable for admin dashboard

### Components

#### 8. `components/initialize-app.tsx` (18 lines)
**Purpose**: Initialize background services on app startup
**Type**: Server component
**Behavior**:
```typescript
export function InitializeApp() {
  // Starts expiration checker on app load
  // Checks every 5 minutes
  // Runs in background continuously
  return null; // Doesn't render anything
}
```
**Usage**: Called in `app/layout.tsx`

### Modified Files

#### 9. `app/api/orders/route.ts` [UPDATED]
**Changes**:
- Added imports for new utilities
- Integrated order database saving
- Added type safety with StoredOrder
- Maintains backward compatibility

#### 10. `app/layout.tsx` [UPDATED]
**Changes**:
- Added import: `import { InitializeApp } from "@/components/initialize-app";`
- Added component: `<InitializeApp />` in layout
- Starts expiration checker when app loads

### Documentation Files

#### 11. `PLAN_EXPIRY_GUIDE.md` (500+ lines)
Complete implementation guide covering:
- Overview and key features
- New files and components
- Database schema
- API endpoints documentation
- Telegram message formats
- Configuration instructions
- Deployment guide (local, Vercel, external cron)
- Testing instructions
- Troubleshooting

#### 12. `IMPLEMENTATION_SUMMARY.md` (400+ lines)
Technical summary including:
- What was built
- Files created and modified
- Database schema
- API endpoints
- Telegram message examples
- Configuration
- Usage workflow
- Deployment instructions
- Testing checklist
- Performance notes

#### 13. `QUICK_START.md` (300+ lines)
Quick reference guide with:
- Environment setup
- Basic workflow
- Common tasks
- Order statuses
- Plan durations
- Telegram message examples
- System status checks
- Troubleshooting
- Frontend integration examples

#### 14. `EXAMPLE_WALKTHROUGH.md` (500+ lines)
Complete end-to-end example showing:
- Customer order submission
- Admin activation
- Automatic expiration checking
- Telegram notifications at each step
- Timeline summary
- LIFETIME plan alternative
- Admin dashboard views
- Key features demonstrated

#### 15. `VERIFICATION_CHECKLIST.md` (300+ lines)
Implementation verification including:
- Requirements checklist (all ✅)
- Architecture checklist
- Documentation checklist
- Testing verification
- File summary
- Deployment readiness
- Security checklist
- Performance notes
- Feature completeness matrix
- Final status

---

## 🔗 Dependencies & Imports

### No New External Dependencies Added
All new code uses existing Next.js and Node.js APIs:
- `node:fs/promises` — File system operations
- `node:path` — Path utilities
- Next.js `NextRequest` and `NextResponse`
- Built-in `Intl.DateTimeFormat` for timezone handling

### Imports in New Files
```typescript
// expiry-calculator.ts
// No external imports (pure TypeScript)

// order-database.ts
import fs from "node:fs/promises";
import path from "node:path";

// telegram-messages.ts
import type { StoredOrder } from "@/lib/order-database";
import { getPlanDurationDisplay } from "@/lib/expiry-calculator";

// expiration-checker.ts
import { getOrdersReadyForExpiration, markExpirationNotificationSent } from "@/lib/order-database";
import { buildPaidOrderExpirationMessage, escapeMarkdown } from "@/lib/telegram-messages";

// app/api/orders/activate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrder } from "@/lib/order-database";
import { calculateExpiry, planNameToPlanType, getDateTimeInTimezone } from "@/lib/expiry-calculator";
import { buildPaidOrderActivationMessage, escapeMarkdown } from "@/lib/telegram-messages";

// All other new files follow similar patterns
```

---

## 📊 Code Statistics

| Category | Count | Lines |
|----------|-------|-------|
| Utility functions | 4 files | 529 |
| API endpoints | 3 files | 212 |
| Components | 1 file | 18 |
| Documentation | 5 files | 1900+ |
| Total new code | 8 files | 759 |
| Modified files | 2 files | 10 |
| **Grand Total** | **13 files** | **~2669** |

---

## ✨ Key Design Decisions

### Database Choice: JSON File
- ✅ Keeps deployment simple (no external database needed)
- ✅ All data stored locally in `PAYMENTS/.orders.json`
- ✅ Suitable for <100k orders
- ✅ Easy to backup and restore
- ⚠️ Can migrate to SQL database if needed

### Timezone Handling: Server-Side
- ✅ All calculations done on server
- ✅ Consistent timezone throughout system
- ✅ Configurable via `TZ` environment variable
- ✅ Dates displayed in local timezone, not UTC

### Background Service: Server-Side Interval
- ✅ Runs independently of HTTP requests
- ✅ Continues checking even without admin online
- ✅ 5-minute interval prevents excessive API calls
- ✅ Can be replaced with Vercel Crons or external scheduler

### Message Format: Human-Readable
- ✅ Never displays ISO format (e.g., not `2026-08-30T13:53:12.000Z`)
- ✅ Always shows separate date and time
- ✅ Uses emoji for clarity
- ✅ Includes all relevant details

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Customer Submits Order (POST /api/orders)              │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Status: PENDING│
         └────────┬───────┘
                  │
         ┌────────▼──────────────────────┐
         │ Telegram: "NEW ORDER" message │
         └────────┬──────────────────────┘
                  │
         ┌────────▼────────────────────────────┐
         │ Admin Activates (POST /api/activate)│
         └────────┬────────────────────────────┘
                  │
    ┌─────────────┼──────────────────┐
    │             │                  │
    ▼             ▼                  ▼
Calculate    Update DB    Send Telegram
Expiry   Status=ACTIVE   "ACTIVATED"
    │             │                  │
    └─────────────┼──────────────────┘
                  │
         ┌────────▼─────────────────────┐
         │ Status: ACTIVE               │
         │ expiryAt: set to now+duration│
         └────────┬─────────────────────┘
                  │
    ┌─────────────▼──────────────────────────┐
    │ Background Service (every 5 minutes)   │
    │ Check: Is expiryAt <= current time?    │
    └─────────────┬──────────────────────────┘
                  │
        ┌─────────▼────────────┐
        │ If expired:          │
        │ 1. Send Telegram msg │
        │ 2. Update status     │
        │ 3. Mark notified     │
        └─────────┬────────────┘
                  │
         ┌────────▼──────────────┐
         │ Status: EXPIRED       │
         │ expirationNotification│
         │ Sent: true            │
         └───────────────────────┘
```

---

## 🎯 Entry Points

**For Developers**:
1. Start here: `QUICK_START.md`
2. Then read: `PLAN_EXPIRY_GUIDE.md`
3. Reference: `IMPLEMENTATION_SUMMARY.md`
4. Example: `EXAMPLE_WALKTHROUGH.md`

**For DevOps**:
1. Configuration: See `PLAN_EXPIRY_GUIDE.md` → Configuration section
2. Deployment: See `PLAN_EXPIRY_GUIDE.md` → Deployment section
3. Monitoring: Look for `[Expiration Checker]` in logs

**For Testing**:
1. Read: `QUICK_START.md` → Testing section
2. Reference: `PLAN_EXPIRY_GUIDE.md` → Testing section

---

**System Status**: ✅ Complete and Ready for Production
