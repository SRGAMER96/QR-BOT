import React from 'react';
import {
  Server,
  Terminal,
  Shield,
  Zap,
  Key,
  Layers,
  HelpCircle,
  Copy,
  ExternalLink
} from 'lucide-react';

export const DeploymentGuide: React.FC = () => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Server className="w-6 h-6 text-cyan-400" />
          <span>Complete Bot Setup & Deployment Guide</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Follow these production-tested steps to deploy your Telegram QR Earning Bot 24/7 on any cloud provider or Linux VPS.
        </p>
      </div>

      {/* Step 1: Obtain Bot Token & Admin ID */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Key className="w-4 h-4" />
          <span>Step 1: Obtain Your Bot Credentials from Telegram</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white">1. Get Your Bot Token from @BotFather</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
              <li>Open Telegram and search for <code>@BotFather</code>.</li>
              <li>Send <code>/newbot</code> command.</li>
              <li>Choose a display name (e.g. <i>QR Cash Official</i>).</li>
              <li>Choose a username ending with <code>bot</code> (e.g. <i>QREarnProBot</i>).</li>
              <li>Copy the HTTP API Token (e.g. <code>7123456789:AA...</code>).</li>
            </ol>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white">2. Get Your Numeric Admin User ID</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
              <li>Open Telegram and search for <code>@userinfobot</code>.</li>
              <li>Send <code>/start</code>.</li>
              <li>It will return your unique numeric <b>Id</b> (e.g. <code>123456789</code>).</li>
              <li>This ID grants exclusive master access to the <code>🛠️ Admin Panel</code>.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Step 2: Linux VPS Deployment with systemd */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Terminal className="w-4 h-4" />
            <span>Step 2: Deploy on Linux VPS (Ubuntu / Debian with systemd)</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Recommended for 24/7 Uptime
          </span>
        </div>

        <p className="text-xs text-slate-300">
          A <code>systemd</code> service ensures that your bot starts automatically upon VPS reboot and restarts immediately if an error occurs.
        </p>

        {/* Terminal Commands Block */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-200 relative">
          <button
            onClick={() => copyToClipboard(vpsBashScript, 'vps_script')}
            className="absolute top-3 right-3 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            <span>{copiedId === 'vps_script' ? 'Copied!' : 'Copy Commands'}</span>
          </button>
          <pre className="overflow-x-auto text-[12px] leading-relaxed">
            {vpsBashScript}
          </pre>
        </div>

        {/* systemd Service File */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">
            Create systemd Service File (<code>/etc/systemd/system/tele-qr-bot.service</code>):
          </h4>
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-200 relative">
            <button
              onClick={() => copyToClipboard(systemdConfig, 'systemd_conf')}
              className="absolute top-3 right-3 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedId === 'systemd_conf' ? 'Copied!' : 'Copy File'}</span>
            </button>
            <pre className="overflow-x-auto text-[12px] leading-relaxed">
              {systemdConfig}
            </pre>
          </div>
        </div>
      </div>

      {/* Step 3: Docker & Cloud Deployment (Render / Railway) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Layers className="w-4 h-4" />
          <span>Step 3: Docker & Cloud Containers (Railway / Render / Cloud Run)</span>
        </div>

        <p className="text-xs text-slate-300">
          Deploying via Docker requires zero manual dependency installation. Both Node.js and Python projects include verified Dockerfiles.
        </p>

        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-200">
          <pre className="overflow-x-auto leading-relaxed">
{`# 1. Build Docker image
docker build -t telegram-qr-earning-bot .

# 2. Run container in background with restart policy
docker run -d --restart=always \\
  --name qr-bot \\
  --env-file .env \\
  -v $(pwd)/bot_data.json:/app/bot_data.json \\
  telegram-qr-earning-bot`}
          </pre>
        </div>
      </div>

      {/* Production Architecture & Security Highlights */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
          <Shield className="w-4 h-4" />
          <span>High-Load Architecture & Security Invariants</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <h5 className="font-semibold text-white">Concurrency Task Locking</h5>
            <p className="text-[11px] text-slate-400">
              When a user submits proof for an active QR, the task status flips to locked. Other users are prevented from submitting duplicate claims for that specific QR until admin approves or resets.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <h5 className="font-semibold text-white">Instant UPI Debit & Refund</h5>
            <p className="text-[11px] text-slate-400">
              Withdrawal requests immediately debit the user balance to eliminate double-spend attempts. If admin clicks "Reject", the full amount is atomically restored to the user's wallet.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <h5 className="font-semibold text-white">Rate-Limited Broadcasts</h5>
            <p className="text-[11px] text-slate-400">
              The broadcast engine features a 40ms pacing delay between outgoing updates to stay strictly within Telegram Bot API limits (max 30 msgs/sec).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const vpsBashScript = `# 1. Update OS and install Node.js 20 & Git
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Create project directory
sudo mkdir -p /opt/telegram-qr-bot
cd /opt/telegram-qr-bot

# 3. Extract your downloaded bot files or git clone here
# Unzip telegram-qr-bot-nodejs.zip into /opt/telegram-qr-bot

# 4. Install dependencies & build TypeScript
npm install
npm run build

# 5. Automatically create production .env file with your credentials:
cat << 'EOF' > .env
BOT_TOKEN=8916389057:AAFVwogT5jrAokNoBmJix_5yd4_0pfZqUfk
ADMIN_ID=8962632792
SUPPORT_USERNAME=SRGAMER96
CURRENCY_SYMBOL=₹
MIN_WITHDRAWAL=30
REFERRAL_COMMISSION_PERCENT=10
EOF`;

const systemdConfig = `[Unit]
Description=Telegram QR Earning Bot Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/telegram-qr-bot
ExecStart=/usr/bin/node /opt/telegram-qr-bot/dist/bot.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Commands to enable and run:
# sudo systemctl daemon-reload
# sudo systemctl enable --now tele-qr-bot
# sudo systemctl status tele-qr-bot`;
