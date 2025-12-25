# Database Schema - Package & Payment System

## Table Relationships

### 1. **Package Table** (`packages` collection)

Stores available subscription packages.

**Fields:**

- `Id` (ObjectId) - Primary key
- `Name` (string) - Package name (e.g., "Starter Boost", "Pro Power", "Enterprise Scale")
- `Description` (string) - Package description
- `Price` (decimal) - Package price (9, 29, 99)
- `PriceType` (string) - "one-time" or "recurring"
- `SummaryLimit` (int, nullable) - Additional summaries (+50, +200, +1000)
- `Features` (array of strings) - Package features list
- `IsPopular` (bool) - For "Most Popular" badge
- `IsActive` (bool) - Enable/disable package
- `CreatedAt`, `UpdatedAt` (DateTime)

### 2. **Payment Table** (`payments` collection)

Stores payment transactions linked to packages and users.

**Fields:**

- `Id` (ObjectId) - Primary key
- `UserId` (string) - **Foreign key** → User.UserId
- `PackageId` (string) - **Foreign key** → Package.Id
- `StripePaymentIntentId` (string, nullable) - Stripe Payment Intent ID
- `StripeCustomerId` (string, nullable) - Stripe Customer ID
- `StripeChargeId` (string, nullable) - Stripe Charge ID
- `Amount` (decimal) - Payment amount
- `Currency` (string) - Currency code (default: "USD")
- `Status` (string) - "pending", "succeeded", "failed", "canceled", "refunded"
- `PaymentMethod` (string) - Payment method type
- `BillingEmail`, `BillingName` (string, nullable)
- `BillingAddress` (object, nullable) - Billing address details
- `Metadata` (dictionary, nullable) - Additional Stripe metadata
- `CreatedAt`, `UpdatedAt`, `PaidAt` (DateTime)

### 3. **Usage Table** (`usage` collection) - Existing

Tracks user usage and limits.

**Fields:**

- `Id` (ObjectId) - Primary key
- `UserId` (string) - **Foreign key** → User.UserId
- `OverallUsage` (int) - Current usage count
- `TotalLimit` (int) - Total limit (default: 100, increases with package purchases)
- `CreatedAt`, `UpdatedAt` (DateTime)

## Relationships

```
User (1) ────────< (Many) Payment
Package (1) ─────< (Many) Payment
User (1) ────────< (1) Usage
```

### Relationship Details:

1. **User → Payment (1-to-Many)**

   - One user can have multiple payments
   - Foreign key: `Payment.UserId` → `User.UserId`

2. **Package → Payment (1-to-Many)**

   - One package can be purchased multiple times (by different users)
   - Foreign key: `Payment.PackageId` → `Package.Id`

3. **User → Usage (1-to-1)**
   - One user has one usage record
   - Foreign key: `Usage.UserId` → `User.UserId`

## Payment Flow

### When a user purchases a package:

1. **Create Payment Record** (status: "pending")

   - Store `UserId`, `PackageId`, `Amount`, billing info
   - Create Stripe Payment Intent
   - Store `StripePaymentIntentId`

2. **Process Payment via Stripe**

   - User completes payment on frontend
   - Stripe webhook confirms payment success

3. **On Payment Success:**

   - Update `Payment.Status` = "succeeded"
   - Update `Payment.PaidAt` = current timestamp
   - Store `StripeChargeId`
   - **Update Usage Table:**
     - Find or create `Usage` record for the user
     - Add package's `SummaryLimit` to `Usage.TotalLimit`
     - Example: If user has 100 limit and buys +200 package → new limit = 300

4. **On Payment Failure:**
   - Update `Payment.Status` = "failed"
   - Do NOT update Usage table

## Example Flow

```
User purchases "Pro Power" package ($29, +200 summaries):

1. Payment created:
   - UserId: "user123"
   - PackageId: "pro_power_id"
   - Amount: 29.00
   - Status: "pending"

2. Stripe processes payment → Success

3. Payment updated:
   - Status: "succeeded"
   - PaidAt: 2024-01-15 10:30:00

4. Usage updated:
   - UserId: "user123"
   - TotalLimit: 100 → 300 (100 + 200)
   - OverallUsage: 50 (unchanged)
```

## Nullable Fields Explanation

### Package Table:

- `SummaryLimit` - Nullable because some packages might not add summaries (e.g., feature-only packages)

### Payment Table:

- `StripePaymentIntentId` - Nullable until Stripe creates it
- `StripeCustomerId` - Nullable (created on first payment)
- `StripeChargeId` - Nullable until payment succeeds
- `BillingEmail`, `BillingName`, `BillingAddress` - Optional billing info
- `Metadata` - Optional additional data
- `PaidAt` - Nullable until payment succeeds

## Indexes Recommended

1. **Payment Collection:**

   - Index on `UserId` (for querying user's payments)
   - Index on `PackageId` (for analytics)
   - Index on `Status` (for filtering)
   - Index on `StripePaymentIntentId` (for webhook lookups)

2. **Package Collection:**

   - Index on `IsActive` (for filtering active packages)

3. **Usage Collection:**
   - Index on `UserId` (already exists, for quick lookups)
