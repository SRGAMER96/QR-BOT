import React from 'react';
import { useBot } from '../context/BotContext';
import { ViewTab } from '../types/bot';
import { Bot, Shield, Code, Server, Settings, RotateCcw, Smartphone } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { currentTab, setCurrentTab, resetAllData, activeTask, withdrawals, proofs } = useBot();

  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length;
  const pendingProofsCount = proofs.filter(p => p.status === 'pending').length;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white block">
              TeleQR Engine
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <a
                href="https://t.me/QR_WORK_ON_BOT"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 font-semibold flex items-center gap-1.5 hover:underline"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Live on Telegram: @QR_WORK_ON_BOT</span>
              </a>
              <span aria-hidden="true">·</span>
              <span className={activeTask?.isLocked ? 'text-amber-400 font-medium' : 'text-slate-400 font-medium'}>
                {activeTask?.isLocked ? 'Task Locked' : 'QR Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setCurrentTab('miniapp')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'miniapp'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-sm shadow-cyan-500/20'
                : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/20'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mini App</span>
          </button>

          <button
            onClick={() => setCurrentTab('simulator')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'simulator'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Bot Simulator</span>
          </button>

          <button
            onClick={() => setCurrentTab('admin_panel')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 relative ${
              currentTab === 'admin_panel'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Center</span>
            {(pendingWithdrawalsCount > 0 || pendingProofsCount > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setCurrentTab('source_code')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'source_code'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Source Code</span>
          </button>

          <button
            onClick={() => setCurrentTab('deployment_guide')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentTab === 'deployment_guide'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Deployment</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (window.confirm('Reset all demo users, balances, and tasks to default?')) {
                resetAllData();
              }
            }}
            title="Reset demo data"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>Bot Config</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden items-center justify-around gap-1 mt-3 pt-2 border-t border-slate-800/80">
        <button
          onClick={() => setCurrentTab('simulator')}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            currentTab === 'simulator' ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-400'
          }`}
        >
          Simulator
        </button>
        <button
          onClick={() => setCurrentTab('admin_panel')}
          className={`px-2.5 py-1 text-xs font-medium rounded relative ${
            currentTab === 'admin_panel' ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-400'
          }`}
        >
          Admin
          {(pendingWithdrawalsCount > 0 || pendingProofsCount > 0) && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-0" />
          )}
        </button>
        <button
          onClick={() => setCurrentTab('source_code')}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            currentTab === 'source_code' ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-400'
          }`}
        >
          Source Code
        </button>
        <button
          onClick={() => setCurrentTab('deployment_guide')}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            currentTab === 'deployment_guide' ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-400'
          }`}
        >
          Deploy
        </button>
      </div>
    </header>
  );
};
