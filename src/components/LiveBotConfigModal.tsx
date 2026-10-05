import React, { useState } from 'react';
import { useBot } from '../context/BotContext';
import {
  X,
  Settings,
  Key,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Save,
  Globe
} from 'lucide-react';

interface LiveBotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveBotConfigModal: React.FC<LiveBotConfigModalProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig } = useBot();

  const [formData, setFormData] = useState({
    botName: config.botName,
    botUsername: config.botUsername,
    adminId: config.adminId.toString(),
    supportUsername: config.supportUsername,
    currencySymbol: config.currencySymbol,
    minWithdrawal: config.minWithdrawal.toString(),
    referralBonus: config.referralBonus.toString(),
    referralCommissionPercent: config.referralCommissionPercent.toString(),
    botToken: config.botToken || ''
  });

  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenVerificationResult, setTokenVerificationResult] = useState<{
    ok: boolean;
    data?: any;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleVerifyTelegramToken = async () => {
    if (!formData.botToken.trim()) {
      setTokenVerificationResult({ ok: false, error: 'Please enter a Bot Token first.' });
      return;
    }

    try {
      setVerifyingToken(true);
      setTokenVerificationResult(null);

      const res = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.botToken.trim() })
      });

      const json = await res.json();
      if (json.ok && json.result) {
        setTokenVerificationResult({
          ok: true,
          data: json.result
        });
        // Auto sync username if retrieved
        if (json.result.username) {
          setFormData(prev => ({
            ...prev,
            botUsername: json.result.username,
            botName: json.result.first_name || prev.botName
          }));
        }
      } else {
        setTokenVerificationResult({
          ok: false,
          error: json.description || json.error || 'Invalid Bot Token. Check with @BotFather.'
        });
      }
    } catch (err: any) {
      setTokenVerificationResult({
        ok: false,
        error: err.message || 'Could not connect to Telegram server.'
      });
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const adminNum = parseInt(formData.adminId, 10);
    const minW = parseFloat(formData.minWithdrawal);
    const refB = parseFloat(formData.referralBonus);
    const refPct = parseFloat(formData.referralCommissionPercent);

    updateConfig({
      botName: formData.botName.trim(),
      botUsername: formData.botUsername.trim().replace(/^@/, ''),
      adminId: isNaN(adminNum) ? config.adminId : adminNum,
      supportUsername: formData.supportUsername.trim().replace(/^@/, ''),
      currencySymbol: formData.currencySymbol.trim() || '₹',
      minWithdrawal: isNaN(minW) ? config.minWithdrawal : minW,
      referralBonus: isNaN(refB) ? config.referralBonus : refB,
      referralCommissionPercent: isNaN(refPct) ? config.referralCommissionPercent : refPct,
      botToken: formData.botToken.trim()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bot Engine Configuration</h3>
              <p className="text-xs text-slate-400">Configure parameters and verify live Telegram connection.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Telegram Live Token Verification Section */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Real Telegram Bot Token (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">from @BotFather</span>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={formData.botToken}
                onChange={(e) => setFormData(prev => ({ ...prev, botToken: e.target.value }))}
                placeholder="7123456789:AAExAmPlE..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
              />
              <button
                type="button"
                onClick={handleVerifyTelegramToken}
                disabled={verifyingToken || !formData.botToken.trim()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-cyan-300 rounded-xl transition-colors border border-slate-700 shrink-0 flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{verifyingToken ? 'Checking...' : 'Verify'}</span>
              </button>
            </div>

            {tokenVerificationResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  tokenVerificationResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {tokenVerificationResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Connected to Telegram!</span>
                      <span className="text-[11px] opacity-90 block">
                        Bot: <b>{tokenVerificationResult.data.first_name}</b> (@{tokenVerificationResult.data.username})
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Verification Failed</span>
                      <span className="text-[11px] opacity-90">{tokenVerificationResult.error}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Standard Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Bot Name</label>
              <input
                type="text"
                value={formData.botName}
                onChange={(e) => setFormData(prev => ({ ...prev, botName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Bot Username (without @)</label>
              <input
                type="text"
                value={formData.botUsername}
                onChange={(e) => setFormData(prev => ({ ...prev, botUsername: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Master Admin Telegram ID</label>
              <input
                type="text"
                value={formData.adminId}
                onChange={(e) => setFormData(prev => ({ ...prev, adminId: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Support Username (without @)</label>
              <input
                type="text"
                value={formData.supportUsername}
                onChange={(e) => setFormData(prev => ({ ...prev, supportUsername: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => setFormData(prev => ({ ...prev, currencySymbol: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Min Withdrawal ({formData.currencySymbol})</label>
              <input
                type="number"
                value={formData.minWithdrawal}
                onChange={(e) => setFormData(prev => ({ ...prev, minWithdrawal: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Referral Commission (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.referralCommissionPercent}
                onChange={(e) => setFormData(prev => ({ ...prev, referralCommissionPercent: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Flat Signup Bonus ({formData.currencySymbol})</label>
              <input
                type="number"
                value={formData.referralBonus}
                onChange={(e) => setFormData(prev => ({ ...prev, referralBonus: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-500 hover:bg-cyan-400 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
