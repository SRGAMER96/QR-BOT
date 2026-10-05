import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LiveTelegramBotRunner } from './src/server/liveBot.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Instantiate Live Telegram Bot Runner
const liveBotRunner = new LiveTelegramBotRunner();

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    botRunning: liveBotRunner.isRunning,
    botUsername: liveBotRunner.botInfo?.username,
    timestamp: new Date().toISOString()
  });
});

// Live Bot Status & Metrics endpoint
app.get('/api/bot/status', (_req: Request, res: Response) => {
  const users = Object.values(liveBotRunner.db.data.users);
  const withdrawals = Object.values(liveBotRunner.db.data.withdrawals);
  const proofs = Object.values(liveBotRunner.db.data.proofs);

  res.json({
    isRunning: liveBotRunner.isRunning,
    botInfo: liveBotRunner.botInfo,
    lastError: liveBotRunner.lastError,
    config: liveBotRunner.config,
    stats: {
      totalUsers: users.length,
      totalActiveBalance: users.reduce((acc, u) => acc + u.balance, 0),
      totalPaidOut: withdrawals.filter(w => w.status === 'approved').reduce((acc, w) => acc + w.amount, 0),
      pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
      pendingProofs: proofs.filter(p => p.status === 'pending').length
    },
    activeTask: liveBotRunner.db.data.activeTask
  });
});

// Force restart bot runner
app.post('/api/bot/restart', async (_req: Request, res: Response) => {
  try {
    await liveBotRunner.stop();
    const result = await liveBotRunner.start();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Live Database export for Web Admin Panel
app.get('/api/bot/data', (_req: Request, res: Response) => {
  res.json(liveBotRunner.db.data);
});

// Admin: Delete QR
app.post('/api/bot/qr/delete', (_req: Request, res: Response) => {
  liveBotRunner.db.deleteActiveQR();
  res.json({ success: true, message: 'Active QR deleted' });
});

// Admin: Set QR
app.post('/api/bot/qr/set', (req: Request, res: Response) => {
  const { title, qrImageUrl, reward, instructions } = req.body;
  if (!qrImageUrl || !reward) {
    return res.status(400).json({ success: false, error: 'qrImageUrl and reward required' });
  }

  liveBotRunner.db.data.activeTask = {
    id: 'task_' + Date.now(),
    title: title || 'Official Scan & Earn Drop',
    qrImageUrl,
    reward: parseFloat(reward),
    instructions: instructions || 'Scan QR with any UPI app, complete payment, and upload proof.',
    isLocked: false,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  liveBotRunner.db.save();
  res.json({ success: true, activeTask: liveBotRunner.db.data.activeTask });
});

// Admin: Delete User
app.post('/api/bot/users/delete', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  const numId = parseInt(userId, 10);
  if (numId === liveBotRunner.config.adminId) {
    return res.status(400).json({ success: false, error: 'Cannot delete master admin' });
  }

  const ok = liveBotRunner.db.deleteUser(numId);
  res.json({ success: ok });
});

// Admin: Ban / Unban User
app.post('/api/bot/users/ban', (req: Request, res: Response) => {
  const { userId, isBanned } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  const ok = liveBotRunner.db.setBan(parseInt(userId, 10), !!isBanned);
  res.json({ success: ok });
});

// Admin: Adjust Balance (Add / Deduct)
app.post('/api/bot/users/balance', (req: Request, res: Response) => {
  const { userId, amount, action } = req.body;
  if (!userId || amount === undefined) {
    return res.status(400).json({ success: false, error: 'userId and amount required' });
  }

  const delta = action === 'remove' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
  const newBal = liveBotRunner.db.adjustBalance(parseInt(userId, 10), delta);
  res.json({ success: true, newBalance: newBal });
});

// Admin: Update Settings (Ref commission %, Min withdrawal)
app.post('/api/bot/settings/update', (req: Request, res: Response) => {
  const { referralCommissionPercent, minWithdrawal } = req.body;

  if (referralCommissionPercent !== undefined) {
    liveBotRunner.db.setReferralPercent(parseFloat(referralCommissionPercent));
  }
  if (minWithdrawal !== undefined) {
    liveBotRunner.db.setMinWithdrawal(parseFloat(minWithdrawal));
  }

  res.json({ success: true, settings: liveBotRunner.db.data.settings });
});

// Broadcast 12:00 Status Ping to all users & admin
app.post('/api/bot/broadcast-status-ping', async (_req: Request, res: Response) => {
  try {
    const result = await liveBotRunner.broadcastStatusPing();
    res.json({
      success: true,
      details: liveBotRunner.getLiveBotDetailsMessage(),
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook / Verify proxy
app.post('/api/telegram/verify', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ ok: false, error: 'Token is required' });
  }

  try {
    const telegramRes = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
    const data = await telegramRes.json();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to reach Telegram API' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Start the Live Telegram Bot right now!
  liveBotRunner.start().then((res) => {
    if (res.success) {
      console.log(`🤖 Live Bot Online: @${res.botInfo?.username} (ID: ${res.botInfo?.id})`);
    } else {
      console.error('⚠️ Could not start Telegram Bot:', res.error);
    }
  });

  if (!isProd) {
    // Development mode with Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Suite listening on http://0.0.0.0:${PORT}`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`Received ${signal}, cleanly shutting down Telegram bot and HTTP server...`);
    try {
      await liveBotRunner.stop();
    } catch {}
    server.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', () => handleShutdown('SIGINT'));
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
