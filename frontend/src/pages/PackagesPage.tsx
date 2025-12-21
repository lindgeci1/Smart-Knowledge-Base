import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import {
  Check,
  Zap,
  Shield,
  Star,
  ArrowLeft,
  CreditCard,
  Loader2,
  X,
  Info,
} from "lucide-react";
const packages = [
  {
    id: "starter",
    name: "Starter Boost",
    limit: 50,
    price: "$9",
    priceValue: 9,
    description: "Perfect for small projects",
    features: ["+50 Summaries", "Basic Support", "Standard Processing"],
    icon: Zap,
    color: "blue",
  },
  {
    id: "pro",
    name: "Pro Power",
    limit: 200,
    price: "$29",
    priceValue: 29,
    description: "Best value for professionals",
    features: [
      "+200 Summaries",
      "Priority Support",
      "Faster Processing",
      "Advanced Analytics",
    ],
    icon: Star,
    color: "purple",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise Scale",
    limit: 1000,
    price: "$99",
    priceValue: 99,
    description: "For heavy duty usage",
    features: [
      "+1000 Summaries",
      "24/7 Support",
      "Instant Processing",
      "API Access",
    ],
    icon: Shield,
    color: "indigo",
  },
];
export function PackagesPage() {
  const { updateUserLimit, user } = useAuth();
  const navigate = useNavigate();
  const [checkoutPackage, setCheckoutPackage] = useState<
    (typeof packages)[0] | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [country, setCountry] = useState("United States");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const handleOpenCheckout = (pkg: (typeof packages)[0]) => {
    setCheckoutPackage(pkg);
  };
  const handleCloseCheckout = () => {
    setCheckoutPackage(null);
    setCardNumber("");
    setExpiry("");
    setCvc("");
    setCardholderName("");
    setAddressLine1("");
    setAddressLine2("");
    setPostalCode("");
    setCity("");
  };
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPackage) return;
    setIsProcessing(true);
    // Simulate Stripe payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Apply the package
    updateUserLimit(checkoutPackage.limit);
    setIsProcessing(false);
    handleCloseCheckout();
    // Redirect to dashboard
    navigate("/dashboard");
  };
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4 pl-0 hover:pl-2 transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Upgrade Your Capacity
            </h1>
            <p className="text-xl text-slate-600">
              Choose a package to instantly increase your summarization limits.
              Secure payment powered by Stripe.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-2xl shadow-lg border ${
                pkg.popular
                  ? "border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
                  : "border-slate-200"
              } p-8 flex flex-col transition-transform hover:-translate-y-1 duration-300`}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0 -mt-4 mr-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Most Popular
                </div>
              )}

              <div
                className={`w-12 h-12 rounded-xl bg-${pkg.color}-100 flex items-center justify-center mb-6`}
              >
                <pkg.icon className={`h-6 w-6 text-${pkg.color}-600`} />
              </div>

              <h3 className="text-2xl font-bold text-slate-900">{pkg.name}</h3>
              <p className="text-slate-500 mt-2">{pkg.description}</p>

              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold text-slate-900">
                  {pkg.price}
                </span>
                <span className="ml-2 text-slate-500">/ one-time</span>
              </div>

              <ul className="mt-8 space-y-4 flex-1">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleOpenCheckout(pkg)}
                className={`mt-8 w-full py-6 text-lg ${
                  pkg.popular ? "bg-blue-600 hover:bg-blue-700" : ""
                }`}
                variant={pkg.popular ? "primary" : "outline"}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Purchase Now
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-slate-500">
          <p>
            Secure payments processed by Stripe. 30-day money-back guarantee.
          </p>
        </div>
      </div>

      {/* Stripe Checkout Modal - ChatGPT Style */}
      {checkoutPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-3 overflow-hidden">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full flex flex-col lg:flex-row max-h-[90vh] overflow-hidden">
            {/* Left Side - Order Summary (Dark) */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 lg:p-6 flex flex-col lg:w-2/5 rounded-t-lg lg:rounded-l-lg lg:rounded-tr-none overflow-y-auto">
              {/* Back Button */}
              <button
                onClick={handleCloseCheckout}
                disabled={isProcessing}
                className="flex items-center text-slate-400 hover:text-white mb-3 sm:mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="text-sm">Back</span>
              </button>

              {/* Package Title */}
              <div className="mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
                  Subscribe to {checkoutPackage.name}
                </h2>
                <p className="text-xl sm:text-2xl font-bold">
                  {checkoutPackage.price}
                  <span className="text-xs sm:text-sm font-normal text-slate-400 ml-2">
                    one-time
                  </span>
                </p>
              </div>

              {/* Package Details */}
              <div className="mb-3 sm:mb-4 flex-1">
                <div className="flex items-start mb-3 sm:mb-4">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${
                      checkoutPackage.color === "blue"
                        ? "bg-blue-600"
                        : checkoutPackage.color === "purple"
                        ? "bg-purple-600"
                        : checkoutPackage.color === "indigo"
                        ? "bg-indigo-600"
                        : "bg-slate-600"
                    }`}
                  >
                    <checkoutPackage.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base mb-1">
                      {checkoutPackage.name}
                    </h3>
                    <p className="text-slate-400 text-xs mb-1">
                      {checkoutPackage.description}
                    </p>
                    <p className="text-slate-500 text-[10px] sm:text-xs">
                      One-time payment
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-xs sm:text-sm">
                      {checkoutPackage.price}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-slate-700 pt-3 sm:pt-4 space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Subtotal</span>
                    <span>{checkoutPackage.price}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center">
                      <span className="text-slate-400">Tax</span>
                      <Info className="h-3 w-3 ml-1 text-slate-500" />
                    </div>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-semibold pt-2 sm:pt-3 border-t border-slate-700">
                    <span>Total due today</span>
                    <span>{checkoutPackage.price}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Payment Form (Light) */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 flex flex-col lg:w-3/5 rounded-b-lg lg:rounded-r-lg lg:rounded-bl-none overflow-y-auto">
              <button
                onClick={handleCloseCheckout}
                disabled={isProcessing}
                className="lg:hidden ml-auto mb-2 sm:mb-3 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>

              <form onSubmit={handlePayment} className="space-y-3 sm:space-y-4">
                {/* Contact Information */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 mb-1.5 sm:mb-2">
                    Contact information
                  </h3>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 mb-1.5 sm:mb-2">
                    Payment method
                  </h3>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center p-2.5 sm:p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        paymentMethod === "card"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        checked={paymentMethod === "card"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-2"
                        disabled={isProcessing}
                      />
                      <CreditCard className="h-4 w-4 mr-2 text-slate-600" />
                      <span className="font-medium text-sm">Card</span>
                    </label>
                  </div>

                  {/* Card Information */}
                  {paymentMethod === "card" && (
                    <div className="mt-2 sm:mt-3 space-y-2.5 sm:space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Card information
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="1234 1234 1234 1234"
                            value={cardNumber}
                            onChange={(e) => {
                              const value = e.target.value
                                .replace(/\s/g, "")
                                .replace(/(.{4})/g, "$1 ")
                                .trim();
                              setCardNumber(value);
                            }}
                            maxLength={19}
                            required
                            disabled={isProcessing}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-16"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            <span className="text-[10px] font-semibold text-blue-600">
                              VISA
                            </span>
                            <span className="text-[10px] font-semibold text-orange-500">
                              MC
                            </span>
                            <span className="text-[10px] font-semibold text-blue-500">
                              AMEX
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            MM / YY
                          </label>
                          <input
                            type="text"
                            placeholder="MM / YY"
                            value={expiry}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, "");
                              if (value.length >= 2) {
                                value =
                                  value.slice(0, 2) + " / " + value.slice(2, 4);
                              }
                              setExpiry(value);
                            }}
                            maxLength={7}
                            required
                            disabled={isProcessing}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            CVC
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="123"
                              value={cvc}
                              onChange={(e) =>
                                setCvc(
                                  e.target.value.replace(/\D/g, "").slice(0, 3)
                                )
                              }
                              maxLength={3}
                              required
                              disabled={isProcessing}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <CreditCard className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Cardholder name
                        </label>
                        <input
                          type="text"
                          placeholder="Full name on card"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          required
                          disabled={isProcessing}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing Address */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 mb-1.5 sm:mb-2">
                    Billing address
                  </h3>
                  <div className="space-y-2.5 sm:space-y-3">
                    <div>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                        onChange={(e) => setAddressLine1(e.target.value)}
                        required
                        disabled={isProcessing}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Address line 2 (optional)"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Postal code"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          required
                          disabled={isProcessing}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="City"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          disabled={isProcessing}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Information */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="saveInfo"
                    className="mt-0.5 mr-2"
                    disabled={isProcessing}
                  />
                  <label htmlFor="saveInfo" className="text-xs text-slate-600">
                    Save my information for faster checkout
                  </label>
                </div>
                <p className="text-[10px] text-slate-500">
                  Pay securely at Smart Knowledge Base and everywhere Stripe is
                  accepted.
                </p>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 sm:py-3 text-sm bg-slate-900 hover:bg-slate-800 text-white font-semibold mt-3 sm:mt-4"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    `Pay ${checkoutPackage.price}`
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
