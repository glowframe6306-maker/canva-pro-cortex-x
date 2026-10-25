# Refund System Testing Guide

## Overview
Complete server-side refund validation system with strict security checks. All submitted customer details must be verified against the database order.

## Architecture

### Request Flow
1. Customer submits refund form with 7 required fields
2. Backend loads the Order by Order Number (PRIMARY KEY)
3. ALL submitted values verified against database order
4. If ALL 15 validation steps pass → Refund created + sent to Telegram
5. If ANY step fails → Error response + NO Telegram notification

### Key Security Principles
- **Order Number is the source of truth**
- **Database values override submitted values**
- **All 15 validation steps must pass (no exceptions)**
- **Telegram only on success**

## Test Scenarios

### TEST 1: Valid Order + Correct Details + ACTIVE Status
**Setup:**
- Order Number: (valid ACTIVE order)
- All customer details matching database exactly
- Refund within eligibility window
- Not a duplicate request

**Expected Result:**
- Status: 200 OK
- Refund Request created
- Telegram notification sent
- Response includes: refundRequestId, refundCode, orderNumber, status

**Code Path:**
- All 15 validation steps pass
- Telegram delivery succeeds
- Success response returned

---

### TEST 2: Invalid Order Number
**Setup:**
- Order Number: "INVALID-123"
- Valid details for any order

**Expected Result:**
- Status: 400 Bad Request
- Error: "INVALID ORDER NUMBER"
- Message: "No order found with this Order Number."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 1 fails (getOrderByOrderNumber returns null)
- Return early, skip all remaining steps

---

### TEST 3: Order Pending (Not Yet Activated)
**Setup:**
- Order Number: (PENDING order)
- All customer details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "ORDER IS STILL PENDING"
- Message: "Your order has not been activated yet..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 3 fails (status === PENDING)
- Return early

---

### TEST 4: Order Expired
**Setup:**
- Order Number: (EXPIRED order)
- All customer details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "SUBSCRIPTION EXPIRED"
- Message: "This subscription has already expired..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 3 fails (status === EXPIRED)

---

### TEST 5: Order Rejected
**Setup:**
- Order Number: (REJECTED order)
- All customer details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "REFUND NOT AVAILABLE"
- Message: "This order was rejected..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 3 fails (status === REJECTED)

---

### TEST 6: Incorrect Customer Name
**Setup:**
- Order Number: (ACTIVE order, customerName = "John Smith")
- Submitted Name: "Jane Smith"
- Other details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "DETAILS DO NOT MATCH"
- Message: "The Full Name does not match..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 4 fails (namesMatch returns false)
- Note: Matching is normalized (case-insensitive, no periods, spaces collapsed)

**Valid Name Variations** (all match "John Smith"):
- "john smith"
- "john  smith" (multiple spaces)
- "John Smith"
- "JOHN SMITH"

**Invalid Name Variations**:
- "john s." (missing last name)
- "joan smith" (different first name)
- "john smith jr" (extra suffix not in database)

---

### TEST 7: Incorrect Email Address
**Setup:**
- Order Number: (ACTIVE order, email = "john@example.com")
- Submitted Email: "john@different.com"
- Other details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "EMAIL DOES NOT MATCH"
- Message: "The email address does not match..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 5 fails (normalized emails don't match)

**Email Matching:**
- Case-insensitive
- Whitespace trimmed
- Must match exactly after normalization

---

### TEST 8: Incorrect WhatsApp Number
**Setup:**
- Order Number: (ACTIVE order, phone = "+94756390621")
- Submitted WhatsApp: "+94756390622"
- Other details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "WHATSAPP NUMBER DOES NOT MATCH"
- Message: "The WhatsApp number does not match..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 6 fails (phonesMatch returns false)

**Valid Phone Variations** (all match "+94756390621"):
- "+94756390621"
- "0756390621" (auto-converted to +94)
- "+94 756 390 621" (spaces removed)
- "+94-756-390-621" (hyphens removed)
- "+94(756)390621" (parentheses removed)

---

### TEST 9: Incorrect Canva Email
**Setup:**
- Order Number: (ACTIVE order, canvaEmail = "user@canva.account")
- Submitted Canva Email: "different@canva.account"
- Other details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "CANVA EMAIL DOES NOT MATCH"
- Message: "The Canva Email Address does not match..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 7 fails

---

