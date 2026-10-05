import React, { useState, useRef, useEffect } from 'react';
import { useBot } from '../context/BotContext';
import { ActivePersona } from '../types/bot';
import { BOT_KEYBOARD_BUTTONS } from '../utils/unicodeFonts';
import {
  Send,
  Image as ImageIcon,
  CheckCheck,
  Lock,
  Unlock,
  AlertCircle,
  ExternalLink,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const TelegramSimulator: React.FC = () => {
  const {
    messages,
    sendMessage,
    handleCallbackQuery,
    currentUser,
    activePersona,
    setActivePersona,
    activeTask,
    config,
    users
  } = useBot();

  const [inputVal, setInputVal] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    sendMessage(inputVal.trim());
    setInputVal('');
  };

  const handleSimulatePhotoUpload = () => {
    const sampleProofScreenshots = [
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80'
    ];
    const randomPic = sampleProofScreenshots[Math.floor(Math.random() * sampleProofScreenshots.length)];
    sendMessage('Attached Proof Screenshot (UTR: ' + Math.floor(100000000000 + Math.random() * 900000000000) + ')', randomPic);
  };

  // Render HTML strings safely with minimal tags
  const renderMessageContent = (html: string) => {
    return { __html: html.replace(/\n/g, '<br/>') };
  };

  const getPersonaBadge = (persona: ActivePersona) => {
    switch (persona) {
      case 'user_1':
        return { label: 'User A (Alex)', icon: UserCheck, desc: 'Established Member' };
      case 'user_2':
        return { label: 'User B (Samira)', icon: UserPlus, desc: 'Referred by Alex' };
      case 'admin':
        return { label: 'Chief Admin', icon: ShieldCheck, desc: 'Exclusive Admin Access' };
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Top Banner: Explanation and Persona Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Live Telegram Bot Simulator
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Multi-User Concurrency Engine</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Switch between users to test race-condition QR task locking, proof submission, and UPI cashouts, or switch to Admin to manage verification and broadcasts.
            </p>
          </div>

          {/* Persona selector tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {(['user_1', 'user_2', 'admin'] as ActivePersona[]).map(p => {
              const info = getPersonaBadge(p);
              const Icon = info.icon;
              const isActive = activePersona === p;
              return (
                <button
                  key={p}
                  onClick={() => setActivePersona(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Current User:</span>
            <span className="font-semibold text-white">{currentUser.firstName}</span>
            <span className="text-slate-500 font-mono text-[11px]">({currentUser.id})</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Balance:</span>
            <span className="font-bold text-emerald-400 font-mono tabular-nums">
              {config.currencySymbol}{currentUser.balance.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Task Lock State:</span>
            {activeTask?.isLocked ? (
              <span className="font-medium text-amber-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Locked by {activeTask.lockedByUserName || 'Member'}
              </span>
            ) : (
              <span className="font-medium text-emerald-400 flex items-center gap-1">
                <Unlock className="w-3 h-3" />
                Available to Claim
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">Referrals:</span>
            <span className="font-semibold text-cyan-400 font-mono tabular-nums">{currentUser.referralCount}</span>
            {currentUser.isBanned && (
              <span className="text-rose-400 font-semibold ml-1">· BANNED</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Telegram Chat Window */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[700px]">
        {/* Telegram Header */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                QR
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  QR KING
                </h3>
                <span className="bg-blue-500 text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full">
                  ✓
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                @QR_WORK_ON_BOT <span className="text-emerald-400 font-semibold">· 🟢 Live & Responding</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://t.me/QR_WORK_ON_BOT"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Open on Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Simulating as: <strong className="text-cyan-400">{currentUser.firstName}</strong>
            </span>
          </div>
        </div>

        {/* Message Feed */}
        <div
          ref={chatScrollRef}
          className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40 selection:bg-cyan-500/20"
          style={{
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.senderRole === 'user' || msg.senderRole === 'admin';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-sm ${
                    isUser
                      ? 'bg-cyan-600/90 text-white rounded-br-none border border-cyan-500/30'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                  }`}
                >
                  {/* Photo attachment if present */}
                  {msg.photoUrl && (
                    <div className="mb-2.5 overflow-hidden rounded-xl bg-slate-950/60 border border-slate-700/50">
                      <img
                        src={msg.photoUrl}
                        alt="Task attachment"
                        className="w-full max-h-60 object-contain mx-auto bg-black/40"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Message body */}
                  <div
                    className="leading-relaxed break-words font-sans text-[13.5px]"
                    dangerouslySetInnerHTML={renderMessageContent(msg.text)}
                  />

                  {/* Timestamp & Delivery status */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isUser ? 'text-cyan-100' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {isUser && <CheckCheck className="w-3 h-3 text-cyan-200" />}
                  </div>
                </div>

                {/* Inline Keyboard Buttons */}
                {msg.inlineButtons && msg.inlineButtons.length > 0 && (
                  <div className="mt-1.5 w-full max-w-[85%] sm:max-w-[75%] space-y-1.5">
                    {msg.inlineButtons.map((row, rIdx) => (
                      <div key={rIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                        {row.map((btn, bIdx) => {
                          if (btn.url) {
                            return (
                              <a
                                key={bIdx}
                                href={btn.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold rounded-xl text-center transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <span>{btn.text}</span>
                                <ExternalLink className="w-3 h-3 text-cyan-400" />
                              </a>
                            );
                          }

                          return (
                            <button
                              key={bIdx}
                              onClick={() => handleCallbackQuery(btn.callbackData)}
                              className="px-3 py-2 bg-slate-800/90 hover:bg-cyan-600 hover:text-white border border-slate-700/80 text-cyan-300 text-xs font-semibold rounded-xl text-center transition-colors shadow-sm active:scale-[0.98]"
                            >
                              {btn.text}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Command Suggestions Pill Bar */}
        <div className="bg-slate-950 px-4 py-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-500 font-medium shrink-0 mr-1">Quick:</span>
          <button
            onClick={() => sendMessage('/start')}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-md shrink-0 border border-slate-700/60"
          >
            /start
          </button>
          <button
            onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.START_EARN)}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-md shrink-0 border border-slate-700/60"
          >
            {BOT_KEYBOARD_BUTTONS.START_EARN}
          </button>
          <button
            onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.PROFILE)}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-md shrink-0 border border-slate-700/60"
          >
            {BOT_KEYBOARD_BUTTONS.PROFILE}
          </button>
          <button
            onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.REFER_EARN)}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-md shrink-0 border border-slate-700/60"
          >
            {BOT_KEYBOARD_BUTTONS.REFER_EARN}
          </button>
          <button
            onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.WITHDRAW)}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-md shrink-0 border border-slate-700/60"
          >
            {BOT_KEYBOARD_BUTTONS.WITHDRAW}
          </button>
          <button
            onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.ADMIN_PANEL)}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-md shrink-0 border border-slate-700/60"
          >
            {BOT_KEYBOARD_BUTTONS.ADMIN_PANEL}
          </button>
        </div>

        {/* Persistent Stylized Reply Keyboard (Exact requirement from user prompt) */}
        <div className="bg-slate-900 p-2.5 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.START_EARN)}
              className="py-2.5 px-3 bg-slate-800 hover:bg-cyan-600 hover:text-white border border-slate-700/70 text-slate-100 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>{BOT_KEYBOARD_BUTTONS.START_EARN}</span>
            </button>
            <button
              onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.PROFILE)}
              className="py-2.5 px-3 bg-slate-800 hover:bg-cyan-600 hover:text-white border border-slate-700/70 text-slate-100 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>{BOT_KEYBOARD_BUTTONS.PROFILE}</span>
            </button>
            <button
              onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.REFER_EARN)}
              className="py-2.5 px-3 bg-slate-800 hover:bg-cyan-600 hover:text-white border border-slate-700/70 text-slate-100 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>{BOT_KEYBOARD_BUTTONS.REFER_EARN}</span>
            </button>
            <button
              onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.WITHDRAW)}
              className="py-2.5 px-3 bg-slate-800 hover:bg-cyan-600 hover:text-white border border-slate-700/70 text-slate-100 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>{BOT_KEYBOARD_BUTTONS.WITHDRAW}</span>
            </button>
            <button
              onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.SUPPORT)}
              className="py-2.5 px-3 bg-slate-800 hover:bg-cyan-600 hover:text-white border border-slate-700/70 text-slate-100 font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>{BOT_KEYBOARD_BUTTONS.SUPPORT}</span>
            </button>
            <button
              onClick={() => sendMessage(BOT_KEYBOARD_BUTTONS.ADMIN_PANEL)}
              className={`py-2.5 px-3 border text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] ${
                currentUser.id === config.adminId
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                  : 'bg-slate-800/60 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <span>{BOT_KEYBOARD_BUTTONS.ADMIN_PANEL}</span>
              {currentUser.id !== config.adminId && (
                <span className="text-[10px] text-slate-500 font-normal">(Admin Only)</span>
              )}
            </button>
          </div>
        </div>

        {/* Input bar */}
        <form onSubmit={handleSend} className="bg-slate-950 p-3 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSimulatePhotoUpload}
            title="Simulate uploading a payment proof screenshot"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors shrink-0"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type a message or command (e.g. /start or UTR number)..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-bold transition-all shrink-0 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
