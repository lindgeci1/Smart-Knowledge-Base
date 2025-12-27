import React, { useMemo, useState } from "react";
import {
  useStripe,
  useElements,
  CardElement,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import { CreditCard } from "lucide-react";

interface StripeCardElementProps {
  onCardChange?: (complete: boolean, brand?: string) => void;
  disabled?: boolean;
}

export function StripeCardElement({
  onCardChange,
  disabled = false,
}: StripeCardElementProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardBrand, setCardBrand] = useState<string | null>(null);

  const cardElementOptions = useMemo(
    () => ({
      style: {
        base: {
          fontSize: "16px",
          color: "#1e293b",
          "::placeholder": {
            color: "#94a3b8",
          },
          fontFamily: "system-ui, -apple-system, sans-serif",
        },
        invalid: {
          color: "#ef4444",
          iconColor: "#ef4444",
        },
      },
      hidePostalCode: true,
    }),
    []
  );

  const handleCardChange = (event: any) => {
    const brand = event.brand || null;
    setCardBrand(brand);

    if (onCardChange) {
      onCardChange(event.complete, brand);
    }
  };

  const getCardLogo = () => {
    if (!cardBrand) return null;

    const brandLower = cardBrand.toLowerCase();

    // Visa
    if (brandLower === "visa") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#1A1F71] rounded px-2 shadow-sm">
          <span className="text-white text-[10px] font-bold tracking-wide">
            VISA
          </span>
        </div>
      );
    }

    // Mastercard - Overlapping circles logo
    if (brandLower === "mastercard") {
      return (
        <div className="relative w-12 h-7 flex items-center justify-center">
          <svg width="32" height="20" viewBox="0 0 32 20" className="shadow-sm">
            {/* Red circle (left) */}
            <circle cx="10" cy="10" r="8" fill="#EB001B" />
            {/* Orange circle (right) */}
            <circle cx="22" cy="10" r="8" fill="#F79E1B" />
          </svg>
        </div>
      );
    }

    // American Express
    if (brandLower === "amex" || brandLower === "american_express") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#006FCF] rounded px-1.5 shadow-sm">
          <span className="text-white text-[9px] font-bold tracking-tight">
            AMEX
          </span>
        </div>
      );
    }

    // Discover
    if (brandLower === "discover") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#FF6000] rounded px-1.5 shadow-sm">
          <span className="text-white text-[9px] font-bold">DISC</span>
        </div>
      );
    }

    // Diners Club
    if (brandLower === "diners" || brandLower === "diners_club") {
      return (
        <div className="flex items-center justify-center w-12 h-7 bg-[#0079BE] rounded px-1.5 shadow-sm">
          <span className="text-white text-[8px] font-bold">DINERS</span>
        </div>
      );
    }

    // JCB
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
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Card information
        </label>
        <div className="relative">
          <div className={`px-4 py-3 border rounded-lg transition-colors ${
            disabled 
              ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed" 
              : "border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          }`}>
            <CardNumberElement
              options={cardElementOptions}
              onChange={handleCardChange}
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
          <label className="block text-xs font-medium text-slate-700 mb-2">
            MM / YY
          </label>
          <div className="relative">
            <div className={`px-4 py-3 border rounded-lg transition-colors ${
              disabled 
                ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed" 
                : "border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            }`}>
              <CardExpiryElement
                options={cardElementOptions}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">
            CVC
          </label>
          <div className="relative">
            <div className={`px-4 py-3 border rounded-lg transition-colors ${
              disabled 
                ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed" 
                : "border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            }`}>
              <CardCvcElement
                options={cardElementOptions}
                disabled={disabled}
              />
            </div>
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