### TEST 10: Reference Number from Different Order
**Setup:**
- Order Number 1: "ORD-001" (reference: "REF-001")
- Order Number 2: "ORD-002" (reference: "REF-002")
- Submit order 1 with reference from order 2 ("REF-002")
- All other details from order 1

**Expected Result:**
- Status: 400 Bad Request
- Error: "REFERENCE NUMBER DOES NOT MATCH"
- Message: "The Reference Number does not belong to the Order Number..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 8 fails (reference exists but belongs to different order)

---

### TEST 11: Free Trial Subscription
**Setup:**
- Order Number: (ACTIVE order with paymentMethod = "Free Trial")
- All customer details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "NOT ELIGIBLE"
- Message: "Free Trial subscriptions are not eligible for refunds."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 11 fails

---

### TEST 12: Refund Period Expired
**Setup:**
- Order Number: (WEEKLY plan, activated 10 days ago)
- Refund window: 3 days (expired)
- All customer details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "REFUND PERIOD EXPIRED"
- Message: "Your subscription is outside the allowed refund period. The refund period ended on [DATE] at [TIME]..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 14 fails (current date > refundEligibleUntil)

**Refund Windows:**
- WEEKLY: 3 days from activation
- MONTHLY: 14 days from activation
- YEARLY: 15 days from activation

---

### TEST 13: Duplicate Refund Request
**Setup:**
- First refund request submitted and created (status = PENDING)
- Submit same order details again

**Expected Result:**
- Status: 400 Bad Request
- Error: "REFUND REQUEST ALREADY EXISTS"
- Message: "A refund request has already been submitted..."
- NO new refund created
- NO Telegram notification

**Code Path:**
- STEP 15 fails (hasActiveRefundRequest returns true)

**Active Statuses** that trigger duplicate detection:
- PENDING
- UNDER_REVIEW
- APPROVED

---

### TEST 14: Double-Click Submission
**Setup:**
- Customer clicks SUBMIT twice rapidly
- Same refund details both times
- Network allows both requests to complete

**Expected Result:**
- First request: 200 OK (refund created + Telegram sent)
- Second request: 400 Bad Request (duplicate detected)
- Only ONE refund request in database
- Only ONE Telegram message sent

**Code Path:**
- First request: All validation passes → refund created → Telegram sent
- Second request: STEP 15 fails (duplicate detected)

---

### TEST 15: Telegram Failure
**Setup:**
- All validation passes
- Telegram API returns error (network failure, invalid token, etc.)
- Refund is saved but Telegram sending fails

**Expected Result:**
- Status: 503 Service Unavailable
- Error: "REFUND REQUEST COULD NOT BE SENT"
- Message: "The refund request could not be submitted at this time. Please try again later."
- Refund status: PENDING (retryable)
- Telegram notification status: PENDING (not marked as SENT)
- Response includes: refundRequestId (for retry/tracking)

**Code Path:**
- Validation passes
- saveRefundRequest succeeds (refund in database)
- Telegram fetch fails (telegramResponse.ok === false)
- Return error response
- Refund remains in PENDING state for manual retry

**Note:** Customer should NOT see success message. They should see "Please try again later."

---

### TEST 16: Missing Required Field
**Setup:**
- Order Number: valid
- Missing field: customerName (not submitted)
- Other fields complete

**Expected Result:**
- Status: 400 Bad Request
- Error: "MISSING REQUIRED FIELDS"
- Message: "Please provide all required fields..."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 0 fails (input validation)

---

### TEST 17: Invalid Email Format
**Setup:**
- Order Number: valid
- Email: "notanemail" (no @)
- Other fields valid

**Expected Result:**
- Status: 400 Bad Request
- Error: "INVALID EMAIL"
- Message: "Please provide a valid email address."
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 0 fails (email validation)

---

### TEST 18: Refund Eligible (Just Within Window)
**Setup:**
- WEEKLY plan
- Activated: 2 days, 23 hours, 59 minutes ago
- Refund window: 3 days
- All details correct

**Expected Result:**
- Status: 200 OK
- Refund created successfully
- Telegram sent
- Response includes all refund details

**Code Path:**
- STEP 14 passes (current time ≤ refundEligibleUntil)

---

### TEST 19: Refund Ineligible (Just Outside Window)
**Setup:**
- WEEKLY plan
- Activated: 3 days, 1 minute ago
- Refund window: 3 days
- All details correct

