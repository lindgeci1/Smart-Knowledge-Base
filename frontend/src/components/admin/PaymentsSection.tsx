import React, { useState, useEffect } from "react";
import { Search, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { apiClient } from "../../lib/authClient";

interface PaymentData {
  userId: string;
  packageId: string;
  packageName: string;
  amount: number;
  currency: string;
  status: string;
  declineReason?: string;
  paymentMethod: string;
  billingEmail?: string;
  billingName?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  createdAt: string;
  paidAt?: string;
}

interface PaymentsSectionProps {
  payments: PaymentData[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onPaymentsFetched?: (payments: PaymentData[]) => void;
}

export function PaymentsSection({
  payments: initialPayments,
  loading: externalLoading = false,
  onDataLoaded,
  onPaymentsFetched,
}: PaymentsSectionProps) {
  const [payments, setPayments] = useState<PaymentData[]>(
    initialPayments || []
  );
  const [filteredPayments, setFilteredPayments] = useState<PaymentData[]>(
    initialPayments || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialPayments && initialPayments.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialPayments && initialPayments.length > 0
  );

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialPayments && initialPayments.length > 0) {
      setPayments(initialPayments);
      setFilteredPayments(initialPayments);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialPayments]);

  // Filter payments based on search query (by user email, package name, or status)
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPayments(payments);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = payments.filter(
        (payment) =>
          payment.billingEmail?.toLowerCase().includes(query) ||
          payment.packageName?.toLowerCase().includes(query) ||
          payment.status?.toLowerCase().includes(query) ||
          payment.billingName?.toLowerCase().includes(query)
      );
      setFilteredPayments(filtered);
    }
  }, [searchQuery, payments]);

  const fetchPayments = async () => {
    try {
      const response = await apiClient.get("/Payment/admin");
      const paymentsData = response.data.map((payment: any) => ({
        userId: payment.userId,
        packageId: payment.packageId,
        packageName: payment.packageName || "Unknown Package",
        amount: payment.amount,
        currency: payment.currency || "USD",
        status: payment.status,
        declineReason: payment.declineReason,
        paymentMethod: payment.paymentMethod || "card",
        billingEmail: payment.billingEmail,
        billingName: payment.billingName,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        stripeChargeId: payment.stripeChargeId,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
      }));
      setPayments(paymentsData);
      setFilteredPayments(paymentsData);
      const hasData = paymentsData.length > 0;
      setHasRecords(hasData);
      setHasLoadedOnce(true);
      if (onDataLoaded) {
        onDataLoaded(hasData);
      }
      if (onPaymentsFetched) {
        onPaymentsFetched(paymentsData);
      }
    } catch (error) {
      console.error("Error fetching payments", error);
      setHasLoadedOnce(true);
      setHasRecords(false);
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "incomplete":
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "succeeded":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "incomplete":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };

  // Show loading overlay only if we're loading and we know there are records
  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Payment Management
        </h2>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search payments by email, package, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
          </div>
        </div>
        <div className="overflow-x-auto relative">
          {showLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Package
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Decline Reason
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPayments.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    {searchQuery.trim() === ""
                      ? "No payments found"
                      : "No payments match your search"}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment, index) => (
                  <tr
                    key={`${payment.userId}-${payment.createdAt}-${index}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        {payment.packageName}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-slate-900">
                          {payment.billingName || "N/A"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {payment.billingEmail || "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        {payment.currency} {payment.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(payment.status)}
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            payment.status
                          )}`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {payment.paidAt
                        ? formatDate(payment.paidAt)
                        : payment.createdAt
                        ? formatDate(payment.createdAt)
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs text-slate-500 capitalize">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs ${
                          payment.declineReason
                            ? "text-red-600 font-medium"
                            : "text-slate-400"
                        }`}
                      >
                        {payment.declineReason || "—"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
