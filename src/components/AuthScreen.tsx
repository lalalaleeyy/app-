import React, { useState } from 'react';
import { AuthUser } from '../types';
import { signInAdmin } from '../services/auth';
import { Logo } from './Logo';
import { ArrowRight, ShieldCheck, Lock, User as UserIcon } from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface AuthScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      setIsLoading(true);
      const user = await signInAdmin(username, password);
      onLoginSuccess(user);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Sign-in failed. Please check your credentials.'));
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#ff1e27]">
                {errorMessage}
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Enter your administrative credentials to manage enterprise contracts and audit logs.
            </p>

            <div className="space-y-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Admin Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#e1e7f5] bg-[#f8faff] text-[#060b1e] font-mono focus:outline-none focus:ring-2 focus:ring-[#ff1e27]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#e1e7f5] bg-[#f8faff] text-[#060b1e] font-mono focus:outline-none focus:ring-2 focus:ring-[#ff1e27]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg shadow-lg shadow-red-500/30 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'AUTHENTICATING...' : 'SIGN IN TO DASHBOARD'}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          </form>

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
