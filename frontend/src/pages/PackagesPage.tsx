import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Check, Zap, Shield, Star, ArrowLeft, CreditCard, Loader2, X, Lock } from 'lucide-react';
const packages = [{
  id: 'starter',
  name: 'Starter Boost',
  limit: 50,
  price: '$9',
  priceValue: 9,
  description: 'Perfect for small projects',
  features: ['+50 Summaries', 'Basic Support', 'Standard Processing'],
  icon: Zap,
  color: 'blue'
}, {
  id: 'pro',
  name: 'Pro Power',
  limit: 200,
  price: '$29',
  priceValue: 29,
  description: 'Best value for professionals',
  features: ['+200 Summaries', 'Priority Support', 'Faster Processing', 'Advanced Analytics'],
  icon: Star,
  color: 'purple',
  popular: true
}, {
  id: 'enterprise',
  name: 'Enterprise Scale',
  limit: 1000,
  price: '$99',
  priceValue: 99,
  description: 'For heavy duty usage',
  features: ['+1000 Summaries', '24/7 Support', 'Instant Processing', 'API Access'],
  icon: Shield,
  color: 'indigo'
}];
export function PackagesPage() {
  const {
    updateUserLimit,
    user
  } = useAuth();
  const navigate = useNavigate();
  const [checkoutPackage, setCheckoutPackage] = useState<(typeof packages)[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const handleOpenCheckout = (pkg: (typeof packages)[0]) => {
    setCheckoutPackage(pkg);
  };
  const handleCloseCheckout = () => {
    setCheckoutPackage(null);
    setCardNumber('');
    setExpiry('');
    setCvc('');
  };
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPackage) return;
    setIsProcessing(true);
    // Simulate Stripe payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Apply the package
    updateUserLimit(checkoutPackage.limit);
    setIsProcessing(false);
    handleCloseCheckout();
    // Redirect to dashboard
    navigate('/dashboard');
  };
  return <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 pl-0 hover:pl-2 transition-all">
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
          {packages.map(pkg => <div key={pkg.id} className={`relative bg-white rounded-2xl shadow-lg border ${pkg.popular ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-slate-200'} p-8 flex flex-col transition-transform hover:-translate-y-1 duration-300`}>
              {pkg.popular && <div className="absolute top-0 right-0 -mt-4 mr-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Most Popular
                </div>}

              <div className={`w-12 h-12 rounded-xl bg-${pkg.color}-100 flex items-center justify-center mb-6`}>
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
                {pkg.features.map((feature, index) => <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-slate-600">{feature}</span>
                  </li>)}
              </ul>

              <Button onClick={() => handleOpenCheckout(pkg)} className={`mt-8 w-full py-6 text-lg ${pkg.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`} variant={pkg.popular ? 'primary' : 'outline'}>
                <CreditCard className="mr-2 h-5 w-5" />
                Purchase Now
              </Button>
            </div>)}
        </div>

        <div className="mt-12 text-center text-sm text-slate-500">
          <p>
            Secure payments processed by Stripe. 30-day money-back guarantee.
          </p>
        </div>
      </div>

      {/* Stripe Checkout Modal */}
      {checkoutPackage && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="border-b border-slate-200 p-6 flex justify-between items-center">
              <div className="flex items-center">
                <div className="bg-blue-600 rounded p-2 mr-3">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Secure Checkout
                  </h3>
                  <p className="text-xs text-slate-500">Powered by Stripe</p>
                </div>
              </div>
              <button onClick={handleCloseCheckout} disabled={isProcessing} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Package Summary */}
            <div className="bg-slate-50 p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-500">Package</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {checkoutPackage.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {checkoutPackage.price}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Card Number
                </label>
                <input type="text" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={e => setCardNumber(e.target.value)} maxLength={19} className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" required disabled={isProcessing} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expiry
                  </label>
                  <input type="text" placeholder="MM / YY" value={expiry} onChange={e => setExpiry(e.target.value)} maxLength={7} className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" required disabled={isProcessing} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    CVC
                  </label>
                  <input type="text" placeholder="123" value={cvc} onChange={e => setCvc(e.target.value)} maxLength={3} className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" required disabled={isProcessing} />
                </div>
              </div>

              <Button type="submit" disabled={isProcessing} className="w-full py-4 text-base bg-blue-600 hover:bg-blue-700 mt-6">
                {isProcessing ? <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Payment...
                  </> : <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pay {checkoutPackage.price}
                  </>}
              </Button>

              <p className="text-xs text-center text-slate-500 mt-4">
                Your payment information is secure and encrypted
              </p>
            </form>
          </div>
        </div>}
    </div>;
}