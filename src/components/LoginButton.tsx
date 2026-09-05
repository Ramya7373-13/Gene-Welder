import React, { useState } from 'react';
import { LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginButtonProps {
  className?: string;
}

export default function LoginButton({ className = '' }: LoginButtonProps) {
  const { user, loading, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSending(true);
    setMessage(null);

    try {
      await login(email);
      setMessage({ type: 'success', text: 'Check your email for the magic link!' });
      setEmail('');
      setShowEmailInput(false);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send magic link' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <button className={`p-2 rounded-lg text-slate-400 ${className}`} disabled>
        <Loader2 size={18} className="animate-spin" />
      </button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <User size={16} />
          <span className="hidden sm:inline">{user.email}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${user.plan === 'pro' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-400'}`}>
            {user.plan === 'pro' ? 'Pro' : 'Free'}
          </span>
        </div>
        <button
          onClick={() => logout()}
          className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${className}`}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  }

  if (showEmailInput) {
    return (
      <form onSubmit={handleLogin} className={`flex items-center gap-2 ${className}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          required
        />
        <button
          type="submit"
          disabled={sending}
          className="p-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
        </button>
        <button
          type="button"
          onClick={() => { setShowEmailInput(false); setMessage(null); }}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        {message && (
          <div className={`text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message.text}
          </div>
        )}
      </form>
    );
  }

  return (
    <button
      onClick={() => setShowEmailInput(true)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors ${className}`}
    >
      <LogIn size={16} />
      <span>Login</span>
    </button>
  );
}