**Expected Result:**
- Status: 400 Bad Request
- Error: "REFUND PERIOD EXPIRED"
- Message: Shows the exact expiration date/time
- NO refund created
- NO Telegram notification

**Code Path:**
- STEP 14 fails (current time > refundEligibleUntil)

---

## Admin Dashboard Testing

### Refunds Tab
1. Navigate to Admin Panel → Refunds tab
2. View all refund requests
3. Filter by: All, Pending, Approved, Rejected
4. Each refund shows:
   - Refund Code (e.g., RFD-XXXXXX)
   - Customer Name
   - Status badge (PENDING/UNDER_REVIEW/APPROVED/REJECTED/PROCESSED)
   - Telegram notification status (PENDING/SENT/FAILED)
   - Order Number
   - Reference Number
   - Plan Type & Plan Name
   - Refund Amount
   - Subscription dates (started, eligible until)
   - Customer Email
   - Request timestamp

### Admin Actions
- [ ] View refund request details
- [ ] Approve refund request (change status to APPROVED)
- [ ] Reject refund request (change status to REJECTED)
- [ ] Track Telegram notification delivery status

---

## Database Verification

### Check Refund Storage
```bash
# Verify .refund-requests.json exists
ls -la PAYMENTS/.refund-requests.json

# View recent refund requests
cat PAYMENTS/.refund-requests.json | jq '.refunds | .[-3:]'

# Count by status
cat PAYMENTS/.refund-requests.json | jq '[.refunds[] | .status] | group_by(.) | map({status: .[0], count: length})'
```

### Check Order Database
```bash
# Verify order status and customer details
cat PAYMENTS/.orders.json | jq '.orders[] | select(.orderId=="ORD-001") | {orderId, status, customerName, customerEmail, customerPhone, canvaEmail, planType, paymentMethod}'
```

---

## API Response Examples

### Success Response (200 OK)
```json
{
  "ok": true,
  "refundRequestId": "REF-2025-000001",
  "refundCode": "RFD-ABC123",
  "orderNumber": "ORD-001",
  "referenceNumber": "REF-001",
  "plan": "MONTHLY",
  "status": "PENDING",
  "message": "Refund request submitted successfully.",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

### Error Response (400 Bad Request)
```json
{
  "ok": false,
  "error": "DETAILS DO NOT MATCH",
  "message": "The Full Name does not match the customer details registered for this Order Number."
}
```

### Telegram Failure Response (503)
```json
{
  "ok": false,
  "error": "REFUND REQUEST COULD NOT BE SENT",
  "message": "The refund request could not be submitted at this time. Please try again later.",
  "refundRequestId": "REF-2025-000001",
  "retryable": true
}
```

---

## Manual Testing Checklist

- [ ] Test Case 1: Valid submission
- [ ] Test Case 2: Invalid order number
- [ ] Test Case 3: Pending order
- [ ] Test Case 4: Expired order
- [ ] Test Case 5: Wrong name
- [ ] Test Case 6: Wrong email
- [ ] Test Case 7: Wrong phone
- [ ] Test Case 8: Wrong Canva email
- [ ] Test Case 9: Reference from different order
- [ ] Test Case 10: Free trial
- [ ] Test Case 11: Refund period expired
- [ ] Test Case 12: Duplicate request
- [ ] Test Case 13: Double-click submission
- [ ] Test Case 14: Telegram failure
- [ ] Test Case 15: Missing field
- [ ] Test Case 16: Invalid email format
- [ ] Test Case 17: Just within refund window
- [ ] Test Case 18: Just outside refund window
- [ ] Admin: View refund records
- [ ] Admin: Filter by status
- [ ] Admin: Approve/Reject refund
- [ ] Database: Verify refund storage
- [ ] Database: Verify duplicate detection

---

## Performance Notes

- Validation is synchronous and completes <100ms
- Database lookup is synchronous from persistent JSON
- Telegram sending is async (doesn't block response)
- Maximum concurrent refunds: limited by Telegram rate limits

---

## Security Checklist

✅ Order Number verified in database
✅ All customer details normalized and matched
✅ Reference number scoped to correct order
✅ Refund period calculated from database activation date
✅ Duplicate detection prevents repeated refunds
✅ Telegram token/credentials never exposed to frontend
✅ Error messages don't leak internal details
✅ No confirmation sent on validation failures
✅ Race condition protection (double-check before saving)
✅ Refund status remains PENDING if Telegram fails
