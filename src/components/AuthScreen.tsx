import React, { useState } from 'react';
import { AuthUser } from '../types';
import { signInAdmin } from '../services/auth';
import { ADMIN_EMAIL_DOMAIN } from '../config';
import { Logo } from './Logo';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface AuthScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);
    try {
      setIsLoading(true);
      onLoginSuccess(await signInAdmin());
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Sign-in failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b1e] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden text-white">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#ff1e27]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#162354]/40 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center justify-center bg-white rounded-2xl px-8 py-5 shadow-xl shadow-red-500/20 border-b-4 border-[#ff1e27]">
          <Logo size="lg" variant="dark" />
        </div>
        <h1 className="mt-6 text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase">
          IGNITE VISION <span className="text-[#ff1e27]">DOCUMENTATION DASHBOARD</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 font-mono tracking-wider uppercase">
          Enterprise Contract Management &amp; Cryptographic E-Signature Portal
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-[#e1e7f5] text-[#060b1e]">
          <div className="space-y-4">
            {errorMessage && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#ff1e27]">
                {errorMessage}
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Sign in with your company Google account (<span className="font-mono font-semibold">@{ADMIN_EMAIL_DOMAIN}</span>) to
              manage contracts.
            </p>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg shadow-lg shadow-red-500/30 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-[#f1f5f9] flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Multi-Factor E-Sign Audit &amp; Tamper-Evident Encryption</span>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500 font-mono">
          <span>Protected under E-SIGN Act (15 U.S.C. § 7001) &amp; UETA · SHA-256</span>
        </div>
      </div>
    </div>
  );
};
