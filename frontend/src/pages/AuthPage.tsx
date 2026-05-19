import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth, addToast } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (mode === 'register' && !fullName.trim()) e.fullName = 'Full name is required';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const data =
        mode === 'login'
          ? await authApi.login(email, password)
          : await authApi.register(email, password, fullName);

      setAuth(data.user, data.access_token, data.refresh_token);
      addToast('success', `Welcome${mode === 'register' ? ', ' + data.user.full_name : ' back'}!`);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Authentication failed';
      addToast('error', msg);
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center relative overflow-hidden">
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#6366F1 1px, transparent 1px), linear-gradient(90deg, #6366F1 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#6366F1]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-[#6366F1] rounded-lg flex items-center justify-center shadow-lg shadow-[#6366F1]/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-mono font-bold text-2xl text-[#F1F5F9] tracking-tight">LogIQ</span>
        </div>

        {/* Card */}
        <div className="bg-[#111118]/80 backdrop-blur-xl border border-[#2A2A3A] rounded-2xl p-8 shadow-2xl">
          {/* Mode tabs */}
          <div className="flex bg-[#0A0A0F] rounded-lg p-1 mb-6 border border-[#2A2A3A]">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrors({}); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === m
                    ? 'bg-[#6366F1] text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder-[#475569] outline-none focus:border-[#6366F1] transition-colors"
                />
                {errors.fullName && <p className="text-xs text-red-400 mt-1">{errors.fullName}</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ada@example.com"
                className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder-[#475569] outline-none focus:border-[#6366F1] transition-colors"
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2.5 pr-10 text-sm text-[#F1F5F9] placeholder-[#475569] outline-none focus:border-[#6366F1] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            {errors.form && (
              <div className="bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">
                <p className="text-xs text-red-400">{errors.form}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#818CF8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2 shadow-lg shadow-[#6366F1]/20"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-[#475569] mt-5">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); }}
              className="text-[#6366F1] hover:text-[#818CF8] font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-[#475569] mt-4">
          AI-powered log intelligence · Built with FastAPI + GPT-4o mini
        </p>
      </div>
    </div>
  );
};
