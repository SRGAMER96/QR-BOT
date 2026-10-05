import React, { useState } from 'react';
import { BotProvider, useBot } from './context/BotContext';
import { Header } from './components/Header';
import { TelegramSimulator } from './components/TelegramSimulator';
import { AdminWebPanel } from './components/AdminWebPanel';
import { CodeExplorer } from './components/CodeExplorer';
import { DeploymentGuide } from './components/DeploymentGuide';
import { MiniAppView } from './components/MiniAppView';
import { LiveBotConfigModal } from './components/LiveBotConfigModal';

const AppContent: React.FC = () => {
  const { currentTab, setCurrentTab } = useBot();
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Auto-switch to Mini App if accessed via Telegram WebApp link (?view=miniapp)
  React.useEffect(() => {
    if (window.location.search.includes('view=miniapp')) {
      setCurrentTab('miniapp');
    }
  }, [setCurrentTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      <Header onOpenSettings={() => setIsConfigOpen(true)} />

      <main className="flex-1 pb-16">
        {currentTab === 'miniapp' && <MiniAppView />}
        {currentTab === 'simulator' && <TelegramSimulator />}
        {currentTab === 'admin_panel' && <AdminWebPanel />}
        {currentTab === 'source_code' && <CodeExplorer />}
        {currentTab === 'deployment_guide' && <DeploymentGuide />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Telegram QR Earning Bot Suite</span>
            <span aria-hidden="true">·</span>
            <span>Production Source Code & Simulator</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Powered by grammY & python-telegram-bot v20+ Async Engines
          </div>
        </div>
      </footer>

      <LiveBotConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <BotProvider>
      <AppContent />
    </BotProvider>
  );
}
