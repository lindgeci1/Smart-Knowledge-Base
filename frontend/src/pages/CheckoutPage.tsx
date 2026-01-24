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
  Check,
  Lock
} from "lucide-react";
import { apiClient } from "../lib/authClient";
import { StripeCardElement } from "../components/StripeCardElement";
import toast from "react-hot-toast";

interface Package {
  packageId?: string;
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
  "Pro Power": "indigo",
  "Enterprise Scale": "purple",
};

const countryOptions = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "OTHER", label: "Other" },
];

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
    country?: string;
    state?: string;
    addressLine1?: string;
    postalCode?: string;
    city?: string;
  }>({});

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);
  
  const [country, setCountry] = useState("US");
  const [otherCountry, setOtherCountry] = useState("");
  const [state, setState] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    const paymentSuccess = searchParams.get("payment_success");
    if (paymentSuccess === "true") {
      toast.success("Payment successful! Your package has been activated.", {
        duration: 5000,
      });
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

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const normalizedOtherCountry = otherCountry.trim().toUpperCase();
  const selectedCountry =
    country === "OTHER" ? normalizedOtherCountry : country;
  const isCountryValid =
    (country !== "OTHER" && country.trim().length === 2) ||
    (country === "OTHER" && /^[A-Z]{2}$/.test(normalizedOtherCountry));

  const isFormValid =
    email.trim() !== "" &&
    isValidEmail(email) &&
    cardholderName.trim().length >= 2 &&
    isCountryValid &&
    state.trim().length >= 2 &&
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
      const paymentIntentResponse = await apiClient.post<{
        clientSecret: string;
        paymentIntentId: string;
      }>("/Payment/create-payment-intent", {
        packageId: checkoutPackage.packageId,
        email: email,
        billingName: cardholderName,
        billingAddress: {
          line1: addressLine1,
          line2: addressLine2 || undefined,
          city: city,
          state: state,
          postalCode: postalCode,
          country: selectedCountry,
        },
      });

      const { clientSecret, paymentIntentId } = paymentIntentResponse.data;

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
                state: state,
                postal_code: postalCode,
                country: selectedCountry,
              },
            },
          },
        });

      if (stripeError) {
        apiClient
          .post("/Payment/confirm", {
            paymentIntentId: paymentIntentId,
            packageId: checkoutPackage.packageId,
          })
          .catch((err) => console.error("Backend confirmation error:", err));
        setError(stripeError.message || "Payment failed");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        apiClient
          .post("/Payment/confirm", {
            paymentIntentId: paymentIntentId,
            packageId: checkoutPackage.packageId,
          })
          .catch((err) => console.error("Backend confirmation error:", err));

        if (checkoutPackage.summaryLimit) {
          updateUserLimit(checkoutPackage.summaryLimit);
        }

        toast.success(
          `Success! You are now subscribed to ${checkoutPackage.name}.`,
          {
            duration: 4000,
            icon: '🎉',
          }
        );

        setIsProcessing(false);
        navigate("/dashboard", { replace: true });
      } else {
        apiClient
          .post("/Payment/confirm", {
            paymentIntentId: paymentIntentId,
            packageId: checkoutPackage.packageId,
          })
          .catch((err) => console.error("Backend confirmation error:", err));
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
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-slate-900">
      {/* Left Side - Order Summary (Styled Dark/Brand) */}
      <div className="bg-slate-900 dark:bg-black text-white p-6 lg:p-12 w-full lg:w-[45%] lg:min-h-screen flex flex-col border-r border-slate-800 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="relative z-10">
           <button
             onClick={() => navigate("/packages")}
             disabled={isProcessing}
             className="flex items-center text-slate-400 hover:text-white mb-8 transition-colors group"
           >
             <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
             <span className="text-sm font-medium">Back to packages</span>
           </button>

           <div className="mb-8">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4 border border-indigo-500/30">
                <Star className="h-3 w-3 fill-indigo-300" />
                Selected Plan
             </div>
             <h2 className="text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
               {checkoutPackage.name}
             </h2>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{checkoutPackage.priceFormatted}</span>
                <span className="text-slate-400 font-medium">/ {checkoutPackage.priceType}</span>
             </div>
           </div>

           <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
             <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">What's included</h3>
             <ul className="space-y-3">
               {checkoutPackage.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-200">
                     <Check className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                     <span className="text-sm">{feature}</span>
                  </li>
               ))}
             </ul>
           </div>

           <div className="mt-auto pt-8 border-t border-slate-800">
             <div className="flex justify-between items-center text-lg font-semibold">
               <span>Total due today</span>
               <span>{checkoutPackage.priceFormatted}</span>
             </div>
           </div>
        </div>
      </div>

      {/* Right Side - Payment Form (Modern Light/Dark) */}
      <div className="flex-1 bg-white dark:bg-slate-900 p-6 lg:p-12 lg:overflow-y-auto">
        <div className="max-w-xl mx-auto">
           <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Complete your purchase</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Fill in your details below to activate your account upgrade.</p>
           </div>

           <form onSubmit={handlePayment} className="space-y-6">
             {error && (
               <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                 <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                 <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
               </div>
             )}

             <div className="space-y-4">
               <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                 Contact & Billing
               </h3>
               
               <div className="grid gap-4">
                  <div>
                     <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                     <input
                       type="email"
                       value={email}
                       readOnly
                       className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                     />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                        <input
                          type="text"
                          placeholder="Jane"
                          required
                          disabled={isProcessing}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                        <input
                          type="text"
                          placeholder="Doe"
                          required
                          disabled={isProcessing}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                     </div>
                  </div>
               </div>
             </div>

             <div className="space-y-4">
               <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider pt-2">
                 Payment Method
               </h3>
               
               <div className="border rounded-xl border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <CreditCard className="h-5 w-5" />
                     </div>
                     <span className="font-semibold text-slate-900 dark:text-white text-sm">Credit or Debit Card</span>
                  </div>
                  
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Card Information</label>
                        <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-3">
                           <StripeCardElement
                             onCardChange={(complete) => setCardComplete(complete)}
                             disabled={isProcessing}
                           />
                        </div>
                     </div>
                     
                     <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          placeholder="Name as displayed on card"
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                     </div>
                  </div>
               </div>
             </div>

             <div className="space-y-4">
               <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider pt-2">
                 Billing Address
               </h3>
               
               <div className="grid gap-4">
                  <div>
                     <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Country</label>
                     <select
                       value={country}
                       onChange={(e) => setCountry(e.target.value)}
                       className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                     >
                        {countryOptions.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                     </select>
                  </div>
                  
                  <div>
                     <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Address</label>
                     <input
                       type="text"
                       value={addressLine1}
                       onChange={(e) => setAddressLine1(e.target.value)}
                       placeholder="123 Main St"
                       required
                       className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">City</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Postal Code</label>
                        <input
                          type="text"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                     </div>
                  </div>
                  
                  <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">State / Province</label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                   </div>
               </div>
             </div>

             <Button
                type="submit"
                disabled={isProcessing || !isFormValid}
                className="w-full py-4 text-base bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none mt-6 transition-all transform active:scale-[0.99]"
             >
                {isProcessing ? (
                   <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Secure Payment...
                   </>
                ) : (
                   <div className="flex items-center justify-center gap-2">
                      <Lock className="h-4 w-4" />
                      Pay {checkoutPackage.priceFormatted}
                   </div>
                )}
             </Button>
             
             <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-center justify-center gap-2">
                <Shield className="h-3 w-3" />
                <span>Your payment information is encrypted and secure.</span>
             </div>
           </form>
        </div>
      </div>
    </div>
  );
}