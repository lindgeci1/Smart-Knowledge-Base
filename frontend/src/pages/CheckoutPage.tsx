import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Info,
  Zap,
  Shield,
  Star,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "../lib/authClient";
import { StripeCardElement } from "../components/StripeCardElement";
import toast from "react-hot-toast";

interface Package {
  id?: string;
  name: string;
  summaryLimit: number | null;
  price: number;
  priceType: string;
  description: string;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
}

interface CheckoutPackage extends Package {
  icon: typeof Zap;
  color: string;
  priceFormatted: string;
}

const iconMap: Record<string, typeof Zap> = {
  "Starter Boost": Zap,
  "Pro Power": Star,
  "Enterprise Scale": Shield,
};

const colorMap: Record<string, string> = {
  "Starter Boost": "blue",
  "Pro Power": "purple",
  "Enterprise Scale": "indigo",
};

export function CheckoutPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const [searchParams] = useSearchParams();
  const { updateUserLimit, user } = useAuth();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [checkoutPackage, setCheckoutPackage] =
    useState<CheckoutPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email || "");
  const [cardholderName, setCardholderName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    cardholderName?: string;
    addressLine1?: string;
    postalCode?: string;
    city?: string;
  }>({});

  // Update email when user object is available
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);
  const [country, setCountry] = useState("United States");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  // Check for payment success in URL params
  useEffect(() => {
    const paymentSuccess = searchParams.get("payment_success");
    if (paymentSuccess === "true") {
      toast.success("Payment successful! Your package has been activated.", {
        duration: 5000,
      });
      // Clean up URL
      navigate(`/checkout/${packageId}`, { replace: true });
    }
  }, [searchParams, navigate, packageId]);

  useEffect(() => {
    const fetchPackage = async () => {
      if (!packageId) {
        navigate("/packages");
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.get<Package>(`/Package/${packageId}`);
        const pkg = response.data;

        if (!pkg || !pkg.isActive) {
          navigate("/packages");
          return;
        }

        // Map backend package to frontend format
        const mappedPackage: CheckoutPackage = {
          ...pkg,
          icon: iconMap[pkg.name] || Zap,
          color: colorMap[pkg.name] || "blue",
          priceFormatted: `$${pkg.price}`,
        };

        setCheckoutPackage(mappedPackage);
      } catch (error: any) {
        console.error("Failed to fetch package:", error);
        navigate("/packages");
      } finally {
        setLoading(false);
      }
    };

    fetchPackage();
  }, [packageId, navigate]);

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if all required fields are filled and valid
  const isFormValid =
    email.trim() !== "" &&
    isValidEmail(email) &&
    cardholderName.trim().length >= 2 &&
    addressLine1.trim().length >= 5 &&
    postalCode.trim().length >= 4 &&
    city.trim().length >= 2 &&
    cardComplete &&
    stripe !== null;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPackage || !stripe || !elements || !isFormValid) {
      if (!isFormValid) {
        setError("Please fill in all required fields correctly.");
      }
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // Step 1: Create payment intent
      const paymentIntentResponse = await apiClient.post<{
        clientSecret: string;
        paymentIntentId: string;
      }>("/Payment/create-payment-intent", {
        packageId: checkoutPackage.id,
        email: email,
        billingName: cardholderName,
        billingAddress: {
          line1: addressLine1,
          line2: addressLine2 || undefined,
          city: city,
          postalCode: postalCode,
          country: country,
        },
      });

      const { clientSecret, paymentIntentId } = paymentIntentResponse.data;

      // Step 2: Confirm payment with Stripe
      const cardElement = elements.getElement("cardNumber");
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardholderName,
              email: email,
              address: {
                line1: addressLine1,
                line2: addressLine2 || undefined,
                city: city,
                postal_code: postalCode,
                country: country === "United States" ? "US" : country,
              },
            },
          },
        });

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        // Step 3: Confirm payment in backend (fire and forget, don't wait)
        apiClient
          .post("/Payment/confirm", {
            paymentIntentId: paymentIntentId,
            packageId: checkoutPackage.id,
          })
          .catch((err) => console.error("Backend confirmation error:", err));

        // Step 4: Update user limit in frontend
        if (checkoutPackage.summaryLimit) {
          updateUserLimit(checkoutPackage.summaryLimit);
        }

        // Step 5: Show success and reset state
        toast.success(
          `Payment successful! Your ${checkoutPackage.name} package has been activated.`,
          {
            duration: 3000,
          }
        );

        // Step 6: Reset processing and navigate
        setIsProcessing(false);
        navigate("/dashboard", { replace: true });
      } else {
        setError("Payment was not completed. Please try again.");
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "An error occurred during payment. Please try again."
      );
      setIsProcessing(false);
    }
  };

  if (loading || !checkoutPackage) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-white dark:bg-slate-900">
      {/* Left Side - Order Summary (Dark) */}
      <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 sm:p-6 lg:p-8 w-full lg:w-2/5 lg:fixed lg:left-0 lg:top-0 lg:h-full flex flex-col border-r border-slate-700 dark:border-slate-700">
        {/* Back Button */}
        <button
          onClick={() => navigate("/packages")}
          disabled={isProcessing}
          className="flex items-center text-slate-400 hover:text-white mb-4 sm:mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="text-sm">Back</span>
        </button>

        {/* Package Title */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">
            Subscribe to {checkoutPackage.name}
          </h2>
          <p className="text-2xl sm:text-3xl font-bold">
            {checkoutPackage.priceFormatted}
            <span className="text-xs sm:text-sm font-normal text-slate-400 ml-2">
              {checkoutPackage.priceType}
            </span>
          </p>
        </div>

        {/* Package Details */}
        <div className="mb-4 sm:mb-6 flex-1">
          <div className="flex items-start mb-4 sm:mb-6">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0 ${
                checkoutPackage.color === "blue"
                  ? "bg-blue-600"
                  : checkoutPackage.color === "purple"
                  ? "bg-purple-600"
                  : checkoutPackage.color === "indigo"
                  ? "bg-indigo-600"
                  : "bg-slate-600"
              }`}
            >
              <checkoutPackage.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base mb-1">
                {checkoutPackage.name}
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm mb-1">
                {checkoutPackage.description}
              </p>
              <p className="text-slate-500 text-xs">One-time payment</p>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="font-semibold text-xs sm:text-sm">
                {checkoutPackage.priceFormatted}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-slate-700 pt-4 sm:pt-6 space-y-2 sm:space-y-3">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span>{checkoutPackage.priceFormatted}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <div className="flex items-center">
                <span className="text-slate-400">Tax</span>
                <Info className="h-3 w-3 ml-1 text-slate-500" />
              </div>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base font-semibold pt-2 sm:pt-3 border-t border-slate-700">
              <span>Total due today</span>
              <span>{checkoutPackage.priceFormatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Payment Form (Light) - Scrollable */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 w-full lg:w-3/5 lg:ml-[40%] min-h-screen lg:h-full lg:overflow-y-auto">
        <form
          onSubmit={handlePayment}
          className="max-w-2xl w-full space-y-4 sm:space-y-6"
        >
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 flex items-start">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 mr-2 sm:mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}

          {/* Contact Information */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Contact information
            </h3>
            <input
              type="email"
              placeholder="Email"
              value={email}
              readOnly
              required
              disabled={isProcessing}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
            />
          </div>

          {/* Payment Method */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Payment method
            </h3>
            <div className="space-y-2">
              <label className="flex items-center p-2 sm:p-3 border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer transition-all">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={true}
                  readOnly
                  className="mr-2"
                  disabled={isProcessing}
                />
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-slate-600 dark:text-slate-300" />
                <span className="font-medium text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                  Card
                </span>
              </label>
            </div>

            {/* Stripe Card Element */}
            <div className="mt-4">
              <StripeCardElement
                onCardChange={(complete, brand) => setCardComplete(complete)}
                disabled={isProcessing}
              />
            </div>

            {/* Cardholder Name */}
            <div className="mt-3 sm:mt-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Cardholder name
              </label>
              <input
                type="text"
                placeholder="Full name on card"
                value={cardholderName}
                onChange={(e) => {
                  // Only allow letters, spaces, hyphens, and apostrophes
                  const value = e.target.value.replace(/[^a-zA-Z\s'-]/g, "");
                  setCardholderName(value);
                  if (fieldErrors.cardholderName) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      cardholderName: undefined,
                    }));
                  }
                }}
                onBlur={() => {
                  if (cardholderName.trim().length < 2) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      cardholderName:
                        "Cardholder name must be at least 2 characters",
                    }));
                  }
                }}
                required
                disabled={isProcessing}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isProcessing
                    ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                    : fieldErrors.cardholderName
                    ? "border-red-300 dark:border-red-600"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              />
              {fieldErrors.cardholderName && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.cardholderName}
                </p>
              )}
            </div>
          </div>

          {/* Billing Address */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Billing address
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isProcessing}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isProcessing
                      ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Australia">Australia</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Address line 1"
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    if (fieldErrors.addressLine1) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        addressLine1: undefined,
                      }));
                    }
                  }}
                  onBlur={() => {
                    if (addressLine1.trim().length < 5) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        addressLine1: "Address must be at least 5 characters",
                      }));
                    }
                  }}
                  required
                  disabled={isProcessing}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isProcessing
                      ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                      : fieldErrors.addressLine1
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                />
                {fieldErrors.addressLine1 && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {fieldErrors.addressLine1}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Address line 2 (optional)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  disabled={isProcessing}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isProcessing
                      ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Postal code"
                    value={postalCode}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/[^0-9]/g, "");
                      setPostalCode(value);
                      if (fieldErrors.postalCode) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          postalCode: undefined,
                        }));
                      }
                    }}
                    onBlur={() => {
                      if (postalCode.trim().length < 4) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          postalCode: "Postal code must be at least 4 digits",
                        }));
                      }
                    }}
                    required
                    disabled={isProcessing}
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isProcessing
                        ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                        : fieldErrors.postalCode
                        ? "border-red-300 dark:border-red-600"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  />
                  {fieldErrors.postalCode && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {fieldErrors.postalCode}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => {
                      // Only allow letters, spaces, hyphens, and apostrophes
                      const value = e.target.value.replace(
                        /[^a-zA-Z\s'-]/g,
                        ""
                      );
                      setCity(value);
                      if (fieldErrors.city) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          city: undefined,
                        }));
                      }
                    }}
                    onBlur={() => {
                      if (city.trim().length < 2) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          city: "City must be at least 2 characters",
                        }));
                      }
                    }}
                    required
                    disabled={isProcessing}
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isProcessing
                        ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60"
                        : fieldErrors.city
                        ? "border-red-300 dark:border-red-600"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  />
                  {fieldErrors.city && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {fieldErrors.city}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Information */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="saveInfo"
              className="mt-1 mr-2"
              disabled={isProcessing}
            />
            <label
              htmlFor="saveInfo"
              className="text-xs text-slate-600 dark:text-slate-400"
            >
              Save my information for faster checkout
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pay securely at Smart Knowledge Base and everywhere Stripe is
            accepted.
          </p>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isProcessing || !isFormValid}
            className="w-full py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white font-semibold mt-3 sm:mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              `Pay ${checkoutPackage.priceFormatted}`
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
