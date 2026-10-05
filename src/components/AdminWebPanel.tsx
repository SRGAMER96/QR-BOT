import React, { useState, useRef } from 'react';
import { useBot } from '../context/BotContext';
import { TelegramUser } from '../types/bot';
import {
  Users,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Trash2,
  Megaphone,
  Lock,
  Unlock,
  QrCode,
  Percent,
  Plus,
  Minus,
  Info,
  Sliders,
  DollarSign,
  Upload,
  Image as ImageIcon,
  Camera,
  Sparkles,
  Activity,
  RefreshCw
} from 'lucide-react';

export const AdminWebPanel: React.FC = () => {
  const {
    config,
    updateConfig,
    users,
    activeTask,
    proofs,
    withdrawals,
    setNewQRTask,
    deleteQRTask,
    approveProof,
    rejectProof,
    approveWithdrawal,
    rejectWithdrawal,
    toggleBanUser,
    deleteUser,
    addBalanceToUser,
    removeBalanceFromUser,
    setReferralCommissionPercent,
    broadcastMessage
  } = useBot();

  // QR Task Form state
  const [taskTitle, setTaskTitle] = useState('Official UPI Instant Reward');
  const [taskQrUrl, setTaskQrUrl] = useState('https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=payee.earnqr@okaxis&pn=OfficialEarning&am=10&cu=INR');
  const [taskReward, setTaskReward] = useState('50');
  const [taskInstructions, setTaskInstructions] = useState('1. Scan QR with Google Pay, PhonePe, or Paytm.\n2. Complete the verified ₹10 transfer.\n3. Take a screenshot showing UTR number and upload as proof.');

  // Photo upload state
  const qrFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [autoPublishOnUpload, setAutoPublishOnUpload] = useState(true);
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState<string | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image/photo file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setTaskQrUrl(dataUrl);

        if (autoPublishOnUpload) {
          const rewardNum = parseFloat(taskReward) || 50;
          setNewQRTask(taskTitle, dataUrl, rewardNum, taskInstructions);
          fetch('/api/bot/qr/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: taskTitle,
              qrImageUrl: dataUrl,
              reward: rewardNum,
              instructions: taskInstructions
            })
          }).catch(() => {});

          setPhotoUploadSuccess(`🎉 Photo "${file.name}" uploaded and automatically added to Start Earn!`);
          setTimeout(() => setPhotoUploadSuccess(null), 5000);
        } else {
          setPhotoUploadSuccess(`📸 Photo "${file.name}" loaded! Click "Activate QR Code" below to publish.`);
          setTimeout(() => setPhotoUploadSuccess(null), 5000);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDropPhoto = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setTaskQrUrl(dataUrl);
          if (autoPublishOnUpload) {
            const rewardNum = parseFloat(taskReward) || 50;
            setNewQRTask(taskTitle, dataUrl, rewardNum, taskInstructions);
            fetch('/api/bot/qr/set', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: taskTitle,
                qrImageUrl: dataUrl,
                reward: rewardNum,
                instructions: taskInstructions
              })
            }).catch(() => {});
            setPhotoUploadSuccess(`🎉 Photo "${file.name}" dropped and automatically added to Start Earn!`);
            setTimeout(() => setPhotoUploadSuccess(null), 5000);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Bot Live status & reconnect state
  const [botLiveRunning, setBotLiveRunning] = useState<boolean>(true);
  const [isRestartingBot, setIsRestartingBot] = useState<boolean>(false);
  const [restartFeedback, setRestartFeedback] = useState<string | null>(null);

  const handleRestartBot = async () => {
    setIsRestartingBot(true);
    setRestartFeedback(null);
    try {
      const res = await fetch('/api/bot/restart', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBotLiveRunning(true);
        setRestartFeedback('✅ Bot engine reconnected & running 24/7!');
      } else {
        setRestartFeedback(`❌ Error: ${data.error}`);
      }
    } catch {
      setRestartFeedback('❌ Could not reach server');
    } finally {
      setIsRestartingBot(false);
      setTimeout(() => setRestartFeedback(null), 5000);
    }
  };

  // Broadcast state
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Balance adjustment modal state
  const [balanceModal, setBalanceModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'remove';
    targetUser?: TelegramUser;
    amount: string;
  }>({ isOpen: false, type: 'add', amount: '' });

  // User info modal state
  const [selectedUserForInfo, setSelectedUserForInfo] = useState<TelegramUser | null>(null);

  // Settings state
  const [refCommissionInput, setRefCommissionInput] = useState(config.referralCommissionPercent.toString());
  const [minWithdrawalInput, setMinWithdrawalInput] = useState(config.minWithdrawal.toString());

  // Quick Action by ID state
  const [targetIdInput, setTargetIdInput] = useState('');
  const [quickAmountInput, setQuickAmountInput] = useState('');
  const [quickActionFeedback, setQuickActionFeedback] = useState<string | null>(null);

  // Stats calculation
  const userList = Object.values(users);
  const totalActiveBalance = userList.reduce((acc, u) => acc + u.balance, 0);
  const totalPaidOut = withdrawals
    .filter(w => w.status === 'approved')
    .reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const pendingProofs = proofs.filter(p => p.status === 'pending');

  const handleCreateQR = (e: React.FormEvent) => {
    e.preventDefault();
    const rewardNum = parseFloat(taskReward);
    if (!taskTitle || !taskQrUrl || isNaN(rewardNum) || rewardNum <= 0) {
      alert('Please fill all fields with valid values');
      return;
    }
    setNewQRTask(taskTitle, taskQrUrl, rewardNum, taskInstructions);
    fetch('/api/bot/qr/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle,
        qrImageUrl: taskQrUrl,
        reward: rewardNum,
        instructions: taskInstructions
      })
    }).catch(() => {});
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    const res = broadcastMessage(broadcastText.trim());
    setBroadcastResult(`Delivered broadcast to ${res.delivered} active bot users.`);
    setBroadcastText('');
    setTimeout(() => setBroadcastResult(null), 5000);
  };

  const handleApplySettings = (e: React.FormEvent) => {
    e.preventDefault();
    const pct = parseFloat(refCommissionInput);
    const minW = parseFloat(minWithdrawalInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert('Referral commission must be between 0 and 100%');
      return;
    }
    if (isNaN(minW) || minW < 1) {
      alert('Minimum withdrawal must be at least ₹1');
      return;
    }
    setReferralCommissionPercent(pct);
    updateConfig({ minWithdrawal: minW });
    fetch('/api/bot/settings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCommissionPercent: pct, minWithdrawal: minW })
    }).catch(() => {});
    alert(`✅ Settings updated! Referral Commission: ${pct}%, Min Withdrawal: ₹${minW}`);
  };

  const handleBalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(balanceModal.amount);
    if (!balanceModal.targetUser || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (balanceModal.type === 'add') {
      addBalanceToUser(balanceModal.targetUser.id, amt);
      fetch('/api/bot/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: balanceModal.targetUser.id, amount: amt, action: 'add' })
      }).catch(() => {});
    } else {
      removeBalanceFromUser(balanceModal.targetUser.id, amt);
      fetch('/api/bot/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: balanceModal.targetUser.id, amount: amt, action: 'remove' })
      }).catch(() => {});
    }

    setBalanceModal({ isOpen: false, type: 'add', amount: '' });
  };

  const handleQuickAddBalance = () => {
    const uid = parseInt(targetIdInput.trim(), 10);
    const amt = parseFloat(quickAmountInput.trim());
    if (isNaN(uid) || !users[uid]) {
      alert(`User ID ${targetIdInput} not found in database!`);
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount to credit');
      return;
    }
    addBalanceToUser(uid, amt);
    fetch('/api/bot/users/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, amount: amt, action: 'add' })
    }).catch(() => {});
    setQuickActionFeedback(`✅ Credited ${config.currencySymbol}${amt} to User ${uid}`);
    setQuickAmountInput('');
    setTimeout(() => setQuickActionFeedback(null), 4000);
  };

  const handleQuickDeductBalance = () => {
    const uid = parseInt(targetIdInput.trim(), 10);
    const amt = parseFloat(quickAmountInput.trim());
    if (isNaN(uid) || !users[uid]) {
      alert(`User ID ${targetIdInput} not found in database!`);
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount to deduct');
      return;
    }
    removeBalanceFromUser(uid, amt);
    fetch('/api/bot/users/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, amount: amt, action: 'remove' })
    }).catch(() => {});
    setQuickActionFeedback(`⚠️ Deducted ${config.currencySymbol}${amt} from User ${uid}`);
    setQuickAmountInput('');
    setTimeout(() => setQuickActionFeedback(null), 4000);
  };

  const handleQuickLookup = () => {
    const uid = parseInt(targetIdInput.trim(), 10);
    if (isNaN(uid) || !users[uid]) {
      alert(`User ID ${targetIdInput} not found in database!`);
      return;
    }
    setSelectedUserForInfo(users[uid]);
  };

  const handleQuickDeleteUser = () => {
    const uid = parseInt(targetIdInput.trim(), 10);
    if (isNaN(uid) || !users[uid]) {
      alert(`User ID ${targetIdInput} not found in database!`);
      return;
    }
    if (uid === config.adminId) {
      alert('Cannot delete Master Admin account!');
      return;
    }
    if (window.confirm(`Permanently delete User ${users[uid].firstName} (ID: ${uid})?`)) {
      deleteUser(uid);
      setQuickActionFeedback(`🗑️ Deleted User ${uid} permanently.`);
      setTargetIdInput('');
      setTimeout(() => setQuickActionFeedback(null), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-8">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Executive Admin Control Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Master control for QR tasks, proof verifications, UPI cashouts, referral %, and balance operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="font-semibold text-emerald-400">24/7 Live Engine:</span>
            <span className="font-mono text-white">@QR_WORK_ON_BOT</span>
          </div>

          <button
            onClick={handleRestartBot}
            disabled={isRestartingBot}
            title="Force reconnect and ensure bot polling is active 24/7"
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRestartingBot ? 'animate-spin' : ''}`} />
            <span>{isRestartingBot ? 'Reconnecting...' : 'Keep-Alive / Ping'}</span>
          </button>

          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/bot/broadcast-status-ping', { method: 'POST' });
                const d = await res.json();
                if (d.success) {
                  setRestartFeedback(`Delivered 12:00 AM/PM Bot Details broadcast to ${d.sent} subscriber(s)!`);
                } else {
                  setRestartFeedback(`Broadcast failed: ${d.error}`);
                }
              } catch (e: any) {
                setRestartFeedback(`Broadcast request error: ${e.message}`);
              }
            }}
            title="Broadcast the 12:00 AM/PM Live Bot Details to subscribers right now"
            className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Test 12:00 Status Ping</span>
          </button>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center gap-2">
            <span className="text-slate-500">Master Admin ID:</span>
            <span className="font-mono text-cyan-400 font-semibold">{config.adminId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 font-medium">@{config.supportUsername}</span>
          </div>
        </div>
      </div>

      {restartFeedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 animate-in fade-in flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>{restartFeedback}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Users</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {userList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Registered Subscribers</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Active Balances</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {config.currencySymbol}{totalActiveBalance.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">In User Wallets</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Paid Out</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {config.currencySymbol}{totalPaidOut.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Disbursed via UPI</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Pending Cashouts</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
            {pendingWithdrawals.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Min: {config.currencySymbol}{config.minWithdrawal}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Referral Commission</span>
            <Percent className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono tabular-nums">
            {config.referralCommissionPercent}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Per Completed Task</p>
        </div>
      </div>

      {/* Global Bot Settings & Commission Control */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">Dynamic Bot Settings & Commission Control</h2>
        </div>
        <p className="text-xs text-slate-400">
          Set the referral percentage referrers earn on every task completed by their invited friends, and adjust minimum withdrawal thresholds.
        </p>

        <form onSubmit={handleApplySettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Referral Earning Commission (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={refCommissionInput}
                onChange={(e) => setRefCommissionInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                placeholder="10"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Auto-credited to referrer when their referral earns.
            </span>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Minimum Withdrawal ({config.currencySymbol})
            </label>
            <input
              type="number"
              min="1"
              value={minWithdrawalInput}
              onChange={(e) => setMinWithdrawalInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
              placeholder="30"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Configured to ₹30 as requested.
            </span>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <span>Apply & Save Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* Grid: QR Task Manager & Broadcast Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active QR Task & Update Form */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Active QR Task Management</h2>
            </div>
            <div className="flex items-center gap-2">
              {activeTask?.isLocked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock className="w-3.5 h-3.5" />
                  Locked by {activeTask.lockedByUserName || 'Member'}
                </span>
              ) : activeTask ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Unlock className="w-3.5 h-3.5" />
                  Available for all
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-400">
                  No Active QR
                </span>
              )}
            </div>
          </div>

          {/* Current QR Task Preview */}
          {activeTask ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-28 h-28 bg-white p-1.5 rounded-lg shrink-0 flex items-center justify-center">
                <img
                  src={activeTask.qrImageUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">{activeTask.title}</h4>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete active QR code? Users will see no QR available.')) {
                        deleteQRTask();
                      }
                    }}
                    className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete QR</span>
                  </button>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  Reward: <span className="text-emerald-400 font-bold">{config.currencySymbol}{activeTask.reward}</span>
                </p>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {activeTask.instructions}
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  Task ID: <code className="text-slate-400 font-mono">{activeTask.id}</code>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">No active QR task currently posted.</p>
              <p>Users tapping 'Start Earn' will be instructed to wait for the next QR drop.</p>
            </div>
          )}

          {/* Form to Post New QR */}
          <form onSubmit={handleCreateQR} className="space-y-3.5 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              ➕ Post / Replace QR Code (Resets Lock for Everyone)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  placeholder="e.g. Flash UPI Drop #12"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Reward ({config.currencySymbol})</label>
                <input
                  type="number"
                  value={taskReward}
                  onChange={(e) => setTaskReward(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                  placeholder="50"
                />
              </div>
            </div>

            {/* Direct Photo Upload Dropzone */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span>Provide QR Code Photo</span>
                </span>
                <span className="text-[11px] text-cyan-400 font-normal">Works with photos & screenshots</span>
              </label>

              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="hidden"
              />

              <div
                onClick={() => qrFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropPhoto}
                className="group relative border-2 border-dashed border-slate-700 hover:border-cyan-500/80 bg-slate-950/60 hover:bg-slate-900/60 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200"
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  {taskQrUrl ? (
                    <div className="relative w-24 h-24 bg-white p-1 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                      <img
                        src={taskQrUrl}
                        alt="QR Preview"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[9px] font-bold py-0.5 uppercase tracking-wide">
                        Selected
                      </span>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
                      <Upload className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {uploadedFileName ? `Replace Photo: ${uploadedFileName}` : 'Click to Upload QR Code Photo'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      or drag & drop your QR screenshot here from gallery / device
                    </p>
                  </div>
                </div>
              </div>

              {photoUploadSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{photoUploadSuccess}</span>
                </div>
              )}

              {/* Instant Presets & Auto-Add Option */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoPublishOnUpload}
                    onChange={(e) => setAutoPublishOnUpload(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Automatically add to Start Earn immediately upon photo selection</span>
                </label>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-slate-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=earnqr@okaxis&pn=OfficialEarning&am=10&cu=INR';
                      setTaskQrUrl(url);
                      setUploadedFileName('Preset-₹50-UPI.png');
                      if (autoPublishOnUpload) {
                        setNewQRTask(taskTitle, url, 50, taskInstructions);
                        fetch('/api/bot/qr/set', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title: taskTitle, qrImageUrl: url, reward: 50, instructions: taskInstructions })
                        }).catch(() => {});
                        setPhotoUploadSuccess('✅ Preset QR #1 automatically added to Start Earn!');
                        setTimeout(() => setPhotoUploadSuccess(null), 4000);
                      }
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-mono font-medium transition-colors"
                  >
                    Preset QR #1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=flashbonus@paytm&pn=OfficialEarning&am=25&cu=INR';
                      setTaskQrUrl(url);
                      setUploadedFileName('Preset-₹100-Paytm.png');
                      if (autoPublishOnUpload) {
                        setNewQRTask(taskTitle, url, 100, taskInstructions);
                        fetch('/api/bot/qr/set', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title: taskTitle, qrImageUrl: url, reward: 100, instructions: taskInstructions })
                        }).catch(() => {});
                        setPhotoUploadSuccess('✅ Preset QR #2 automatically added to Start Earn!');
                        setTimeout(() => setPhotoUploadSuccess(null), 4000);
                      }
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-mono font-medium transition-colors"
                  >
                    Preset QR #2
                  </button>
                </div>
              </div>

              {/* Optional URL input fallback */}
              <div className="pt-1">
                <details className="text-xs text-slate-400 cursor-pointer">
                  <summary className="hover:text-slate-300 select-none">Or paste custom Image URL</summary>
                  <div className="pt-2">
                    <input
                      type="text"
                      value={taskQrUrl}
                      onChange={(e) => setTaskQrUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                      placeholder="https://..."
                    />
                  </div>
                </details>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Task Instructions</label>
              <textarea
                rows={2}
                value={taskInstructions}
                onChange={(e) => setTaskInstructions(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                placeholder="Instructions for user..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Activate QR Code & Reset Status</span>
            </button>
          </form>
        </div>

        {/* Global Broadcast Composer */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Broadcast Announcement</h2>
          </div>
          <p className="text-xs text-slate-400">
            Dispatch urgent updates, payment proofs, or new task alerts to all {userList.length} registered bot subscribers.
          </p>

          <form onSubmit={handleBroadcast} className="flex-1 flex flex-col space-y-3">
            <textarea
              rows={6}
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="Type announcement here... (HTML tags <b>bold</b>, <i>italic</i>, and emojis supported)"
              className="flex-1 w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-xs text-white outline-none resize-none"
            />

            {broadcastResult && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                {broadcastResult}
              </div>
            )}

            <button
              type="submit"
              disabled={!broadcastText.trim()}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Megaphone className="w-4 h-4" />
              <span>Send Broadcast to All Users</span>
            </button>
          </form>
        </div>
      </div>

      {/* Proof Verification Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Task Proof Verification Queue</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {pendingProofs.length} Pending
          </span>
        </div>

        {pendingProofs.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800/80">
            <p className="text-xs text-slate-400">No task proofs waiting for review. All caught up!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingProofs.map((p) => (
              <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{p.userName}</span>
                  <span className="text-slate-500 font-mono">ID: {p.userId}</span>
                </div>

                {p.proofImageUrl && (
                  <div className="w-full h-36 bg-black rounded-lg overflow-hidden border border-slate-800">
                    <img
                      src={p.proofImageUrl}
                      alt="Proof submission"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="text-xs space-y-1">
                  <div className="text-slate-400">
                    Task: <span className="text-white font-medium">{p.taskTitle}</span>
                  </div>
                  <div className="text-slate-400">
                    Reward: <span className="text-emerald-400 font-bold font-mono">{config.currencySymbol}{p.reward}</span>
                  </div>
                  {p.proofText && (
                    <div className="text-slate-300 bg-slate-900 p-2 rounded text-[11px] font-mono">
                      {p.proofText}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 mt-auto">
                  <button
                    onClick={() => approveProof(p.id)}
                    className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve (+{config.referralCommissionPercent}% Ref)</span>
                  </button>
                  <button
                    onClick={() => rejectProof(p.id, 'Transaction could not be confirmed')}
                    className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Withdrawals (UPI) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Pending UPI Cashout Requests (Min: {config.currencySymbol}{config.minWithdrawal})</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {pendingWithdrawals.length} Requests
          </span>
        </div>

        {pendingWithdrawals.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800/80">
            <p className="text-xs text-slate-400">No pending withdrawal requests. All payouts cleared!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Telegram ID</th>
                  <th className="py-2.5 px-3">UPI Address</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Requested At</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pendingWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-semibold text-white">{w.userName}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{w.userId}</td>
                    <td className="py-3 px-3 font-mono text-cyan-300 font-medium">{w.upiId}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      {config.currencySymbol}{w.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => approveWithdrawal(w.id)}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-[11px] transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => rejectWithdrawal(w.id, 'UPI address invalid')}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded text-[11px] transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Reject & Refund</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Directory: Ban, Unban, User Info, Add Balance, Remove Balance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Subscriber Management (Ban, Unban, Balances, Dossier, Delete)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {userList.length} Total Users
          </span>
        </div>

        {/* Quick User Action Toolbar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-300">
              ⚡ Quick User Command (By Telegram User ID):
            </span>
            {quickActionFeedback && (
              <span className="text-xs font-medium text-emerald-400 animate-in fade-in">
                {quickActionFeedback}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <input
                type="text"
                value={targetIdInput}
                onChange={(e) => setTargetIdInput(e.target.value)}
                placeholder="Enter Telegram User ID (e.g. 5829104)..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <input
                type="number"
                min="1"
                value={quickAmountInput}
                onChange={(e) => setQuickAmountInput(e.target.value)}
                placeholder={`Amount (${config.currencySymbol})...`}
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
              />
            </div>

            <div className="sm:col-span-5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleQuickLookup}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dossier</span>
              </button>

              <button
                type="button"
                onClick={handleQuickAddBalance}
                className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bal</span>
              </button>

              <button
                type="button"
                onClick={handleQuickDeductBalance}
                className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Deduct</span>
              </button>

              <button
                type="button"
                onClick={handleQuickDeleteUser}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3 text-right">Balance</th>
                <th className="py-2.5 px-3 text-right">Referrals</th>
                <th className="py-2.5 px-3 text-right">Ref Earnings</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {userList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-mono text-slate-400">{u.id}</td>
                  <td className="py-3 px-3 font-semibold text-white">
                    {u.firstName} {u.username && <span className="text-slate-500 text-[11px]">(@{u.username})</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {config.currencySymbol}{u.balance.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{u.referralCount}</td>
                  <td className="py-3 px-3 text-right font-mono text-purple-400">
                    {config.currencySymbol}{(u.referralEarnings || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {u.isBanned ? (
                      <span className="text-rose-400 font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11px]">
                        Banned
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setSelectedUserForInfo(u)}
                        title="View User Dossier"
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors flex items-center gap-1 border border-slate-700"
                      >
                        <Info className="w-3 h-3 text-cyan-400" />
                        <span>Info</span>
                      </button>

                      <button
                        onClick={() => setBalanceModal({ isOpen: true, type: 'add', targetUser: u, amount: '' })}
                        title="Add balance"
                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[11px] transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Bal</span>
                      </button>

                      <button
                        onClick={() => setBalanceModal({ isOpen: true, type: 'remove', targetUser: u, amount: '' })}
                        title="Deduct balance"
                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[11px] transition-colors flex items-center gap-1"
                      >
                        <Minus className="w-3 h-3" />
                        <span>Deduct</span>
                      </button>

                      {u.id !== config.adminId && (
                        <>
                          <button
                            onClick={() => toggleBanUser(u.id)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${
                              u.isBanned
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/20'
                            }`}
                          >
                            {u.isBanned ? 'Unban' : 'Ban'}
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to permanently delete User ${u.firstName} (ID: ${u.id}) from the database?`)) {
                                deleteUser(u.id);
                              }
                            }}
                            title="Delete user from database"
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded text-[11px] transition-colors flex items-center gap-1 font-semibold"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Info Dossier Modal */}
      {selectedUserForInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>User Dossier: {selectedUserForInfo.firstName}</span>
              </h3>
              <button
                onClick={() => setSelectedUserForInfo(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Telegram User ID:</span>
                <span className="font-mono text-white font-semibold">{selectedUserForInfo.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Username:</span>
                <span className="font-mono text-cyan-300">@{selectedUserForInfo.username || 'none'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-mono font-bold text-emerald-400">{config.currencySymbol}{selectedUserForInfo.balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Direct Referrals:</span>
                <span className="font-mono text-white">{selectedUserForInfo.referralCount} users</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Lifetime Ref Commission:</span>
                <span className="font-mono text-purple-400 font-bold">{config.currencySymbol}{(selectedUserForInfo.referralEarnings || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Referred By:</span>
                <span className="font-mono text-slate-400">{selectedUserForInfo.referredBy ? `ID ${selectedUserForInfo.referredBy}` : 'Direct (Organic)'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Completed Tasks:</span>
                <span className="font-mono text-white">{selectedUserForInfo.tasksCompleted}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Account Status:</span>
                <span className={selectedUserForInfo.isBanned ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {selectedUserForInfo.isBanned ? 'BANNED' : 'Active'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Joined Date:</span>
                <span>{new Date(selectedUserForInfo.joinedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              {selectedUserForInfo.id !== config.adminId && (
                <button
                  onClick={() => {
                    if (window.confirm(`Permanently delete user ${selectedUserForInfo.firstName} (ID: ${selectedUserForInfo.id}) from the database?`)) {
                      deleteUser(selectedUserForInfo.id);
                      setSelectedUserForInfo(null);
                    }
                  }}
                  className="flex-1 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User</span>
                </button>
              )}
              <button
                onClick={() => setSelectedUserForInfo(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Remove Balance Modal */}
      {balanceModal.isOpen && balanceModal.targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <span>
                  {balanceModal.type === 'add' ? 'Add Balance' : 'Deduct Balance'}
                </span>
              </h3>
              <button
                onClick={() => setBalanceModal({ isOpen: false, type: 'add', amount: '' })}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300">
              User: <strong className="text-white">{balanceModal.targetUser.firstName}</strong> (<code>{balanceModal.targetUser.id}</code>)<br/>
              Current Balance: <strong className="text-emerald-400 font-mono">{config.currencySymbol}{balanceModal.targetUser.balance.toFixed(2)}</strong>
            </div>

            <form onSubmit={handleBalanceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Amount to {balanceModal.type === 'add' ? 'Credit' : 'Deduct'} ({config.currencySymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  autoFocus
                  value={balanceModal.amount}
                  onChange={(e) => setBalanceModal(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  placeholder="e.g. 50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBalanceModal({ isOpen: false, type: 'add', amount: '' })}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                    balanceModal.type === 'add'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {balanceModal.type === 'add' ? 'Confirm Credit' : 'Confirm Debit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
