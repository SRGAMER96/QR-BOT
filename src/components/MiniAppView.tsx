import React, { useState, useEffect } from 'react';
import { useBot } from '../context/BotContext';
import { toBoldSans } from '../utils/unicodeFonts';
import {
  QrCode,
  User,
  Users,
  Wallet,
  Headphones,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Upload,
  RefreshCw,
  Send,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  XCircle,
  Check,
  Radio
} from 'lucide-react';

export const MiniAppView: React.FC = () => {
  const {
    config,
    currentUser,
    users,
    activePersona,
    setActivePersona,
    activeTask,
    submitProof,
    cancelTask,
    requestWithdrawal,
    withdrawals,
    proofs,
    approveProof,
    rejectProof,
    approveWithdrawal,
    rejectWithdrawal,
    deleteQRTask,
    setNewQRTask,
    toggleBanUser,
    addBalanceToUser,
    removeBalanceFromUser,
    setReferralCommissionPercent,
    updateConfig
  } = useBot();

  // Active Mini App Tab - strictly matches existing bot buttons!
  type MiniTab = 'start_earn' | 'profile' | 'refer_earn' | 'withdraw' | 'support' | 'admin_panel';
  const [activeTab, setActiveTab] = useState<MiniTab>('start_earn');

  // Proof submission drawer/modal state
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [proofImage, setProofImage] = useState<string>('');
  const [proofUtr, setProofUtr] = useState<string>('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // Withdrawal state
  const [upiIdInput, setUpiIdInput] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState(config.minWithdrawal.toString());
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState<string | null>(null);

  // Feedback alerts
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Status ping trigger state (12:00 AM/PM broadcast)
  const [isSendingStatusPing, setIsSendingStatusPing] = useState(false);
  const [statusPingResult, setStatusPingResult] = useState<string | null>(null);

  // Admin New QR Form
  const [newQrUrl, setNewQrUrl] = useState('');
  const [newQrReward, setNewQrReward] = useState('50');

  // Auto-expand Telegram WebApp viewport if inside Telegram
  useEffect(() => {
    try {
      if ((window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.ready();
        (window as any).Telegram.WebApp.expand();
      }
    } catch (e) {
      // Ignore outside telegram
    }
  }, []);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActionAlert({ type, message });
    setTimeout(() => setActionAlert(null), 4000);
  };

  const isAdmin = currentUser.id === config.adminId;

  // Handle proof submission
  const handleSubmitProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;

    if (!proofImage && !proofUtr.trim()) {
      showAlert('Please attach a screenshot or enter your 12-digit UTR number.', 'error');
      return;
    }

    setIsSubmittingProof(true);
    setTimeout(() => {
      submitProof(
        activeTask.id,
        proofImage || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80',
        proofUtr.trim() ? `UTR: ${proofUtr.trim()}` : 'Payment Screenshot'
      );
      setIsSubmittingProof(false);
      setIsProofModalOpen(false);
      setProofImage('');
      setProofUtr('');
      showAlert('Proof submitted successfully! Your submission is now queued for admin review.');
    }, 600);
  };

  // Handle Task Cancellation with anti-duplicate guard
  const handleCancelTask = () => {
    if (!activeTask) {
      showAlert('No active task to cancel.', 'info');
      return;
    }
    cancelTask();
    setIsProofModalOpen(false);
    showAlert('Task session cancelled. Proof submission has been disabled for this attempt.', 'info');
  };

  // Handle Withdrawal Submission
  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawSuccessMsg(null);
    setWithdrawErrorMsg(null);

    const amount = parseFloat(withdrawAmountInput);
    if (!upiIdInput.trim() || !upiIdInput.includes('@')) {
      setWithdrawErrorMsg('Please enter a valid UPI ID (e.g. username@okaxis or number@paytm)');
      return;
    }

    if (isNaN(amount) || amount < config.minWithdrawal) {
      setWithdrawErrorMsg(`Minimum withdrawal amount is ${config.currencySymbol}${config.minWithdrawal}`);
      return;
    }

    if (amount > currentUser.balance) {
      setWithdrawErrorMsg(`Insufficient balance. You have ${config.currencySymbol}${currentUser.balance.toFixed(2)}`);
      return;
    }

    const res = requestWithdrawal(upiIdInput.trim(), amount);
    if (res.success) {
      setWithdrawSuccessMsg(`Withdrawal of ${config.currencySymbol}${amount.toFixed(2)} queued! Our admin will transfer shortly.`);
      setWithdrawAmountInput(config.minWithdrawal.toString());
      showAlert(`Withdrawal request for ${config.currencySymbol}${amount.toFixed(2)} submitted!`);
    } else {
      setWithdrawErrorMsg(res.error || 'Failed to submit withdrawal request.');
    }
  };

  // Trigger 12:00 AM / 12:00 PM Status Ping Broadcast
  const handleTriggerStatusPing = async () => {
    setIsSendingStatusPing(true);
    setStatusPingResult(null);
    try {
      const res = await fetch('/api/bot/broadcast-status-ping', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusPingResult(`✅ Status broadcast delivered! (Sent: ${data.sent} messages)`);
        showAlert('12:00 Bot Details Broadcast dispatched to subscribers!');
      } else {
        setStatusPingResult(`❌ Error: ${data.error || 'Failed to broadcast'}`);
      }
    } catch (err: any) {
      setStatusPingResult(`❌ Connection error: ${err.message}`);
    } finally {
      setIsSendingStatusPing(false);
    }
  };

  const referralLink = `https://t.me/${config.botUsername}?start=ref_${currentUser.id}`;

  const copyToClipboard = (text: string, type: 'link' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showAlert('Referral link copied to clipboard!');
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      showAlert('Telegram ID copied!');
    }
  };

  const userWithdrawals = Object.values(withdrawals).filter(w => w.userId === currentUser.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Top Telegram WebApp Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
        
        {/* Mini App Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-md shadow-cyan-500/10">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-white tracking-tight">QR KING</h1>
                <span className="bg-blue-500 text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full leading-none">✓</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md">
                  Mini App
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>@{config.botUsername}</span>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online 24/7
                </span>
              </p>
            </div>
          </div>

          {/* Right: Quick Balance & Persona Switcher */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-2xl text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Balance</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {config.currencySymbol}{currentUser.balance.toFixed(2)}
              </span>
            </div>

            {/* Persona Switcher Dropdown (for preview/testing) */}
            <select
              value={activePersona}
              onChange={(e) => {
                setActivePersona(e.target.value as any);
                if (e.target.value !== 'admin' && activeTab === 'admin_panel') {
                  setActiveTab('start_earn');
                }
              }}
              title="Switch user for preview testing"
              className="bg-slate-800/90 text-slate-200 text-xs rounded-xl px-2.5 py-2 border border-slate-700/80 font-medium focus:outline-none focus:border-cyan-500"
            >
              <option value="user_1">👤 Alex (User)</option>
              <option value="user_2">👤 Sarah (User)</option>
              <option value="admin">👑 Admin @SRGAMER96</option>
            </select>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionAlert && (
          <div className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${
            actionAlert.type === 'error'
              ? 'bg-rose-500/20 border-b border-rose-500/30 text-rose-300'
              : actionAlert.type === 'info'
              ? 'bg-amber-500/20 border-b border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300'
          }`}>
            {actionAlert.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : actionAlert.type === 'info' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{actionAlert.message}</span>
          </div>
        )}

        {/* Existing Bot Navigation Buttons (Tab Bar) */}
        <div className="bg-slate-950/60 p-2 border-b border-slate-800/80">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <button
              onClick={() => setActiveTab('start_earn')}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'start_earn'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>START EARN</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'profile'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>PROFILE</span>
            </button>

            <button
              onClick={() => setActiveTab('refer_earn')}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'refer_earn'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>REFER & EARN</span>
            </button>

            <button
              onClick={() => setActiveTab('withdraw')}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'withdraw'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>WITHDRAW</span>
            </button>

            <button
              onClick={() => setActiveTab('support')}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'support'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>SUPPORT</span>
            </button>

            {/* Admin Panel Button - Strictly shown only for Admin */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin_panel')}
                className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'admin_panel'
                    ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300 shadow-sm'
                    : 'bg-slate-850 hover:bg-slate-800 text-rose-400/80 hover:text-rose-300 border border-rose-500/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>ADMIN PANEL</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="p-4 sm:p-6 min-h-[460px]">
          
          {/* ======================================================== */}
          {/* TAB 1: 🚀 START EARN */}
          {/* ======================================================== */}
          {activeTab === 'start_earn' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {activeTask ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

                  {/* Task Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4">
                    <div>
                      <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">
                        Verified QR Drop
                      </span>
                      <h2 className="text-lg font-bold text-white">{activeTask.title}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">
                        Reward: {config.currencySymbol}{activeTask.reward}
                      </span>
                      {activeTask.isLocked ? (
                        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>{activeTask.lockedByUserId === currentUser.id ? 'Your Review' : 'Locked'}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Open Drop</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* QR Image Presentation */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 my-4">
                    <div className="relative group shrink-0">
                      <div className="w-52 h-52 bg-white rounded-2xl p-3 shadow-xl flex items-center justify-center border-4 border-slate-800/80">
                        <img
                          src={activeTask.qrImageUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>
                      <div className="mt-2 text-center">
                        <span className="text-[11px] text-slate-400 font-medium">Scan with PhonePe / GPay / Paytm</span>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="flex-1 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Task Instructions
                      </h3>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                          <span>Scan QR with any UPI app and complete payment.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                          <span>Take a screenshot of payment screen or copy 12-digit UTR.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                          <span>Click <b>Submit Proof</b> to lock your reward claim.</span>
                        </div>
                      </div>

                      {/* Status indicator if locked */}
                      {activeTask.isLocked && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>
                            {activeTask.lockedByUserId === currentUser.id
                              ? 'Your proof has been submitted and is currently being audited by the administrator.'
                              : `Locked by another user (${activeTask.lockedByUserName || 'Member'}).`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Strictly Submit Proof & Cancel */}
                  <div className="border-t border-slate-800/80 pt-4 mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setIsProofModalOpen(true)}
                      disabled={activeTask.isLocked && activeTask.lockedByUserId !== currentUser.id}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{toBoldSans('SUBMIT PROOF')}</span>
                    </button>

                    <button
                      onClick={handleCancelTask}
                      className="py-3 px-5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm rounded-xl transition-all border border-slate-700 flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>{toBoldSans('Cancel')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-950/60 rounded-2xl border border-slate-800 p-8">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">No Active QR Drop</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    The previous QR task has already been completed and verified. Please standby for the administrator to post the next fresh QR drop!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: 👤 PROFILE */}
          {/* ======================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Profile Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-lg flex items-center justify-center">
                      {currentUser.firstName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                        <span>{currentUser.firstName}</span>
                        {currentUser.username && (
                          <span className="text-xs text-slate-400 font-normal">(@{currentUser.username})</span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>ID: <code className="text-cyan-300 font-mono">{currentUser.id}</code></span>
                        <button
                          onClick={() => copyToClipboard(currentUser.id.toString(), 'id')}
                          className="hover:text-cyan-400 transition-colors"
                          title="Copy ID"
                        >
                          {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
                    Active Member
                  </span>
                </div>

                {/* Big Balance Banner */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between mb-5">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider block font-medium">Available Balance</span>
                    <span className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">
                      {config.currencySymbol}{currentUser.balance.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('withdraw')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    <span>Withdraw Funds</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Total Referrals</span>
                    <span className="text-base font-bold text-white font-mono">{currentUser.referralCount}</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Ref Earnings</span>
                    <span className="text-base font-bold text-cyan-400 font-mono">
                      {config.currencySymbol}{(currentUser.referralEarnings || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Tasks Done</span>
                    <span className="text-base font-bold text-white font-mono">{currentUser.tasksCompleted}</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Member Since</span>
                    <span className="text-xs font-semibold text-slate-300">
                      {new Date(currentUser.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: 👥 REFER & EARN */}
          {/* ======================================================== */}
          {activeTab === 'refer_earn' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Referral Commission Program</h2>
                    <p className="text-xs text-slate-400">Earn lifetime commission on every task completed by your invitees</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 border border-cyan-500/20 rounded-xl p-4 mb-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-cyan-300 font-medium block">Lifetime Rate</span>
                    <span className="text-2xl font-bold text-white">{config.referralCommissionPercent}% Commission</span>
                  </div>
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full">
                    Auto-Credited
                  </span>
                </div>

                {/* Referral Link Box */}
                <div className="space-y-2 mb-5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Your Exclusive Referral Link:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 truncate">
                      {referralLink}
                    </div>
                    <button
                      onClick={() => copyToClipboard(referralLink, 'link')}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Share Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
                      `🔥 Earn instant cash with QR KING! Scan QR codes and cashout via UPI:`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Share on Telegram</span>
                  </a>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `🔥 Earn instant cash by scanning QR codes with QR KING! Join now: ${referralLink}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: 💰 WITHDRAW */}
          {/* ======================================================== */}
          {activeTab === 'withdraw' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">UPI Instant Cashout</h2>
                    <p className="text-xs text-slate-400">Transfer directly to PhonePe, Google Pay, Paytm, or BHIM</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 font-mono">
                    Balance: {config.currencySymbol}{currentUser.balance.toFixed(2)}
                  </span>
                </div>

                {withdrawSuccessMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{withdrawSuccessMsg}</span>
                  </div>
                )}

                {withdrawErrorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{withdrawErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                      Your UPI ID (VPA)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. username@okaxis or 9876543210@paytm"
                      value={upiIdInput}
                      onChange={(e) => setUpiIdInput(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono placeholder:text-slate-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Withdrawal Amount ({config.currencySymbol})
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Min: {config.currencySymbol}{config.minWithdrawal}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="1"
                      min={config.minWithdrawal}
                      max={currentUser.balance}
                      value={withdrawAmountInput}
                      onChange={(e) => setWithdrawAmountInput(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />

                    {/* Quick amount chips */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawAmountInput(config.minWithdrawal.toString())}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] rounded-lg border border-slate-800 font-mono"
                      >
                        Min ({config.currencySymbol}{config.minWithdrawal})
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawAmountInput('50')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] rounded-lg border border-slate-800 font-mono"
                      >
                        {config.currencySymbol}50
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawAmountInput('100')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] rounded-lg border border-slate-800 font-mono"
                      >
                        {config.currencySymbol}100
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawAmountInput(Math.floor(currentUser.balance).toString())}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] rounded-lg border border-slate-800 font-mono"
                      >
                        Max All
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={currentUser.balance < config.minWithdrawal}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{toBoldSans('SUBMIT WITHDRAWAL REQUEST')}</span>
                  </button>
                </form>

                {/* Withdrawal History */}
                {userWithdrawals.length > 0 && (
                  <div className="border-t border-slate-800 pt-4 mt-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Your Cashout Requests
                    </h3>
                    <div className="space-y-2">
                      {userWithdrawals.slice(0, 4).map((w) => (
                        <div key={w.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white font-mono">{config.currencySymbol}{w.amount}</span>
                            <span className="text-slate-500 block text-[11px]">{w.upiId}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            w.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : w.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {w.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: 📞 SUPPORT */}
          {/* ======================================================== */}
          {activeTab === 'support' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Official 24/7 Support Desk</h2>
                    <p className="text-xs text-slate-400">Direct assistance from Master Administration</p>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Direct Telegram Admin</span>
                      <span className="text-sm font-bold text-cyan-400">@{config.supportUsername}</span>
                    </div>
                    <a
                      href={`https://t.me/${config.supportUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <span>Open Chat</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Your Account ID: <code className="text-white font-mono">{currentUser.id}</code></span>
                    <button
                      onClick={() => copyToClipboard(currentUser.id.toString(), 'id')}
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-2">
                  <p><b>Tips for rapid support:</b></p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                    <li>Always provide your numeric Telegram ID when requesting payout checks.</li>
                    <li>Ensure transaction screenshots clearly show the 12-digit bank UTR reference.</li>
                    <li>Verification typically takes 5–15 minutes during standard operational hours.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: 🛠️ ADMIN PANEL (Master Admin Only) */}
          {/* ======================================================== */}
          {activeTab === 'admin_panel' && isAdmin && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Automated 12:00 Broadcast Status Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Automated 12:00 AM & 12:00 PM Status Broadcast
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                    Active 24/7
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 space-y-0.5 mb-3">
                  <p className="text-white font-bold">🤖 Live Bot Details:</p>
                  <p>Bot Name: {config.botName}</p>
                  <p>Bot Username: @{config.botUsername}</p>
                  <p>Bot ID: 8916389057</p>
                  <p>Admin ID: {config.adminId} (@{config.supportUsername})</p>
                  <p className="text-emerald-400 font-semibold">Status: 🟢 Online 24/7</p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400">
                    Triggers automatically twice daily at <b>12:00 AM</b> and <b>12:00 PM</b> to all subscribers.
                  </p>

                  <button
                    onClick={handleTriggerStatusPing}
                    disabled={isSendingStatusPing}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSendingStatusPing ? 'animate-spin' : ''}`} />
                    <span>{isSendingStatusPing ? 'Dispatching...' : 'Test 12:00 Ping Now'}</span>
                  </button>
                </div>

                {statusPingResult && (
                  <p className="mt-2 text-xs font-mono text-cyan-300 bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                    {statusPingResult}
                  </p>
                )}
              </div>

              {/* QR Management */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">QR Code Management</h3>
                  {activeTask && (
                    <button
                      onClick={() => {
                        deleteQRTask();
                        showAlert('Active QR code deleted.');
                      }}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs rounded-lg transition-colors font-medium"
                    >
                      Delete Active QR
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">New QR Image URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newQrUrl}
                      onChange={(e) => setNewQrUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Reward ({config.currencySymbol})</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newQrReward}
                        onChange={(e) => setNewQrReward(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => {
                          if (!newQrUrl) {
                            showAlert('Please enter an image URL', 'error');
                            return;
                          }
                          setNewQRTask(
                            'Official Instant UPI Cashback Drop',
                            newQrUrl,
                            parseFloat(newQrReward) || 50,
                            'Scan with PhonePe/GPay, complete payment, and upload screenshot proof.'
                          );
                          setNewQrUrl('');
                          showAlert('New QR Code Published to Start Earn!');
                        }}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl shrink-0"
                      >
                        Publish
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Proofs Review */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
                  Pending Proof Submissions ({Object.values(proofs).filter(p => p.status === 'pending').length})
                </h3>

                {Object.values(proofs).filter(p => p.status === 'pending').length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No proofs awaiting audit.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.values(proofs)
                      .filter(p => p.status === 'pending')
                      .map((proof) => (
                        <div key={proof.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-bold text-white">{proof.userName}</span>
                            <span className="text-slate-400 block text-[11px]">ID: {proof.userId} · Note: {proof.proofText || 'Screenshot'}</span>
                            <span className="text-emerald-400 font-bold font-mono">Reward: {config.currencySymbol}{proof.reward}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                approveProof(proof.id);
                                showAlert(`Proof approved! Credited ${config.currencySymbol}${proof.reward} + auto referral %`);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                rejectProof(proof.id, 'Invalid proof');
                                showAlert('Proof rejected and task unlocked.');
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Pending Withdrawals Review */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
                  Pending Withdrawals ({Object.values(withdrawals).filter(w => w.status === 'pending').length})
                </h3>

                {Object.values(withdrawals).filter(w => w.status === 'pending').length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No cashout requests pending.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.values(withdrawals)
                      .filter(w => w.status === 'pending')
                      .map((w) => (
                        <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-bold text-white">{w.userName}</span>
                            <span className="text-slate-400 block font-mono text-[11px]">UPI: {w.upiId}</span>
                            <span className="text-emerald-400 font-bold font-mono text-sm">Amount: {config.currencySymbol}{w.amount}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                approveWithdrawal(w.id);
                                showAlert(`Payout of ${config.currencySymbol}${w.amount} approved!`);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                            >
                              Approve Payout
                            </button>
                            <button
                              onClick={() => {
                                rejectWithdrawal(w.id, 'UPI issue');
                                showAlert(`Withdrawal rejected and ${config.currencySymbol}${w.amount} refunded.`);
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors"
                            >
                              Reject & Refund
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mini App Footer Branding */}
        <div className="bg-slate-950 p-3.5 border-t border-slate-800/80 text-center text-[11px] text-slate-500 flex items-center justify-between px-5">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>QR KING Official Bot Suite</span>
          </span>
          <span className="font-mono text-slate-400">ID: 8916389057</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PROOF SUBMISSION MODAL / DRAWER */}
      {/* ======================================================== */}
      {isProofModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Submit Task Proof</span>
              </h3>
              <button
                onClick={() => setIsProofModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProof} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  12-Digit Bank UTR / Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 428192847192"
                  value={proofUtr}
                  onChange={(e) => setProofUtr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Or Screenshot Photo URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={proofImage}
                  onChange={(e) => setProofImage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload screenshot to secure your ₹{activeTask?.reward || 50} claim.
                </p>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProofModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProof}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingProof ? 'Sending...' : 'Confirm Submission'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
