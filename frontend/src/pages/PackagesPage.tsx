import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  Check,
  Zap,
  Shield,
  Star,
  ArrowLeft,
  CreditCard,
  Loader2,
} from "lucide-react";
import { apiClient } from "../lib/authClient";

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

export function PackagesPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<Package[]>("/Package");
        setPackages(response.data);
      } catch (err: any) {
        console.error("Failed to fetch packages:", err);
        setError("Failed to load packages. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = (packageId: string) => {
    navigate(`/checkout/${packageId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
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
          {packages.map((pkg) => {
            const Icon = iconMap[pkg.name] || Zap;
            const color = colorMap[pkg.name] || "blue";
            const isPopular = pkg.isPopular;

            return (
              <div
                key={pkg.packageId}
                className={`relative bg-white rounded-2xl shadow-lg border ${
                  isPopular
                    ? "border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
                    : "border-slate-200"
                } p-8 flex flex-col transition-transform hover:-translate-y-1 duration-300`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 -mt-4 mr-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Most Popular
                  </div>
                )}

                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                    color === "blue"
                      ? "bg-blue-100"
                      : color === "purple"
                      ? "bg-purple-100"
                      : color === "indigo"
                      ? "bg-indigo-100"
                      : "bg-slate-100"
                  }`}
                >
                  <Icon
                    className={`h-6 w-6 ${
                      color === "blue"
                        ? "text-blue-600"
                        : color === "purple"
                        ? "text-purple-600"
                        : color === "indigo"
                        ? "text-indigo-600"
                        : "text-slate-600"
                    }`}
                  />
                </div>

                <h3 className="text-2xl font-bold text-slate-900">
                  {pkg.name}
                </h3>
                <p className="text-slate-500 mt-2">{pkg.description}</p>

                <div className="mt-6 flex items-baseline">
                  <span className="text-4xl font-extrabold text-slate-900">
                    ${pkg.price}
                  </span>
                  <span className="ml-2 text-slate-500">/ {pkg.priceType}</span>
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
                  onClick={() => handlePurchase(pkg.packageId!)}
                  className={`mt-8 w-full py-6 text-lg ${
                    isPopular ? "bg-blue-600 hover:bg-blue-700" : ""
                  }`}
                  variant={isPopular ? "primary" : "outline"}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Purchase Now
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-slate-500">
          <p>
            Secure payments processed by Stripe. 30-day money-back guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}
