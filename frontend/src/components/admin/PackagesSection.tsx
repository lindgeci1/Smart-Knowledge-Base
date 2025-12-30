import React, { useState, useEffect } from "react";
import { Package, Trash2, X, Search, Star, RotateCcw, RefreshCw, Download, FileSpreadsheet, FileText, Code } from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

interface PackageData {
  id?: string;
  name: string;
  description: string;
  price: number;
  priceType: string;
  summaryLimit: number | null;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PackagesSectionProps {
  packages: PackageData[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onPackagesFetched?: (packages: PackageData[]) => void;
}

export function PackagesSection({
  packages: initialPackages,
  loading: externalLoading = false,
  onDataLoaded,
  onPackagesFetched,
}: PackagesSectionProps) {
  const [packages, setPackages] = useState<PackageData[]>(initialPackages || []);
  const [filteredPackages, setFilteredPackages] = useState<PackageData[]>(
    initialPackages || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingPackage, setDeletingPackage] = useState<PackageData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reactivatingPackage, setReactivatingPackage] = useState<PackageData | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialPackages && initialPackages.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialPackages && initialPackages.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialPackages && initialPackages.length > 0) {
      setPackages(initialPackages);
      setFilteredPackages(initialPackages);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialPackages]);

  // Filter packages based on search query (by name)
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPackages(packages);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = packages.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(query) ||
          pkg.description.toLowerCase().includes(query)
      );
      setFilteredPackages(filtered);
    }
  }, [searchQuery, packages]);

  const fetchPackages = async () => {
    try {
      const response = await apiClient.get("/Package/admin");
      const packagesData = response.data.map((pkg: any) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        priceType: pkg.priceType,
        summaryLimit: pkg.summaryLimit,
        features: pkg.features || [],
        isPopular: pkg.isPopular || false,
        isActive: pkg.isActive !== undefined ? pkg.isActive : true,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      }));
      setPackages(packagesData);
      setFilteredPackages(packagesData);
      const hasData = packagesData.length > 0;
      setHasRecords(hasData);
      setHasLoadedOnce(true);
      if (onDataLoaded) {
        onDataLoaded(hasData);
      }
      if (onPackagesFetched) {
        onPackagesFetched(packagesData);
      }
    } catch (error) {
      console.error("Error fetching packages", error);
      setHasLoadedOnce(true);
      setHasRecords(false);
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  const handleDelete = async () => {
    if (!deletingPackage || isDeleting || !deletingPackage.id) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Package/admin/${deletingPackage.id}`);
      setDeletingPackage(null);
      // Refresh packages list to get updated status
      await fetchPackages();
      toast.success("Package deactivated successfully");
    } catch (error) {
      console.error("Error deactivating package", error);
      toast.error("Failed to deactivate package. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivatingPackage || isReactivating || !reactivatingPackage.id) return;
    setIsReactivating(true);
    try {
      await apiClient.post(`/Package/admin/${reactivatingPackage.id}/reactivate`);
      setReactivatingPackage(null);
      // Refresh packages list to get updated status
      await fetchPackages();
      toast.success("Package reactivated successfully");
    } catch (error) {
      console.error("Error reactivating package", error);
      toast.error("Failed to reactivate package. Please try again.");
    } finally {
      setIsReactivating(false);
    }
  };

  // Show loading overlay only if we're loading and we know there are records
  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Package Management</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchPackages();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-slate-300">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <button
              onClick={() => downloadData(
                filteredPackages.map(p => ({
                  Name: p.name,
                  Description: p.description,
                  Price: `$${p.price}`,
                  "Price Type": p.priceType,
                  "Summary Limit": p.summaryLimit || "Unlimited",
                  "Is Popular": p.isPopular ? "Yes" : "No",
                  Status: p.isActive ? "Active" : "Inactive",
                  "Created At": new Date(p.createdAt).toLocaleString(),
                })),
                "packages",
                "excel"
              )}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span>Excel (CSV)</span>
            </button>
            <button
              onClick={() => downloadData(
                filteredPackages.map(p => ({
                  Name: p.name,
                  Description: p.description,
                  Price: `$${p.price}`,
                  "Price Type": p.priceType,
                  "Summary Limit": p.summaryLimit || "Unlimited",
                  "Is Popular": p.isPopular ? "Yes" : "No",
                  Status: p.isActive ? "Active" : "Inactive",
                  "Created At": new Date(p.createdAt).toLocaleString(),
                })),
                "packages",
                "pdf",
                true
              )}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-red-600" />
              <span>PDF (Text)</span>
            </button>
            <button
              onClick={() => downloadData(filteredPackages, "packages", "json")}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-md"
            >
              <Code className="h-4 w-4 text-blue-600" />
              <span>JSON</span>
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deactivate Modal */}
      {deletingPackage && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Deactivate Package</h3>
              <button
                onClick={() => setDeletingPackage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-slate-900">
                  {deletingPackage.name}
                </span>
                ? This package will no longer be available for purchase, but will remain in the database.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingPackage(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deactivating..." : "Deactivate Package"}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Reactivate Modal */}
      {reactivatingPackage && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Reactivate Package</h3>
              <button
                onClick={() => setReactivatingPackage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to reactivate{" "}
                <span className="font-semibold text-slate-900">
                  {reactivatingPackage.name}
                </span>
                ? This package will be available for purchase again.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setReactivatingPackage(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReactivate}
                disabled={isReactivating}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isReactivating ? "Reactivating..." : "Reactivate Package"}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search packages by name or description..."
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
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Package
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Summary Limit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPackages.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    {searchQuery.trim() === ""
                      ? "No packages found"
                      : "No packages match your search"}
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-4 w-4 text-indigo-600 mr-2" />
                        <div>
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-slate-900">
                              {pkg.name}
                            </span>
                            {pkg.isPopular && (
                              <Star className="h-4 w-4 text-yellow-500 ml-2 fill-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {pkg.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        ${pkg.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        {pkg.priceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-900">
                        {pkg.summaryLimit ? `+${pkg.summaryLimit}` : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          pkg.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {pkg.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!pkg.isActive ? (
                        <button
                          onClick={() => setReactivatingPackage(pkg)}
                          disabled={isReactivating}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          title="Reactivate package"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeletingPackage(pkg)}
                          className="text-red-600 hover:text-red-900"
                          title="Deactivate package"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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

