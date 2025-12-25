# Setup Instructions - Package & Payment System

## 1. Stripe Keys Configuration

Stripe keys have been added to `backend/SmartKB/appsettings.json`:
- **Publishable Key**: `pk_test_51QsjnVQF9XoPB98ZMfSziy8P7CdWek1KBqjPfjj5WhTkrGunPHE4IzJAZcGKWplgMcE8ZmiGJeFP8RfHAGQ5eQOa006MumVCKS`
- **Secret Key**: `sk_test_51QsjnVQF9XoPB98ZeQTg74KPCLlV4ES99pNY020hnZgOfSdndW7RrRMGPJeUrL54hrThBYVc2ytjNBfi7zwiruqv00r5W0R4qB`

**Note**: For production, move these to environment variables or use a `.env` file in the `backend/SmartKB` directory.

## 2. Seed Packages in Database

Before using the packages page, you need to seed the packages into the database.

### Option A: Using Swagger UI (Recommended)
1. Start the backend server
2. Navigate to `http://localhost:5074/swagger`
3. Find the `POST /api/Package/seed` endpoint
4. Click "Try it out" and then "Execute"
5. You should see a success message with the count of packages created

### Option B: Using curl
```bash
curl -X POST http://localhost:5074/api/Package/seed
```

### Option C: Using Postman or any HTTP client
- **Method**: POST
- **URL**: `http://localhost:5074/api/Package/seed`
- **Headers**: None required (this endpoint is public)

## 3. Verify Packages

After seeding, you can verify the packages were created:

### Get All Packages
```bash
curl http://localhost:5074/api/Package
```

### Get Single Package by ID
```bash
curl http://localhost:5074/api/Package/{packageId}
```

## 4. Frontend Usage

Once packages are seeded:
1. Navigate to `/packages` page
2. Packages will be automatically fetched from the API
3. Click "Purchase Now" to go to checkout
4. The checkout page will fetch the specific package details

## 5. Reset Packages (if needed)

To delete all packages and reseed:
1. Call `DELETE /api/Package/seed` (Admin only)
2. Then call `POST /api/Package/seed` again

## Database Collections

The following collections will be created/used:
- **packages**: Stores package definitions
- **payments**: Will store payment transactions (when payment integration is complete)
- **usage**: Already exists, will be updated when payments succeed

## Next Steps

1. ✅ Stripe keys added to configuration
2. ✅ Package model created
3. ✅ Payment model created
4. ✅ PackageController created with seed endpoint
5. ✅ Frontend updated to fetch packages from API
6. ⏳ **Next**: Implement Stripe payment processing
7. ⏳ **Next**: Create PaymentController for handling payments
8. ⏳ **Next**: Update Usage table when payment succeeds

