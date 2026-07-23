"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Building2, Lock, Smartphone, ShieldCheck } from "lucide-react";

type Step = "phone" | "otp" | "password" | "done";

export default function EmployeeSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDevOtp(null);
    if (!/^\d{10}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.employeeRequestOtp(phone.trim());
      setDevOtp(res.devOtp ?? null);
      setInfo(res.message || "OTP sent.");
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!otp.trim()) {
      setError("Enter the OTP sent to your mobile.");
      return;
    }
    setLoading(true);
    try {
      await api.employeeVerifyOtp(phone.trim(), otp.trim());
      setStep("password");
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function setPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.employeeSetPassword(phone.trim(), password);
      setInfo(res.message || "Password created successfully.");
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 px-4">
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/30 bg-white/20 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/30 text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Employee Sign Up</h1>
          <p className="text-sm text-white/80">Arnav Enterprises Management System</p>
        </div>

        {step === "phone" && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Mobile Number</label>
              <div className="flex items-center rounded-lg border border-white/30 bg-white/20 px-3">
                <Smartphone className="h-4 w-4 text-white/70" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-white/50 outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-white/60">Use the number registered by your accountant.</p>
            </div>
            {error && <p className="rounded-lg bg-red-500/30 px-3 py-2 text-sm text-white">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-500/30 px-3 py-2 text-sm text-white">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-60"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Enter OTP</label>
              <div className="flex items-center rounded-lg border border-white/30 bg-white/20 px-3">
                <ShieldCheck className="h-4 w-4 text-white/70" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit OTP"
                  maxLength={6}
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-white/50 outline-none tracking-widest"
                />
              </div>
              <p className="mt-1 text-xs text-white/60">
                OTP sent to {phone}
                {devOtp && <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 font-mono">Dev OTP: {devOtp}</span>}
              </p>
            </div>
            {error && <p className="rounded-lg bg-red-500/30 px-3 py-2 text-sm text-white">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={setPasswordSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">New Password</label>
              <div className="flex items-center rounded-lg border border-white/30 bg-white/20 px-3">
                <Lock className="h-4 w-4 text-white/70" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-white/50 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Confirm Password</label>
              <div className="flex items-center rounded-lg border border-white/30 bg-white/20 px-3">
                <Lock className="h-4 w-4 text-white/70" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-white/50 outline-none"
                />
              </div>
            </div>
            {error && <p className="rounded-lg bg-red-500/30 px-3 py-2 text-sm text-white">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Password"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-500/30 px-3 py-3 text-center text-sm text-white">
              {info || "Password created successfully."}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-lg bg-white/90 py-2.5 font-semibold text-indigo-700 transition hover:bg-white"
            >
              Go to Login
            </button>
          </div>
        )}

        {step !== "done" && (
          <p className="mt-4 text-center text-xs text-white/70">
            Already registered?{" "}
            <a href="/login" className="font-semibold underline">
              Login
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
