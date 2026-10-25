# Admin Subscription Lifecycle Test Plan

## Status Overview
- ✅ Admin Dashboard: COMPLETE and displaying 23 real orders
- ✅ Activation API: Exists and calculates expiry/reminder dates
- ✅ Cron Scheduler: Configured to run every minute (vercel.json)
- ✅ Message Builders: Reminder and expiry message functions exist
- ✅ Customer Popups: Order success popup with copy buttons working
- ✅ Refund Verification: Checks Order # + Reference # against database

## Critical Tests to Run

### Test 1: Verify Activation Calculates Correct Dates
**Test Order**: MI-20260830-0002 (Yearly plan, PENDING)
**Expected Behavior**:
1. Call POST `/api/admin/orders` with `{ action: "activate", orderId: "MI-20260830-0002" }`
2. Response should include:
   - `status: "ACTIVE"`
   - `approvedAt: ISO timestamp`
   - `activatedAt: ISO timestamp`
   - `activationDate: "YYYY-MM-DD"` (Asia/Colombo)
   - `activationTime: "HH:MM:SS"` (Asia/Colombo)
   - `expiryAt: ISO timestamp` (approx. 365 days from activatedAt)
   - `expiryDate: "YYYY-MM-DD"`
   - `expiryTime: "HH:MM:SS"`
   - `reminderAt: ISO timestamp` (expiryAt - 24 hours)
   - `reminderDate: "YYYY-MM-DD"`
   - `reminderTime: "HH:MM:SS"`
   - `reminderStatus: "PENDING"`
   - `expiryNotificationStatus: "PENDING"`

