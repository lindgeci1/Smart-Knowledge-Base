# Stripe Integration Setup Guide

## Environment Variables Setup

### Backend (.env file in `backend/SmartKB/`)

Create a `.env` file in the `backend/SmartKB/` directory with the following:

```env
JWT_KEY=your_jwt_secret_key_here
STRIPE_PUBLISHABLE_KEY=stripe_publishable_key_here
STRIPE_SECRET_KEY=stripe_secret_key_here
```

**Note**: The backend uses `DotNetEnv` which automatically loads `.env` files. Make sure the `.env` file is in the `backend/SmartKB/` directory (same level as `Program.cs`).

### Frontend (.env file in `frontend/`)

Create a `.env` file in the `frontend/` directory with the following:

```env
VITE_API_BASE_URL=http://localhost:5074/api
VITE_STRIPE_PUBLISHABLE_KEY=stripe_publishable_key_here
```

**Note**: Vite requires the `VITE_` prefix for environment variables to be exposed to the frontend.

## How It Works

### Payment Flow

1. **User clicks "Purchase Now"** on a package
2. **User fills out checkout form** with:
   - Email
   - Card details (validated by Stripe Elements)
   - Cardholder name
   - Billing address
3. **User clicks "Pay"**:
   - Frontend calls `/api/Payment/create-payment-intent`
   - Backend creates a Payment record (status: "pending")
   - Backend creates a Stripe Payment Intent
   - Backend returns `clientSecret` to frontend
4. **Frontend confirms payment with Stripe**:
   - Uses Stripe.js to confirm the payment with the card details
   - Stripe validates the card (CVV, expiry, number format)
5. **On success**:
   - Frontend calls `/api/Payment/confirm`
   - Backend verifies payment with Stripe
   - Backend updates Payment record (status: "succeeded")
   - Backend updates Usage table (adds package limit to user's total limit)
   - Frontend updates user limit in context
   - User is redirected to dashboard

### Card Validation

Stripe Elements automatically validates:
- ✅ Card number format
- ✅ Expiry date format
- ✅ CVC format
- ✅ Card brand detection (Visa, Mastercard, Amex, etc.)

The payment button is disabled until the card is complete and valid.

## Testing

### Test Cards

Use these Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires 3D Secure**: `4000 0025 0000 3155`

For all test cards:
- **Expiry**: Any future date (e.g., `12/25`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

## API Endpoints

### `POST /api/Payment/create-payment-intent`
Creates a payment intent and payment record.

**Request Body:**
```json
{
  "packageId": "package_id_here",
  "email": "user@example.com",
  "billingName": "John Doe",
  "billingAddress": {
    "line1": "123 Main St",
    "line2": "Apt 4",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "United States"
  }
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### `POST /api/Payment/confirm`
Confirms payment and updates usage.

**Request Body:**
```json
{
  "paymentIntentId": "pi_xxx",
  "packageId": "package_id_here"
}
```

**Response:**
```json
{
  "message": "Payment confirmed successfully",
  "paymentId": "payment_id_here",
  "packageId": "package_id_here"
}
```

### `GET /api/Payment/history`
Gets user's payment history.

**Response:**
```json
[
  {
    "id": "payment_id",
    "userId": "user_id",
    "packageId": "package_id",
    "amount": 29.00,
    "status": "succeeded",
    "createdAt": "2024-01-15T10:30:00Z",
    "paidAt": "2024-01-15T10:30:05Z"
  }
]
```

## Troubleshooting

### "Stripe secret key not configured"
- Make sure `.env` file exists in `backend/SmartKB/`
- Check that `STRIPE_SECRET_KEY` is set correctly
- Restart the backend server after creating/updating `.env`

### "Payment button is disabled"
- Make sure Stripe Elements is loaded (check browser console)
- Ensure card details are complete and valid
- Check that `VITE_STRIPE_PUBLISHABLE_KEY` is set in frontend `.env`

### "Payment failed" errors
- Check Stripe Dashboard for detailed error messages
- Verify test card numbers are correct
- Ensure backend has internet connection to Stripe API

## Security Notes

- ✅ Card details never touch your server (handled by Stripe)
- ✅ Payment validation happens on Stripe's servers
- ✅ Only payment intent IDs are stored in your database
- ✅ All API endpoints require authentication
- ⚠️ Never commit `.env` files to version control
- ⚠️ Use environment variables in production

