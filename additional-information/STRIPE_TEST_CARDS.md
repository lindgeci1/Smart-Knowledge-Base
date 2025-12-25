# Stripe Test Cards

Use these test card numbers to test different payment scenarios in your application.

## ✅ Successful Payments

### Standard Success
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date (e.g., `12/25`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)
- **Result**: Payment succeeds immediately

### Visa (Debit)
- **Card Number**: `4000 0566 5566 5556`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Payment succeeds

### Mastercard
- **Card Number**: `5555 5555 5555 4444`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Payment succeeds

### American Express
- **Card Number**: `3782 822463 10005`
- **Expiry**: Any future date
- **CVC**: Any 4 digits (Amex uses 4-digit CVC)
- **ZIP**: Any 5 digits
- **Result**: Payment succeeds

## ❌ Declined Payments

### Generic Decline
- **Card Number**: `4000 0000 0000 0002`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Card declined with generic decline message

### Insufficient Funds
- **Card Number**: `4000 0000 0000 9995`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Card declined - insufficient funds

### Lost Card
- **Card Number**: `4000 0000 0000 9987`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Card declined - lost card

### Stolen Card
- **Card Number**: `4000 0000 0000 9979`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Card declined - stolen card

### Expired Card
- **Card Number**: `4000 0000 0000 0069`
- **Expiry**: Any past date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Card declined - expired card

### Incorrect CVC
- **Card Number**: `4000 0000 0000 0127`
- **Expiry**: Any future date
- **CVC**: Any incorrect 3 digits
- **ZIP**: Any 5 digits
- **Result**: Card declined - incorrect CVC

### Processing Error
- **Card Number**: `4000 0000 0000 0119`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Processing error

## 🔐 3D Secure Authentication

### Requires Authentication (3D Secure)
- **Card Number**: `4000 0025 0000 3155`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: Requires 3D Secure authentication
- **Note**: In test mode, use authentication code: `1234`

### 3D Secure - Authentication Failed
- **Card Number**: `4000 0000 0000 3055`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: 3D Secure authentication failed

### 3D Secure - Authentication Unavailable
- **Card Number**: `4000 0027 6000 3184`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits
- **Result**: 3D Secure authentication unavailable

## 💳 Card Brand Detection

Test cards for different brands (logos should appear automatically):

- **Visa**: `4242 4242 4242 4242`
- **Mastercard**: `5555 5555 5555 4444`
- **American Express**: `3782 822463 10005`
- **Discover**: `6011 1111 1111 1117`
- **Diners Club**: `3056 9309 0259 04`
- **JCB**: `3530 1113 3330 0000`

## 🧪 Special Test Cases

### Always Requires Authentication
- **Card Number**: `4000 0027 6000 3184`
- **Result**: Always requires 3D Secure

### Always Succeeds (No Authentication)
- **Card Number**: `4242 4242 4242 4242`
- **Result**: Succeeds without authentication

### Always Declines
- **Card Number**: `4000 0000 0000 0002`
- **Result**: Always declines

## 📝 Testing Checklist

- [ ] Test successful payment with Visa
- [ ] Test successful payment with Mastercard
- [ ] Test successful payment with Amex
- [ ] Test declined payment (insufficient funds)
- [ ] Test declined payment (lost card)
- [ ] Test expired card
- [ ] Test incorrect CVC
- [ ] Test 3D Secure authentication
- [ ] Test card brand logo detection
- [ ] Test email field is readonly
- [ ] Test toast notification on success
- [ ] Test error messages display correctly

## 🔍 Common Issues

### Card Logo Not Showing
- Make sure you're typing the full card number
- Logo appears after 4-6 digits are entered
- Check browser console for Stripe errors

### 3D Secure Not Working
- Ensure you're in test mode
- Use authentication code: `1234`
- Check that 3D Secure is enabled in Stripe Dashboard

### Payment Declined Unexpectedly
- Verify you're using test cards (not real cards)
- Check card number is correct (no typos)
- Ensure expiry date is in the future
- Verify CVC is correct length (3 digits for most cards, 4 for Amex)