**Command to Test**:
```powershell
$body = @{ action = "activate"; orderId = "MI-20260830-0002" } | ConvertTo-Json
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/orders" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Test 2: Verify Reminder Message Format
**Test**: Call the check-expiration endpoint and inspect message content
**Expected**: Message should include:
- ⏳ YEARLY EXPIRES IN 1 DAY
- 🆔 REQUEST / ORDER ID: MI-20260830-0002
- 👤 CUSTOMER DETAILS (full name, email, WhatsApp, Canva Email)
- 📦 SUBSCRIPTION DETAILS (Plan, Plan Type, Duration)
- 📅 START INFORMATION (Started On, Started At)
- 📅 EXPIRY INFORMATION (Expires On, Expires At, Remaining: 1 DAY / 24 HOURS)
- ⏳ Reminder Scheduled For: [date time]
- 📌 Reminder Sent At: [date time]
- All times in Asia/Colombo timezone (UTC+5:30)
- No "TBD" or placeholder values

**Command to Test**:
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/check-expiration?token=test" -Method GET
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Test 3: Verify Duplicate Protection (Reminders Not Sent Twice)
**Expected**:
1. After first activation, call check-expiration
2. Reminder should be sent and `reminderSentAt` set in database
3. Call check-expiration again (same minute/hour)
4. Reminder should NOT be sent again (no Telegram message duplicated)
5. `reminderSentAt` should remain the same timestamp

**Validation**:
- Check `.orders.json` file for `reminderSentAt` value
- Confirm it's only set once
- Check Telegram logs (if available) for duplicate prevention

### Test 4: Verify Status Transitions Timeline
**Plan**:
1. Activate order at time T
2. At T+0 to T+24h-1s: Status should be ACTIVE
3. At T+24h: Reminder should be sent, status should be ACTIVE (but reminderStatus="SENT")
4. At T+30 days (for YEARLY that's calculated as expiry): Status should change to EXPIRED

**Issue**: Current implementation may not automatically change status to "EXPIRING_IN_1_DAY"
**Need to Verify**: Does the scheduler update status, or does it only send notifications?

### Test 5: Verify All Required Order Fields Persist
**After Activation**, the order in database should have:
```json
{
  "orderId": "MI-20260830-0002",
  "customerName": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "canvaEmail": "string",
  "selectedPlan": "string",
  "planPrice": "string",
  "paymentMethod": "Bank Transfer",
  "paymentDetails": "string (Reference Number)",
  "status": "ACTIVE",

  "approvedAt": "ISO timestamp",
  "activatedAt": "ISO timestamp",
  "activationDate": "YYYY-MM-DD",
  "activationTime": "HH:MM:SS",

  "expiryAt": "ISO timestamp",
  "expiryDate": "YYYY-MM-DD",
  "expiryTime": "HH:MM:SS",
  "durationDays": 365,
  "planType": "YEARLY",
  "duration": "365 days",

  "reminderAt": "ISO timestamp",
  "reminderDate": "YYYY-MM-DD",
  "reminderTime": "HH:MM:SS",
  "reminderStatus": "PENDING",
  "reminderSentAt": null,

  "expiryNotificationStatus": "PENDING",
  "expirationNotificationSentAt": null,

  "orderCreatedAt": "ISO timestamp"
}
```

### Test 6: Verify Customer Success Popup
**Steps**:
1. Submit a new order (purchase or free trial)
2. Verify popup shows:
   - Title: "ORDER SUBMITTED SUCCESSFULLY" or "FREE TRIAL REQUEST SUBMITTED"
   - Order Number with COPY button (actually copies to clipboard)
   - Reference Number (for paid) or Request ID (for trial) with COPY button
   - Message: "Save these details for refund/support"
3. Click COPY buttons and paste to verify they work
4. Click CONTINUE to close popup

### Test 7: Verify Refund Verification
**Steps**:
1. Go to Refund section
2. Enter: Order Number (e.g., "MI-20260830-0002"), Reference Number (from payment slip), Customer info
3. Verify it looks up the order in database
4. Show error if Order # not found or Reference # doesn't match
5. Show error if order is not in valid status for refund

### Test 8: Timezone Verification (Asia/Colombo)
**Check All Timestamps Should Be**:
- UTC+5:30 timezone
- Format: YYYY-MM-DD for dates, HH:MM:SS for times
- Example: If UTC time is 2026-08-31T00:00:00Z, Asia/Colombo should show 2026-08-31 05:30:00
- Verify in:
  - Admin dashboard display
  - Telegram messages
  - Order database fields (activationDate, activationTime, expiryDate, etc.)
  - Refund form timestamps

## Issues to Investigate

### Issue 1: Status "EXPIRING_IN_1_DAY"
**Current**: Not implemented
**Need**: Verify if status should change to "EXPIRING_IN_1_DAY" at reminderAt time
**Or**: Status stays ACTIVE but reminderStatus changes to "SENT"

### Issue 2: Status Change to "EXPIRED"
**Current**: Not confirmed whether scheduler changes status
**Need**: Verify if scheduler calls updateOrder() to change status to "EXPIRED" at expiryAt time
**Check Function**: `checkAndNotifyExpiredOrders()` in lib/expiration-checker.ts

### Issue 3: Message Content Validation
**Need to Verify**:
- Are Order Number and Reference Number included in reminder messages?
- Are all 11 pieces of required information shown?
- Are Telegram messages markdown properly escaped?
- Are emoji characters preserved correctly?

### Issue 4: Cron Execution in Development
**Note**: In local development, cron doesn't run automatically
**Workaround**: Manually call `/api/orders/check-expiration?token=test` to test
**Production**: Vercel runs cron automatically

## Test Execution Commands

```powershell
# 1. Test activation
$body = @{ action = "activate"; orderId = "MI-20260830-0002" } | ConvertTo-Json
$resp = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/orders" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
$resp.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | head -50

# 2. Test check-expiration (manual trigger)
$resp = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/check-expiration?token=test" -Method GET
$resp.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5

# 3. Check database state
Get-Content "C:\Users\Administrator\CANVA PRO\PAYMENTS\.orders.json" | ConvertFrom-Json | .orders[0] | ConvertTo-Json -Depth 10
```

## Acceptance Criteria

✅ All 8 tests pass
✅ No "TBD" or placeholder values in any message
✅ Timezone is consistently Asia/Colombo
✅ Duplicate protection works (no double sends)
✅ Server restart protection works (cron-based)
✅ Customer popup shows correct data with working copy buttons
✅ Refund verification checks both Order # and Reference #
✅ All real database fields persist correctly
✅ Admin dashboard displays accurate counts from database
✅ Telegram messages formatted with proper emoji and markdown
