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
  Sparkles
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
  "Pro Power": "indigo",
  "Enterprise Scale": "purple",
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-red-600 dark:text-red-400 mb-4 font-medium">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Upgrade Your <span className="text-indigo-600 dark:text-indigo-400">Capacity</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Choose a package to instantly increase your summarization limits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {packages.map((pkg) => {
            const Icon = iconMap[pkg.name] || Zap;
            const color = colorMap[pkg.name] || "blue";
            const isPopular = pkg.isPopular;

            return (
              <div
                key={pkg.packageId}
                className={`
                   relative bg-white dark:bg-slate-800 rounded-2xl p-8 flex flex-col transition-all duration-300
                   ${isPopular 
                      ? "border-2 border-indigo-500 dark:border-indigo-400 shadow-xl shadow-indigo-100 dark:shadow-none scale-105 z-10" 
                      : "border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:-translate-y-1"
                   }
                `}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 left-0 -mt-4 flex justify-center">
                     <span className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide flex items-center gap-1 shadow-md">
                        <Sparkles className="h-3 w-3 fill-white" />
                        Most Popular
                     </span>
                  </div>
                )}

                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${
                    color === "blue"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                      : color === "indigo"
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                      : "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                </div>

                <h3 className={`text-2xl font-bold ${isPopular ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-white"}`}>
                  {pkg.name}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">{pkg.description}</p>

                <div className="mt-8 flex items-baseline">
                  <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
                    ${pkg.price}
                  </span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400 font-medium">/ {pkg.priceType}</span>
                </div>

                <div className="my-8 border-t border-slate-100 dark:border-slate-700" />

                <ul className="space-y-4 flex-1">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <div className={`mt-0.5 mr-3 p-0.5 rounded-full ${isPopular ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                         <Check className="h-3 w-3" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePurchase(pkg.packageId!)}
                  className={`mt-8 w-full py-4 text-base h-auto shadow-lg ${
                    isPopular 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none" 
                      : "bg-white dark:bg-slate-700 !text-slate-900 dark:!text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-slate-100 dark:shadow-none"
                  }`}
                >
                  <CreditCard className={`mr-2 h-5 w-5 ${!isPopular ? "text-slate-900 dark:text-white" : ""}`} />
                  {isPopular ? "Get Started Now" : "Choose Plan"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
             <Shield className="h-4 w-4" />
             Secure payments processed by Stripe. 30-day money-back guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}