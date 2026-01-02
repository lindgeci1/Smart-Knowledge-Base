import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Code,
  X,
} from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

interface ActivationRequest {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  userId?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

interface ActivationRequestsSectionProps {
  requests: ActivationRequest[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onRequestsFetched?: (requests: ActivationRequest[]) => void;
}

export function ActivationRequestsSection({
  requests: initialRequests,
  loading: externalLoading = false,
  onDataLoaded,
  onRequestsFetched,
}: ActivationRequestsSectionProps) {
  const [requests, setRequests] = useState<ActivationRequest[]>(
    initialRequests || []
  );
  const [filteredRequests, setFilteredRequests] = useState<ActivationRequest[]>(
    initialRequests || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [approvingRequest, setApprovingRequest] = useState<ActivationRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<ActivationRequest | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialRequests && initialRequests.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialRequests && initialRequests.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialRequests && initialRequests.length > 0) {
      setRequests(initialRequests);
      setFilteredRequests(initialRequests);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialRequests]);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await apiClient.get("/Activation/admin");
      const requestsData = response.data.map(
        (req: {
          id: string;
          email: string;
          status: string;
          userId?: string;
          createdAt: string;
          updatedAt: string;
          processedAt?: string;
        }) => ({
          id: req.id,
          email: req.email,
          status: req.status,
          userId: req.userId,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          processedAt: req.processedAt,
        })
      );

      setRequests(requestsData);
      setFilteredRequests(requestsData);
      setHasRecords(requestsData.length > 0);
      setHasLoadedOnce(true);

      if (onRequestsFetched) {
        onRequestsFetched(requestsData);
      }

      if (onDataLoaded) {
        onDataLoaded(requestsData.length > 0);
      }
    } catch (error) {
      console.error("Error fetching activation requests", error);
      toast.error("Failed to load activation requests");
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  }, [onDataLoaded, onRequestsFetched]);

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchRequests();
    }
  }, [externalLoading, hasLoadedOnce, fetchRequests]);

  // Filter requests based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRequests(requests);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = requests.filter(
      (req) =>
        req.email.toLowerCase().includes(query) ||
        req.status.toLowerCase().includes(query)
    );
    setFilteredRequests(filtered);
  }, [searchQuery, requests]);

  const handleApprove = async () => {
    if (!approvingRequest || isApproving) return;
    setIsApproving(true);
    try {
      await apiClient.post(`/Activation/admin/${approvingRequest.id}/approve`);
      setApprovingRequest(null);
      await fetchRequests();
      toast.success("Activation request approved successfully");
    } catch (error: unknown) {
      console.error("Error approving request", error);
      let errorMessage = "Failed to approve request. Please try again.";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } | string };
        };
        if (axiosError.response?.data) {
          if (typeof axiosError.response.data === "string") {
            errorMessage = axiosError.response.data;
          } else if (axiosError.response.data.message) {
            errorMessage = axiosError.response.data.message;
          }
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest || isRejecting) return;
    setIsRejecting(true);
    try {
      await apiClient.post(`/Activation/admin/${rejectingRequest.id}/reject`);
      setRejectingRequest(null);
      await fetchRequests();
      toast.success("Activation request rejected successfully");
    } catch (error: unknown) {
      console.error("Error rejecting request", error);
      let errorMessage = "Failed to reject request. Please try again.";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } | string };
        };
        if (axiosError.response?.data) {
          if (typeof axiosError.response.data === "string") {
            errorMessage = axiosError.response.data;
          } else if (axiosError.response.data.message) {
            errorMessage = axiosError.response.data.message;
          }
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <UserCheck className="h-3 w-3 mr-1" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <UserX className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  const handleDownload = (format: "excel" | "pdf" | "json") => {
    if (format === "excel" || format === "pdf") {
      const data = filteredRequests.map((req) => ({
        Email: req.email,
        Status: req.status,
        "Requested At": new Date(req.createdAt).toLocaleDateString(),
        "Processed At": req.processedAt
          ? new Date(req.processedAt).toLocaleDateString()
          : "N/A",
      }));
      downloadData(data, "activation-requests", format, format === "pdf");
    } else {
      downloadData(filteredRequests, "activation-requests", format);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Activation Requests
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchRequests();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-slate-300">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
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

      {/* Requests Table */}
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by email or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto relative flex-1">
          {showLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}
          {filteredRequests.length === 0 && !showLoading ? (
            <div className="p-12 text-center">
              <UserCheck className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">
                {searchQuery
                  ? "No activation requests match your search."
                  : "No activation requests found."}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Requested
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {request.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {request.status === "pending" && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setApprovingRequest(request)}
                              disabled={isApproving}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Approve request"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setRejectingRequest(request)}
                              disabled={isRejecting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Reject request"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {request.status !== "pending" && (
                          <span className="text-slate-400 text-xs">
                            Processed {request.processedAt ? new Date(request.processedAt).toLocaleDateString() : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {approvingRequest && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Approve Activation Request</h3>
                <button
                  onClick={() => setApprovingRequest(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to approve the activation request for{" "}
                  <span className="font-semibold text-slate-900">
                    {approvingRequest.email}
                  </span>
                  ? The account will be reactivated and the user will be able to access the system.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setApprovingRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isApproving ? "Approving..." : "Approve Request"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reject Modal */}
      {rejectingRequest && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Reject Activation Request</h3>
                <button
                  onClick={() => setRejectingRequest(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to reject the activation request for{" "}
                  <span className="font-semibold text-slate-900">
                    {rejectingRequest.email}
                  </span>
                  ? The request will be declined and the account will remain deactivated.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isRejecting ? "Rejecting..." : "Reject Request"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

