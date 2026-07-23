"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Building2, Lock, User, ArrowLeft, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [fpPhone, setFpPhone] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPw, setFpNewPw] = useState("");
  const [fpStep, setFpStep] = useState<"phone" | "reset" | "done">("phone");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpDevOtp, setFpDevOtp] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(username, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp() {
    setFpError("");
    if (!fpPhone.trim()) { setFpError("Enter your mobile number"); return; }
    setFpLoading(true);
    try {
      const res = await api.employeePasswordResetRequestOtp(fpPhone.trim());
      if (res.devOtp) setFpDevOtp(res.devOtp);
      setFpStep("reset");
    } catch (err: any) {
      setFpError(err.message || "Failed to send OTP");
    } finally {
      setFpLoading(false);
    }
  }

  async function handleResetPassword() {
    setFpError("");
    if (!fpOtp.trim() || fpNewPw.length < 6) {
      setFpError("Enter valid OTP and password (min 6 chars)");
      return;
    }
    setFpLoading(true);
    try {
      await api.employeePasswordReset(fpPhone.trim(), fpOtp.trim(), fpNewPw);
      setFpStep("done");
    } catch (err: any) {
      setFpError(err.message || "Reset failed");
    } finally {
      setFpLoading(false);
    }
  }

  function closeForgot() {
    setShowForgot(false);
    setFpPhone("");
    setFpOtp("");
    setFpNewPw("");
    setFpStep("phone");
    setFpError("");
    setFpDevOtp("");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 px-4">
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/30 bg-white/20 p-8 shadow-2xl backdrop-blur-xl">
        {!showForgot ? (
          <>
            <div className="mb-6 flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/30 text-white">
                <Building2 className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold text-white">AEMS</h1>
              <p className="text-sm text-white/80">Arnav Enterprises Management System</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Username</label>
                <div className="flex items-center rounded-lg border border-white/30 bg-white/20 px-3">
                  <User className="h-4 w-4 text-white/70" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username or mobile number"
                    className="w-full bg-transparent px-3 py-2.5 text-white placeholder-white/50 outline-none"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Password</label>
                <div className="flex items-center rounded-lg border border-white/30 bg-white/20 px-3">
                  <Lock className="h-4 w-4 text-white/70" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-transparent px-3 py-2.5 text-white placeholder-white/50 outline-none"
                    autoComplete="current-password"
                  />
                </div>
                <div className="mt-1 text-right">
                  <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-white/70 underline hover:text-white">
                    Forgot Password?
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/30 px-3 py-2 text-sm text-white">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-white/70">
              Employees: use your registered mobile number as username.{" "}
              <a href="/signup" className="font-semibold underline">New here? Sign up</a>
            </p>
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center gap-2">
              <button type="button" onClick={closeForgot} className="self-start text-white/70 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/30 text-white">
                <Lock className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold text-white">Reset Password</h1>
              <p className="text-sm text-white/80">Enter your registered mobile number</p>
            </div>

            {fpStep === "phone" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/90">Mobile Number</label>
                  <input
                    type="text"
                    value={fpPhone}
                    onChange={(e) => setFpPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2.5 text-white placeholder-white/50 outline-none"
                  />
                </div>
                {fpError && <p className="rounded-lg bg-red-500/30 px-3 py-2 text-sm text-white">{fpError}</p>}
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={fpLoading}
                  className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-60"
                >
                  {fpLoading ? "Sending OTP..." : "Send OTP"}
                </button>
              </div>
            )}

            {fpStep === "reset" && (
              <div className="space-y-4">
                {fpDevOtp && (
                  <p className="rounded-lg bg-amber-500/30 px-3 py-2 text-center text-sm text-white">
                    Dev OTP: {fpDevOtp}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/90">OTP</label>
                  <input
                    type="text"
                    value={fpOtp}
                    onChange={(e) => setFpOtp(e.target.value)}
                    placeholder="Enter OTP"
                    className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2.5 text-white placeholder-white/50 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/90">New Password</label>
                  <input
                    type="password"
                    value={fpNewPw}
                    onChange={(e) => setFpNewPw(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2.5 text-white placeholder-white/50 outline-none"
                  />
                </div>
                {fpError && <p className="rounded-lg bg-red-500/30 px-3 py-2 text-sm text-white">{fpError}</p>}
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={fpLoading}
                  className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-60"
                >
                  {fpLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            )}

            {fpStep === "done" && (
              <div className="space-y-4 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="text-white">Password reset successfully!</p>
                <button
                  type="button"
                  onClick={() => { closeForgot(); setUsername(fpPhone); }}
                  className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white"
                >
                  Go to Login
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
