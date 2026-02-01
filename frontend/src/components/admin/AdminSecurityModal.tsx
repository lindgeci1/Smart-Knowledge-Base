import React, { useState, useEffect } from "react";
import { X, Shield, Loader2 } from "lucide-react";
import { toDataURL as qrToDataURL } from "qrcode";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";

interface AdminSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSecurityModal({ isOpen, onClose }: AdminSecurityModalProps) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetupQrUrl, setTwoFactorSetupQrUrl] = useState<string | null>(null);
  const [twoFactorSetupSecret, setTwoFactorSetupSecret] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");
  const [twoFactorStatusLoading, setTwoFactorStatusLoading] = useState(false);
  const [twoFactorQrDataUrl, setTwoFactorQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTwoFactorSetupQrUrl(null);
    setTwoFactorSetupSecret(null);
    setTwoFactorCode("");
    setDisable2FAPassword("");
    setTwoFactorStatusLoading(true);
    apiClient
      .get("/auth/2fa/status")
      .then((res) => setTwoFactorEnabled(!!res.data?.twoFactorEnabled))
      .catch(() => setTwoFactorEnabled(false))
      .finally(() => setTwoFactorStatusLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!twoFactorSetupQrUrl) {
      setTwoFactorQrDataUrl(null);
      return;
    }
    qrToDataURL(twoFactorSetupQrUrl, { width: 200, margin: 2 })
      .then(setTwoFactorQrDataUrl)
      .catch(() => setTwoFactorQrDataUrl(null));
  }, [twoFactorSetupQrUrl]);

  const handleTwoFactorSetup = async () => {
    try {
      const res = await apiClient.post("/auth/2fa/setup");
      setTwoFactorSetupQrUrl(res.data.qrCodeUrl ?? null);
      setTwoFactorSetupSecret(res.data.secretBase32 ?? null);
      setTwoFactorCode("");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to start 2FA setup";
      toast.error(msg || "Failed to start 2FA setup");
    }
  };

  const handleTwoFactorEnable = async () => {
    if (!twoFactorCode.trim() || twoFactorCode.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setIsEnabling2FA(true);
    try {
      await apiClient.post("/auth/2fa/enable", { code: twoFactorCode.trim() });
      setTwoFactorEnabled(true);
      setTwoFactorSetupQrUrl(null);
      setTwoFactorSetupSecret(null);
      setTwoFactorCode("");
      toast.success("Two-factor authentication is now enabled.");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Invalid code. Please try again.";
      toast.error(msg || "Invalid code. Please try again.");
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleTwoFactorDisable = async () => {
    if (!disable2FAPassword.trim()) {
      toast.error("Enter your password to disable 2FA.");
      return;
    }
    setIsDisabling2FA(true);
    try {
      await apiClient.post("/auth/2fa/disable", { password: disable2FAPassword });
      setTwoFactorEnabled(false);
      setDisable2FAPassword("");
      toast.success("Two-factor authentication has been disabled.");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to disable 2FA.";
      toast.error(msg || "Failed to disable 2FA.");
    } finally {
      setIsDisabling2FA(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Settings — Security</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Two-Factor Authentication
          </h4>
          {twoFactorStatusLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : twoFactorEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium">Two-factor authentication is enabled.</span>
              </div>
              <p className="text-sm text-slate-600">
                You will be asked for a 6-digit code from your authenticator app each time you sign in.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Enter your password to disable 2FA
                </label>
                <input
                  type="password"
                  value={disable2FAPassword}
                  onChange={(e) => setDisable2FAPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleTwoFactorDisable}
                  disabled={isDisabling2FA || !disable2FAPassword.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isDisabling2FA ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Disable 2FA
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Add an extra layer of security by requiring a 6-digit code from an authenticator app when you sign in.
              </p>
              {!twoFactorSetupQrUrl ? (
                <button
                  type="button"
                  onClick={handleTwoFactorSetup}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Enable two-factor authentication
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-700">
                    Scan this QR code with your authenticator app, then enter the 6-digit code below.
                  </p>
                  {twoFactorQrDataUrl && (
                    <div className="flex justify-center p-4 bg-white rounded-lg border border-slate-200">
                      <img src={twoFactorQrDataUrl} alt="2FA QR code" className="w-48 h-48" />
                    </div>
                  )}
                  {twoFactorSetupSecret && (
                    <p className="text-xs text-slate-500 break-all">
                      Or enter this key manually: <code className="bg-slate-100 px-1 rounded">{twoFactorSetupSecret}</code>
                    </p>
                  )}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">6-digit code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-slate-900 tracking-widest text-center"
                    />
                    <button
                      type="button"
                      onClick={handleTwoFactorEnable}
                      disabled={isEnabling2FA || twoFactorCode.length !== 6}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isEnabling2FA ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Confirm and enable 2FA
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
