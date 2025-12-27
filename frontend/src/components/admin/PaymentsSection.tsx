import React, { useState, useEffect } from "react";
import { Search, RefreshCw, Download, FileSpreadsheet, FileText, Code } from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

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
  refundedAt?: string;
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
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        refundedAt: payment.refundedAt,
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "succeeded":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "incomplete":
        return "bg-gray-100 text-gray-800";
      case "refunded":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDownload = (format: "excel" | "pdf" | "json") => {
    const data = filteredPayments.map((payment) => ({
      Package: payment.packageName,
      Customer: payment.billingName || "N/A",
      Email: payment.billingEmail || "N/A",
      Amount: `${payment.currency} ${payment.amount.toFixed(2)}`,
      Status: payment.status,
      "Payment Date": payment.paidAt
        ? formatDate(payment.paidAt)
        : payment.createdAt
        ? formatDate(payment.createdAt)
        : "N/A",
      "Refund Date": payment.refundedAt ? formatDate(payment.refundedAt) : "—",
      Method: payment.paymentMethod,
      "Decline Reason": payment.declineReason || "—",
    }));
    downloadData(data, "payments", format);
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
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">
            Payment Management
          </h2>
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchPayments();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-slate-300">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleDownload("excel")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>Excel (CSV)</span>
              </button>
              <button
                onClick={() => handleDownload("pdf")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-red-600" />
                <span>PDF (Text)</span>
              </button>
              <button
                onClick={() => handleDownload("json")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-md"
              >
                <Code className="h-4 w-4 text-blue-600" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Refund Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPayments.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={8}
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
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          payment.status
                        )}`}
                      >
                        {payment.status}
                      </span>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {payment.refundedAt ? formatDate(payment.refundedAt) : "—"}
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
