import React, { useState } from 'react';
import { NODE_SOURCE_FILES, PYTHON_SOURCE_FILES, CodeFile } from '../data/sourceCode';
import JSZip from 'jszip';
import {
  Code,
  Copy,
  Check,
  Download,
  FileCode,
  Terminal,
  FileText,
  Boxes
} from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedRuntime, setSelectedRuntime] = useState<'nodejs' | 'python'>('nodejs');
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  const currentFiles: CodeFile[] = selectedRuntime === 'nodejs' ? NODE_SOURCE_FILES : PYTHON_SOURCE_FILES;
  const activeFile: CodeFile = currentFiles[activeFileIndex] || currentFiles[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      const zip = new JSZip();
      const folderName = selectedRuntime === 'nodejs' ? 'telegram-qr-bot-nodejs' : 'telegram-qr-bot-python';
      const rootFolder = zip.folder(folderName)!;

      currentFiles.forEach(file => {
        rootFolder.file(file.path, file.content);
      });

      // Add a handy README file
      const readmeContent = `# Telegram QR Earning Bot
Runtime: ${selectedRuntime === 'nodejs' ? 'Node.js (grammY)' : 'Python (python-telegram-bot v20+)'}

## Quick Setup
1. Copy .env.example to .env
2. Fill your BOT_TOKEN (from @BotFather) and ADMIN_ID (from @userinfobot)
3. Install dependencies:
   ${selectedRuntime === 'nodejs' ? 'npm install && npm run build && npm start' : 'pip install -r requirements.txt && python bot.py'}
4. Open your bot on Telegram and send /start!
`;
      rootFolder.file('README.md', readmeContent);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to generate zip:', e);
      alert('Could not generate ZIP archive.');
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Top Header & Runtime Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <Code className="w-6 h-6 text-cyan-400" />
            <span>Production-Ready Source Code Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Downloadable, tested, and complete implementations for both Node.js (grammY) and Python (python-telegram-bot v20+).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Framework Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setSelectedRuntime('nodejs');
                setActiveFileIndex(0);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedRuntime === 'nodejs'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Node.js (grammY)</span>
            </button>
            <button
              onClick={() => {
                setSelectedRuntime('python');
                setActiveFileIndex(0);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedRuntime === 'python'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Python (PTB v20+)</span>
            </button>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingZip ? 'Packing...' : 'Download ZIP'}</span>
          </button>
        </div>
      </div>

      {/* Code Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* File Navigator Sidebar */}
        <div className="lg:col-span-3 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block px-1">
            Project Files ({currentFiles.length})
          </span>

          <div className="space-y-1">
            {currentFiles.map((file, idx) => (
              <button
                key={file.name}
                onClick={() => {
                  setActiveFileIndex(idx);
                  setCopied(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-start gap-2.5 ${
                  activeFileIndex === idx
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-transparent'
                }`}
              >
                <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${activeFileIndex === idx ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div className="overflow-hidden">
                  <span className="font-mono block truncate font-semibold">{file.name}</span>
                  <span className="text-[11px] text-slate-500 block truncate">{file.description}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 mt-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Features Included</span>
            </h4>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li>Styled Unicode fonts for buttons</li>
              <li>Concurrency lock on active QR</li>
              <li>Admin proof verification flow</li>
              <li>Instant UPI payout with refund logic</li>
              <li>Deep-linked referral accounting</li>
              <li>Admin broadcast with confirmation</li>
              <li>Ban/Unban access control by ID</li>
            </ul>
          </div>
        </div>

        {/* Code Viewer Panel */}
        <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
          {/* File Header Bar */}
          <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white">{activeFile.path}</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">· {activeFile.description}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Syntax display */}
          <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-[650px] leading-relaxed selection:bg-cyan-500/30">
            <pre className="tab-4">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
