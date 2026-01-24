import React, { useMemo, useState, useEffect } from "react";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  StripeElementChangeEvent,
} from "@stripe/react-stripe-js";
import { CreditCard } from "lucide-react";

interface StripeCardElementProps {
  onCardChange?: (complete: boolean, brand?: string) => void;
  disabled?: boolean;
  error?: string;
}

export function StripeCardElement({
  onCardChange,
  disabled = false,
  error
}: StripeCardElementProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  // Track state of all three elements individually
  const [elementStates, setElementStates] = useState({
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false,
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const cardElementOptions = useMemo(
    () => ({
      style: {
        base: {
          fontSize: "16px",
          color: isDark ? "#f1f5f9" : "#1e293b",
          "::placeholder": {
            color: isDark ? "#64748b" : "#94a3b8",
          },
          fontFamily: "system-ui, -apple-system, sans-serif",
        },
        invalid: {
          color: "#ef4444",
          iconColor: "#ef4444",
        },
      },
      // FIX: Removed 'placeholder: ""' to allow default Stripe placeholders to show
    }),
    [isDark]
  );

  const handleElementChange = (elementType: 'cardNumber' | 'cardExpiry' | 'cardCvc') => (event: StripeElementChangeEvent) => {
    if (elementType === 'cardNumber' && event.brand) {
        setCardBrand(event.brand);
    }

    setElementStates(prev => {
        const newState = { ...prev, [elementType]: event.complete };
        
        // Notify parent only if status changes
        if (onCardChange) {
            const allComplete = newState.cardNumber && newState.cardExpiry && newState.cardCvc;
            onCardChange(allComplete, event.brand);
        }
        return newState;
    });
  };

  const getCardLogo = () => {
    if (!cardBrand) return null;
    const brandLower = cardBrand.toLowerCase();

    if (brandLower === "visa") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#1A1F71] rounded px-2 shadow-sm">
          <span className="text-white text-[10px] font-bold tracking-wide">VISA</span>
        </div>
      );
    }
    if (brandLower === "mastercard") {
      return (
        <div className="relative w-12 h-7 flex items-center justify-center">
          <svg width="32" height="20" viewBox="0 0 32 20" className="shadow-sm">
            <circle cx="10" cy="10" r="8" fill="#EB001B" />
            <circle cx="22" cy="10" r="8" fill="#F79E1B" />
          </svg>
        </div>
      );
    }
    if (brandLower === "amex" || brandLower === "american_express") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#006FCF] rounded px-1.5 shadow-sm">
          <span className="text-white text-[9px] font-bold tracking-tight">AMEX</span>
        </div>
      );
    }
    if (brandLower === "discover") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#FF6000] rounded px-1.5 shadow-sm">
          <span className="text-white text-[9px] font-bold">DISC</span>
        </div>
      );
    }
    if (brandLower === "jcb") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#0E4C96] rounded px-1.5 shadow-sm">
          <span className="text-white text-[10px] font-bold">JCB</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
          Card Number
        </label>
        <div className="relative">
          <div className={`px-4 py-3 border rounded-lg bg-white dark:bg-slate-800 transition-colors ${
            disabled 
              ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 opacity-60 cursor-not-allowed" 
              : error 
                ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500/20" 
                : "border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          }`}>
            <CardNumberElement
              options={{...cardElementOptions, showIcon: false}} // We use custom icon
              onChange={handleElementChange('cardNumber')}
              disabled={disabled}
            />
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none z-20">
            {cardBrand && getCardLogo()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Expiration (MM / YY)
          </label>
          <div className={`px-4 py-3 border rounded-lg bg-white dark:bg-slate-800 transition-colors ${
            disabled 
              ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 opacity-60 cursor-not-allowed" 
              : error 
                ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500/20" 
                : "border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          }`}>
            <CardExpiryElement
              options={cardElementOptions}
              onChange={handleElementChange('cardExpiry')}
              disabled={disabled}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            CVC
          </label>
          <div className="relative">
            <div className={`px-4 py-3 border rounded-lg bg-white dark:bg-slate-800 transition-colors ${
              disabled 
                ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 opacity-60 cursor-not-allowed" 
                : error 
                  ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500/20" 
                  : "border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            }`}>
              <CardCvcElement
                options={cardElementOptions}
                onChange={handleElementChange('cardCvc')}
                disabled={disabled}
              />
            </div>
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none z-20" />
          </div>
        </div>
      </div>
      {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}