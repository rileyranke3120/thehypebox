# Stripe Customer Portal Setup

One-time configuration required before launch. Takes ~5 minutes.

---

## What This Unlocks

Once configured, customers clicking "Manage Subscription", "Update Payment Method", or "View Invoices" in their billing dashboard will be redirected to Stripe's secure hosted portal where they can:

- Cancel their subscription (at end of billing period)
- Update or replace their payment method
- View and download all invoices
- See billing history

After any action, they're returned to `https://thehypeboxllc.com/dashboard/billing`.

---

## Setup Steps

### 1. Go to Portal Settings

https://dashboard.stripe.com/settings/billing/portal

Make sure you're in **live mode** (toggle in the top-left of Stripe dashboard).

### 2. Fill in Business Information

| Field | Value |
|-------|-------|
| Business name | TheHypeBox LLC |
| Support email | riley@thehypeboxllc.com |
| Terms of service URL | https://thehypeboxllc.com/terms |
| Privacy policy URL | https://thehypeboxllc.com/privacy |

### 3. Configure Subscription Features

Under **Subscriptions**, enable:

- ✅ **Customers can cancel subscriptions**
  - Set cancellation to: **Cancel at end of billing period** (not immediately)
- ✅ **Customers can update subscriptions** (optional — allows plan switches)
- ✅ **Customers can pause subscriptions** (optional)

### 4. Configure Payment Method Features

Under **Payment methods**, enable:

- ✅ **Customers can update their payment method**
- ✅ **Require payment method when subscription is active**

### 5. Configure Invoice Features

Under **Invoices**, enable:

- ✅ **Customers can view invoices**

### 6. Customize Branding (Optional but Recommended)

Under **Branding**:
- Upload your logo (`/public/logo.png`)
- Set primary color: `#F5C400`
- Set button text color: `#000000`

### 7. Save

Click **Save changes** at the bottom of the page.

---

## Testing the Portal

1. Log in at https://thehypeboxllc.com/login with a test account
2. Navigate to `/dashboard/billing`
3. Click **Manage Subscription**
4. Should redirect to `portal.stripe.com/...`
5. Test an action (e.g., view invoices)
6. After the action, you should land back at `/dashboard/billing`

In **test mode**, you can safely test cancellation — it won't affect your live subscriptions.

---

## Important Notes

- The portal URL is generated server-side per user — customers cannot access each other's portals
- Each portal link expires after a short window (Stripe default: 5 minutes)
- The portal respects your subscription settings — if you have set up plan switches, customers will see that option
- You can configure test mode and live mode portal settings separately
