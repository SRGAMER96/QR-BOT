import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';

// Unicode styling helper
export function toBoldSans(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      result += String.fromCodePoint(0x1d5d4 + (code - 65));
    } else if (code >= 97 && code <= 122) {
      result += String.fromCodePoint(0x1d5ee + (code - 97));
    } else if (code >= 48 && code <= 57) {
      result += String.fromCodePoint(0x1d7ec + (code - 48));
    } else {
      result += text[i];
    }
  }
  return result;
}

export interface UserRecord {
  id: number;
  firstName: string;
  username?: string;
  balance: number;
  referralCount: number;
  referredBy?: number;
  referralEarnings: number;
  isBanned: boolean;
  tasksCompleted: number;
  joinedAt: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  qrImageUrl: string;
  reward: number;
  instructions: string;
  isLocked: boolean;
  lockedByUserId?: number;
  lockedByUserName?: string;
  status: 'active' | 'in_review' | 'claimed';
  createdAt: string;
}

export interface ProofRecord {
  id: string;
  userId: number;
  userName: string;
  userUsername?: string;
  taskId: string;
  taskTitle: string;
  reward: number;
  proofImageUrl?: string;
  proofText?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: number;
  userName: string;
  userUsername?: string;
  upiId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface BotSettings {
  minWithdrawal: number;
  referralCommissionPercent: number;
  currency: string;
}

export interface LiveDbSchema {
  users: Record<number, UserRecord>;
  activeTask: TaskRecord | null;
  proofs: Record<string, ProofRecord>;
  withdrawals: Record<string, WithdrawalRecord>;
  settings: BotSettings;
}

export class LiveDatabase {
  private filePath: string;
  public data: LiveDbSchema;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.data = this.load();
  }

  private load(): LiveDbSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.settings) {
          parsed.settings = {
            minWithdrawal: 30,
            referralCommissionPercent: 10,
            currency: '₹'
          };
          this.save(parsed);
        } else if (!parsed.settings.minWithdrawal || parsed.settings.minWithdrawal === 50) {
          parsed.settings.minWithdrawal = 30;
          this.save(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load database, initializing defaults:', e);
    }

    const initial: LiveDbSchema = {
      users: {},
      activeTask: {
        id: 'task_001',
        title: 'Official Instant ₹50 UPI Cashback Drop',
        qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=earnqr@okaxis&pn=OfficialEarning&am=10&cu=INR',
        reward: 50,
        instructions: '1. Scan QR with Google Pay, PhonePe, or Paytm.\n2. Complete the verified ₹10 test transfer.\n3. Take a screenshot showing UTR number.\n4. Click Submit Proof below and upload your screenshot.',
        isLocked: false,
        status: 'active',
        createdAt: new Date().toISOString()
      },
      proofs: {},
      withdrawals: {},
      settings: {
        minWithdrawal: 30,
        referralCommissionPercent: 10,
        currency: '₹'
      }
    };
    this.save(initial);
    return initial;
  }

  public save(d = this.data) {
    try {
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(d, null, 2), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch (e) {
      console.error('Failed to atomically write live DB:', e);
    }
  }

  getUser(id: number): UserRecord | undefined {
    return this.data.users[id];
  }

  registerUser(info: { id: number; firstName: string; username?: string; referredBy?: number }): boolean {
    if (this.data.users[info.id]) {
      this.data.users[info.id].firstName = info.firstName;
      if (info.username) this.data.users[info.id].username = info.username;
      this.save();
      return false;
    }
    this.data.users[info.id] = {
      id: info.id,
      firstName: info.firstName,
      username: info.username,
      balance: 0,
      referralCount: 0,
      referredBy: info.referredBy,
      referralEarnings: 0,
      isBanned: false,
      tasksCompleted: 0,
      joinedAt: new Date().toISOString()
    };
    this.save();
    return true;
  }

  adjustBalance(userId: number, delta: number): number {
    const user = this.data.users[userId];
    if (user) {
      user.balance = Math.max(0, user.balance + delta);
      this.save();
      return user.balance;
    }
    return 0;
  }

  incrementReferrals(userId: number) {
    const user = this.data.users[userId];
    if (user) {
      user.referralCount += 1;
      this.save();
    }
  }

  addReferralEarnings(userId: number, commission: number) {
    const user = this.data.users[userId];
    if (user) {
      user.balance += commission;
      user.referralEarnings = (user.referralEarnings || 0) + commission;
      this.save();
    }
  }

  incrementTasks(userId: number) {
    const user = this.data.users[userId];
    if (user) {
      user.tasksCompleted += 1;
      this.save();
    }
  }

  setBan(userId: number, banned: boolean): boolean {
    const user = this.data.users[userId];
    if (user) {
      user.isBanned = banned;
      this.save();
      return true;
    }
    return false;
  }

  deleteUser(userId: number): boolean {
    if (this.data.users[userId]) {
      delete this.data.users[userId];
      this.save();
      return true;
    }
    return false;
  }

  deleteActiveQR() {
    this.data.activeTask = null;
    this.save();
  }

  setReferralPercent(percent: number) {
    this.data.settings.referralCommissionPercent = Math.max(0, percent);
    this.save();
  }

  setMinWithdrawal(amount: number) {
    this.data.settings.minWithdrawal = Math.max(1, amount);
    this.save();
  }

  getAllUserIds(): number[] {
    return Object.keys(this.data.users).map(Number);
  }
}

interface SessionData {
  step:
    | 'IDLE'
    | 'AWAITING_PROOF'
    | 'AWAITING_UPI_ID'
    | 'AWAITING_WITHDRAW_AMOUNT'
    | 'AWAITING_BROADCAST_TEXT'
    | 'AWAITING_NEW_QR_IMAGE'
    | 'AWAITING_NEW_QR_REWARD'
    | 'AWAITING_BAN_ID'
    | 'AWAITING_UNBAN_ID'
    | 'AWAITING_DELETE_USER_ID'
    | 'AWAITING_USER_INFO_ID'
    | 'AWAITING_ADD_BAL_USER_ID'
    | 'AWAITING_ADD_BAL_AMOUNT'
    | 'AWAITING_REM_BAL_USER_ID'
    | 'AWAITING_REM_BAL_AMOUNT'
    | 'AWAITING_REF_PERCENT';
  tempUpiId?: string;
  tempBroadcastText?: string;
  tempNewQrImage?: string;
  tempTargetUserId?: number;
  isTaskCancelled?: boolean;
  lastCancelledTaskId?: string;
  lastCancelledAt?: number;
}

type MyContext = Context & SessionFlavor<SessionData>;

export class LiveTelegramBotRunner {
  private bot: Bot<MyContext> | null = null;
  public db: LiveDatabase;
  public isRunning: boolean = false;
  public isPollingActive: boolean = false;
  public botInfo: any = null;
  public lastError: string | null = null;
  private shouldRun: boolean = true;
  private isReconnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private scheduledPingTimer: NodeJS.Timeout | null = null;
  public lastScheduledPingKey: string = '';
  public lastPingTimestamp: string | null = null;

  public config = {
    botToken: '8916389057:AAFVwogT5jrAokNoBmJix_5yd4_0pfZqUfk',
    adminId: 8962632792,
    supportUsername: 'SRGAMER96',
    currency: '₹'
  };

  constructor() {
    this.db = new LiveDatabase('./live_bot_data.json');
  }

  public getLiveBotDetailsMessage(): string {
    return (
      `🤖 Live Bot Details:\n` +
      `Bot Name: ${this.botInfo?.first_name || 'QR KING'}\n` +
      `Bot Username: @${this.botInfo?.username || 'QR_WORK_ON_BOT'}\n` +
      `Bot ID: ${this.botInfo?.id || '8916389057'}\n` +
      `Admin ID: ${this.config.adminId} (@${this.config.supportUsername})\n` +
      `Status: 🟢 Online 24/7`
    );
  }

  public async broadcastStatusPing(): Promise<{ sent: number; failed: number }> {
    const text = this.getLiveBotDetailsMessage();
    let sent = 0;
    let failed = 0;

    if (!this.bot) return { sent: 0, failed: 0 };
    this.lastPingTimestamp = new Date().toISOString();

    // 1. Send to Master Admin
    try {
      await this.bot.api.sendMessage(this.config.adminId, text);
      sent++;
    } catch (e) {
      console.warn('Could not send status ping to admin:', e);
      failed++;
    }

    // 2. Send to all registered subscribers
    const allUserIds = this.db.getAllUserIds();
    for (const uid of allUserIds) {
      if (uid === this.config.adminId) continue;
      try {
        await this.bot.api.sendMessage(uid, text);
        sent++;
        await new Promise((r) => setTimeout(r, 40));
      } catch {
        failed++;
      }
    }

    console.log(`📡 Automated 12:00 status ping completed: Sent ${sent}, Failed ${failed}`);
    return { sent, failed };
  }

  private startScheduledPings() {
    if (this.scheduledPingTimer) return;

    // Check time every 20 seconds for 12:00 AM (00:00) and 12:00 PM (12:00)
    this.scheduledPingTimer = setInterval(async () => {
      if (!this.shouldRun || !this.bot) return;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Exactly 12:00 AM (00:00) or 12:00 PM (12:00)
      if ((hours === 0 && minutes === 0) || (hours === 12 && minutes === 0)) {
        const pingKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}_${hours}`;
        if (this.lastScheduledPingKey !== pingKey) {
          this.lastScheduledPingKey = pingKey;
          console.log(`⏰ [12:00 PING] Dispatching scheduled bot details broadcast for ${hours === 0 ? '12:00 AM' : '12:00 PM'}...`);
          await this.broadcastStatusPing();
        }
      }
    }, 20000);
  }

  private async setupMenuButton() {
    if (!this.bot) return;
    try {
      await this.bot.api.setChatMenuButton({
        menu_button: { type: 'commands' }
      });

      await this.bot.api.setMyCommands([
        { command: 'start', description: '🚀 Open Main Menu & Options' },
        { command: 'admin', description: '🛠️ Master Admin Control Panel' }
      ]);
      console.log('📱 Telegram Chat Menu Button configured cleanly with bot commands.');
    } catch (e) {
      console.warn('Could not configure telegram chat menu button:', e);
    }
  }

  public async start(): Promise<{ success: boolean; botInfo?: any; error?: string }> {
    this.shouldRun = true;

    if (this.isRunning && this.bot && this.isPollingActive) {
      return { success: true, botInfo: this.botInfo };
    }

    try {
      if (!this.bot) {
        console.log('🤖 Initializing Live Telegram Bot with token:', this.config.botToken.substring(0, 15) + '...');
        this.bot = new Bot<MyContext>(this.config.botToken);

        // Global Error Handler - Prevents unhandled rejections from ever stopping the bot!
        this.bot.catch((err) => {
          console.error(`⚠️ Telegram Bot Handler Error:`, err.error || err);
        });

        this.setupHandlers(this.bot);
      }

      this.botInfo = await this.bot.api.getMe();
      console.log(`✅ Telegram API Connected: @${this.botInfo.username} (${this.botInfo.first_name})`);

      this.startPollingLoop();
      this.startWatchdog();
      this.startScheduledPings();
      this.setupMenuButton();

      this.isRunning = true;
      this.lastError = null;
      return { success: true, botInfo: this.botInfo };
    } catch (err: any) {
      console.error('❌ Failed to start Live Telegram Bot:', err);
      this.isRunning = false;
      this.lastError = err.message || 'Unknown error starting bot';

      // Auto-retry in 3 seconds if failed
      setTimeout(() => {
        if (this.shouldRun) {
          this.start().catch(() => {});
        }
      }, 3000);

      return { success: false, error: this.lastError || undefined };
    }
  }

  private async startPollingLoop() {
    if (!this.bot || this.isPollingActive || this.isReconnecting) return;

    this.isPollingActive = true;
    console.log(`🚀 Starting 24/7 long-polling for @${this.botInfo?.username || 'bot'}...`);

    try {
      // Clear any stale webhook or pending state on Telegram servers
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
    } catch {
      // Ignore webhook clear error
    }

    this.bot
      .start({
        onStart: (info) => {
          this.isRunning = true;
          this.isPollingActive = true;
          this.botInfo = info;
          this.lastError = null;
          console.log(`⚡ Live Telegram Bot @${info.username} is ACTIVE 24/7 and responding to users!`);
        },
        drop_pending_updates: false
      })
      .then(() => {
        console.warn('ℹ️ Telegram polling cycle ended normally.');
      })
      .catch((err) => {
        const errMsg = String(err?.message || err);
        const isConflict = errMsg.includes('409') || errMsg.includes('Conflict');

        if (isConflict) {
          console.warn('⚠️ Telegram 409 Conflict: another connection is releasing. Waiting 5s before reconnecting...');
          this.lastError = '409 Conflict (reconnecting gracefully)';
          this.scheduleReconnect(5000);
        } else {
          console.error('⚠️ Telegram long-polling encountered error:', errMsg);
          this.lastError = errMsg;
          this.scheduleReconnect(2000);
        }
      })
      .finally(() => {
        this.isPollingActive = false;
        if (this.shouldRun && !this.isReconnecting) {
          this.scheduleReconnect(2000);
        }
      });
  }

  private scheduleReconnect(delayMs: number) {
    if (this.isReconnecting || !this.shouldRun) return;
    this.isReconnecting = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log(`🔄 Auto-reviving Telegram bot polling in ${Math.round(delayMs / 1000)} seconds...`);
    this.reconnectTimeout = setTimeout(async () => {
      this.isReconnecting = false;
      this.reconnectTimeout = null;
      if (this.shouldRun && !this.isPollingActive) {
        await this.startPollingLoop();
      }
    }, delayMs);
  }

  private startWatchdog() {
    if (this.watchdogTimer) return;
    // Watchdog runs every 15 seconds: ensures bot is always healthy without competing reconnects
    this.watchdogTimer = setInterval(async () => {
      if (this.shouldRun && !this.isPollingActive && !this.isReconnecting && this.bot) {
        console.warn('🚨 Watchdog detected inactive Telegram polling! Reviving bot cleanly...');
        await this.startPollingLoop();
      }
    }, 15000);
  }

  public async stop() {
    this.shouldRun = false;
    this.isReconnecting = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.scheduledPingTimer) {
      clearInterval(this.scheduledPingTimer);
      this.scheduledPingTimer = null;
    }
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch (e) {
        // Ignore stop error if already stopped
      }
      this.isPollingActive = false;
      this.isRunning = false;
      console.log('🛑 Telegram Bot stopped.');
    }
  }

  private setupHandlers(bot: Bot<MyContext>) {
    bot.use(
      session({
        initial: (): SessionData => ({ step: 'IDLE' })
      })
    );

    const getKeyboard = (isAdmin: boolean = false) => {
      const kb = new Keyboard()
        .text(`🚀 ${toBoldSans('START EARN')}`)
        .text(`👤 ${toBoldSans('PROFILE')}`)
        .row()
        .text(`👥 ${toBoldSans('REFER & EARN')}`)
        .text(`💰 ${toBoldSans('WITHDRAW')}`)
        .row();

      if (isAdmin) {
        kb.text(`📞 ${toBoldSans('SUPPORT')}`)
          .text(`🛠️ ${toBoldSans('ADMIN PANEL')}`);
      } else {
        kb.text(`📞 ${toBoldSans('SUPPORT')}`);
      }

      return kb.resized();
    };

    const getCtxKb = (ctx: Context) => getKeyboard(ctx.from?.id === this.config.adminId);

    // Ban check middleware
    bot.use(async (ctx, next) => {
      if (!ctx.from) return;
      const user = this.db.getUser(ctx.from.id);
      if (user?.isBanned && ctx.from.id !== this.config.adminId) {
        await ctx.reply(
          '🚫 <b>Your account has been suspended by administration.</b> Contact @SRGAMER96 for assistance.',
          { parse_mode: 'HTML' }
        );
        return;
      }
      await next();
    });

    // 1. /start Command
    bot.command('start', async (ctx) => {
      const userId = ctx.from!.id;
      const firstName = ctx.from!.first_name || 'Member';
      const username = ctx.from!.username;

      const text = ctx.message?.text || '';
      const parts = text.split(' ');
      let referrerId: number | undefined;

      if (parts.length > 1 && parts[1].startsWith('ref_')) {
        const raw = parseInt(parts[1].replace('ref_', ''), 10);
        if (!isNaN(raw) && raw !== userId) {
          referrerId = raw;
        }
      }

      const isNew = this.db.registerUser({
        id: userId,
        firstName,
        username,
        referredBy: referrerId
      });

      if (isNew && referrerId) {
        const referrer = this.db.getUser(referrerId);
        if (referrer) {
          this.db.incrementReferrals(referrerId);
          try {
            await ctx.api.sendMessage(
              referrerId,
              `🎉 <b>${toBoldSans('New Referral Joined!')}</b>\n\n` +
                `User <b>${firstName}</b> has registered using your referral link!\n` +
                `You will receive <b>${this.db.data.settings.referralCommissionPercent}% Commission</b> automatically whenever they complete a QR earning task! 🚀`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {
            console.warn('Could not notify referrer:', e);
          }
        }
      }

      ctx.session.step = 'IDLE';

      const minW = this.db.data.settings.minWithdrawal;
      const refPct = this.db.data.settings.referralCommissionPercent;

      const welcome =
        `🌟 <b>${toBoldSans('WELCOME TO QR WORK OFFICIAL')}</b> 🌟\n\n` +
        `Hello <b>${firstName}</b>! 👋\n` +
        `Earn real cash by scanning verified QR codes and uploading transaction proofs.\n\n` +
        `💎 <b>${toBoldSans('How It Works:')}</b>\n` +
        `1️⃣ Tap <b>🚀 ${toBoldSans('START EARN')}</b> to view the active QR drop.\n` +
        `2️⃣ Scan with any UPI app and complete the task instructions.\n` +
        `3️⃣ Tap <b>📤 ${toBoldSans('Submit Proof')}</b> to lock the task and upload your screenshot.\n` +
        `4️⃣ Fast verification & instant cashout to any UPI handle!\n\n` +
        `💰 <b>Minimum Withdrawal:</b> ${this.config.currency}${minW} via UPI\n` +
        `👥 <b>Referral Bonus:</b> Earn <b>${refPct}% Commission</b> on every task completed by your referrals!\n\n` +
        `<i>Tap any styled button below on your keyboard to get started:</i>`;

      await ctx.reply(welcome, {
        parse_mode: 'HTML',
        reply_markup: getCtxKb(ctx)
      });
    });

    // /status & /botdetails Command - Displays the exact 12:00 bot details
    bot.command(['status', 'botdetails', 'pingdetails'], async (ctx) => {
      await ctx.reply(this.getLiveBotDetailsMessage());
    });

    // 2. 🚀 START EARN
    bot.hears(new RegExp(toBoldSans('START EARN')), async (ctx) => {
      const userId = ctx.from!.id;
      const task = this.db.data.activeTask;

      if (!task || task.status === 'claimed') {
        return ctx.reply(
          `⚠️ <b>${toBoldSans('No Active QR Task Available')}</b>\n\n` +
            `The previous QR task has already been completed and verified!\n` +
            `Please wait for the administrator to post a fresh QR code drop. 🔔`,
          { parse_mode: 'HTML' }
        );
      }

      if (task.isLocked) {
        if (task.lockedByUserId === userId) {
          return ctx.reply(
            `⏳ <b>${toBoldSans('Your Submission is Under Review')}</b>\n\n` +
              `You have already submitted proof for this QR task.\n` +
              `The admin is reviewing your submission. You will be notified as soon as it is processed!`,
            { parse_mode: 'HTML' }
          );
        } else {
          return ctx.reply(
            `🔒 <b>${toBoldSans('QR Task Already Claimed')}</b>\n\n` +
              `Another member (<b>${task.lockedByUserName || 'Member'}</b>) has already claimed and submitted proof for this QR code.\n` +
              `Each QR drop can only be claimed once! Please wait for the admin to post the next fresh QR drop. ⏳`,
            { parse_mode: 'HTML' }
          );
        }
      }

      const kb = new InlineKeyboard()
        .text(`📤 ${toBoldSans('Submit Proof')}`, 'btn_submit_proof')
        .text(`❌ ${toBoldSans('Cancel')}`, 'btn_cancel_task');

      const caption =
        `🔥 <b>${toBoldSans(task.title)}</b>\n\n` +
        `💰 <b>Reward:</b> ${this.config.currency}${task.reward}\n` +
        `📝 <b>Instructions:</b>\n${task.instructions}\n\n` +
        `⚡ <i>Complete payment or task and tap Submit Proof below to lock your claim.</i>`;

      try {
        await ctx.replyWithPhoto(task.qrImageUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb
        });
      } catch (e) {
        console.warn('Could not send photo via replyWithPhoto, sending text:', e);
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          reply_markup: kb
        });
      }
    });

    // Callback: Submit Proof
    bot.callbackQuery('btn_submit_proof', async (ctx) => {
      const userId = ctx.from.id;
      const task = this.db.data.activeTask;

      if (!task) {
        await ctx.answerCallbackQuery({ text: 'No active task available!', show_alert: true });
        return;
      }

      if (task.isLocked && task.lockedByUserId !== userId) {
        await ctx.answerCallbackQuery({ text: 'Task is already locked by another user!', show_alert: true });
        return;
      }

      ctx.session.step = 'AWAITING_PROOF';
      ctx.session.isTaskCancelled = false;
      await ctx.answerCallbackQuery();

      await ctx.reply(
        `📤 <b>${toBoldSans('SUBMIT TASK PROOF')}</b>\n\n` +
          `Please send your transaction proof now!\n` +
          `• Send a <b>Screenshot / Photo</b> of payment\n` +
          `• Or type the 12-digit <b>UTR Number</b> in the chat.\n\n` +
          `<i>Tap Cancel below if you wish to abort:</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(`❌ ${toBoldSans('Cancel')}`, 'btn_cancel_task')
        }
      );
    });

    // Callback: Cancel Task (Prevents repeated cancellations and disables further actions)
    bot.callbackQuery('btn_cancel_task', async (ctx) => {
      const userId = ctx.from.id;
      const task = this.db.data.activeTask;
      const holdsLock = task && task.lockedByUserId === userId;

      // 1. Prevent repeated cancellations
      if (ctx.session.step !== 'AWAITING_PROOF' && !holdsLock && ctx.session.isTaskCancelled) {
        await ctx.answerCallbackQuery({
          text: '⚠️ Task has already been cancelled! You cannot cancel it again.',
          show_alert: true
        });
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        } catch {}
        return;
      }

      // 2. Remove inline keyboard immediately so buttons cannot be pressed repeatedly
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch (e) {}

      // 3. Release task lock if held by this user
      if (task && task.lockedByUserId === userId) {
        task.isLocked = false;
        delete task.lockedByUserId;
        delete task.lockedByUserName;
        task.status = 'active';
        this.db.save();
      }

      // 4. Mark session as strictly cancelled and idle
      ctx.session.step = 'IDLE';
      ctx.session.isTaskCancelled = true;
      ctx.session.lastCancelledTaskId = task?.id;
      ctx.session.lastCancelledAt = Date.now();

      await ctx.answerCallbackQuery({ text: 'Task cancelled. Proof submission disabled.' });

      await ctx.reply(
        `❌ <b>${toBoldSans('Task Session Cancelled')}</b>\n\n` +
          `• Further actions—such as submitting screenshots or UTR numbers—are now blocked for this cancelled session.\n` +
          `• You cannot repeatedly cancel this task.\n` +
          `• The QR code remains open if you wish to start a new attempt.\n\n` +
          `Tap <b>🚀 ${toBoldSans('START EARN')}</b> on your keyboard whenever you wish to start fresh!`,
        {
          parse_mode: 'HTML',
          reply_markup: getCtxKb(ctx)
        }
      );
    });

    // 3. 👤 PROFILE
    bot.hears(new RegExp(toBoldSans('PROFILE')), async (ctx) => {
      const user = this.db.getUser(ctx.from!.id);
      if (!user) return;

      const minW = this.db.data.settings.minWithdrawal;
      const profileText =
        `👤 <b>${toBoldSans('YOUR ACCOUNT PROFILE')}</b>\n\n` +
        `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
        `👤 <b>Name:</b> ${user.firstName} ${user.username ? `(@${user.username})` : ''}\n` +
        `💰 <b>Wallet Balance:</b> <b>${this.config.currency}${user.balance.toFixed(2)}</b>\n` +
        `👥 <b>Total Referrals:</b> <b>${user.referralCount}</b> members\n` +
        `📈 <b>Referral Earnings:</b> <b>${this.config.currency}${(user.referralEarnings || 0).toFixed(2)}</b>\n` +
        `✅ <b>Tasks Completed:</b> <b>${user.tasksCompleted}</b>\n` +
        `📅 <b>Member Since:</b> ${new Date(user.joinedAt).toLocaleDateString()}\n\n` +
        `💳 <i>Instant withdrawal to any UPI handle upon reaching ${this.config.currency}${minW}.</i>`;

      await ctx.reply(profileText, {
        parse_mode: 'HTML',
        reply_markup: getCtxKb(ctx)
      });
    });

    // 4. 👥 REFER & EARN
    bot.hears(new RegExp(toBoldSans('REFER & EARN')), async (ctx) => {
      const userId = ctx.from!.id;
      const botUsername = this.botInfo?.username || 'QR_WORK_ON_BOT';
      const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
      const refPct = this.db.data.settings.referralCommissionPercent;

      const shareKb = new InlineKeyboard().url(
        `🚀 ${toBoldSans('Share With Friends')}`,
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(
          `🔥 Earn real instant cash by scanning QR tasks on Telegram! Use my link: ${refLink}`
        )}`
      );

      const user = this.db.getUser(userId);

      const referText =
        `👥 <b>${toBoldSans('REFER & EARN COMMISSION PROGRAM')}</b>\n\n` +
        `Earn a lifetime <b>${refPct}% Commission</b> on every task completed by users who join using your link!\n\n` +
        `🔗 <b>Your Exclusive Referral Link:</b>\n` +
        `<code>${refLink}</code>\n\n` +
        `📊 <b>Your Total Referrals:</b> ${user?.referralCount || 0} members\n` +
        `💰 <b>Total Referral Earnings:</b> ${this.config.currency}${(user?.referralEarnings || 0).toFixed(2)}\n\n` +
        `<i>Tap below to share directly with your WhatsApp & Telegram contacts!</i>`;

      await ctx.reply(referText, {
        parse_mode: 'HTML',
        reply_markup: shareKb
      });
    });

    // 5. 💰 WITHDRAW (Min ₹30)
    bot.hears(new RegExp(toBoldSans('WITHDRAW')), async (ctx) => {
      const user = this.db.getUser(ctx.from!.id);
      if (!user) return;
      const minW = this.db.data.settings.minWithdrawal;

      if (user.balance < minW) {
        return ctx.reply(
          `⚠️ <b>${toBoldSans('Insufficient Balance')}</b>\n\n` +
            `Your Balance: <b>${this.config.currency}${user.balance.toFixed(2)}</b>\n` +
            `Minimum Withdrawal: <b>${this.config.currency}${minW.toFixed(2)}</b>\n\n` +
            `Complete more QR tasks or invite friends to reach the threshold!`,
          { parse_mode: 'HTML' }
        );
      }

      ctx.session.step = 'AWAITING_UPI_ID';
      await ctx.reply(
        `💰 <b>${toBoldSans('UPI WITHDRAWAL SYSTEM')}</b>\n\n` +
          `Available Balance: <b>${this.config.currency}${user.balance.toFixed(2)}</b>\n` +
          `Minimum Withdrawal: <b>${this.config.currency}${minW.toFixed(2)}</b>\n\n` +
          `Please enter your valid <b>UPI ID</b> (e.g. <code>username@okaxis</code> or <code>mobile@paytm</code>):`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(`❌ ${toBoldSans('Cancel')}`, 'btn_cancel_withdraw')
        }
      );
    });

    bot.callbackQuery('btn_cancel_withdraw', async (ctx) => {
      ctx.session.step = 'IDLE';
      delete ctx.session.tempUpiId;
      await ctx.answerCallbackQuery({ text: 'Withdrawal aborted.' });
      await ctx.reply('Withdrawal request canceled.', { reply_markup: getCtxKb(ctx) });
    });

    // Dashboard Callbacks for instant in-chat app navigation
    bot.callbackQuery('cmd_start_earn', async (ctx) => {
      await ctx.answerCallbackQuery();
      const task = this.db.data.activeTask;
      if (!task || task.status === 'claimed') {
        return ctx.reply(
          `⚠️ <b>${toBoldSans('No Active QR Task Available')}</b>\n\nPlease wait for the administrator to post a fresh QR code drop. 🔔`,
          { parse_mode: 'HTML' }
        );
      }
      ctx.session.step = 'IDLE';
      ctx.session.isTaskCancelled = false;
      const taskKb = new InlineKeyboard()
        .text(`📤 ${toBoldSans('Submit Proof')}`, 'btn_submit_proof')
        .text(`❌ ${toBoldSans('Cancel')}`, 'btn_cancel_task');

      const caption =
        `🔥 <b>${toBoldSans(task.title)}</b>\n\n` +
        `💰 <b>Reward:</b> ${this.config.currency}${task.reward}\n` +
        `📝 <b>Instructions:</b>\n${task.instructions}\n\n` +
        `<i>Tap Submit Proof below after completing payment:</i>`;

      try {
        await ctx.replyWithPhoto(task.qrImageUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: taskKb
        });
      } catch (err) {
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          reply_markup: taskKb
        });
      }
    });

    bot.callbackQuery('cmd_profile', async (ctx) => {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) return;
      const user = this.db.getUser(from.id);
      if (!user) return ctx.reply('Account not registered. Please tap /start.');
      const refCount = user.referralCount;
      const text =
        `👤 <b>${toBoldSans('YOUR ACCOUNT PROFILE')}</b>\n\n` +
        `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
        `👤 <b>Name:</b> ${user.firstName} ${user.username ? `(@${user.username})` : ''}\n` +
        `💰 <b>Available Balance:</b> <b>${this.config.currency}${user.balance.toFixed(2)}</b>\n` +
        `👥 <b>Referrals Count:</b> <b>${refCount}</b> members\n` +
        `📈 <b>Referral Earnings:</b> <b>${this.config.currency}${(user.referralEarnings || 0).toFixed(2)}</b>\n` +
        `✅ <b>Tasks Completed:</b> <b>${user.tasksCompleted}</b>\n` +
        `📅 <b>Member Since:</b> ${new Date(user.joinedAt).toLocaleDateString()}\n\n` +
        `💳 <i>Minimum cashout is ${this.config.currency}${this.db.data.settings.minWithdrawal}.</i>`;
      await ctx.reply(text, { parse_mode: 'HTML' });
    });

    bot.callbackQuery('cmd_refer', async (ctx) => {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) return;
      const userId = from.id;
      const user = this.db.getUser(userId);
      const refCount = user ? user.referralCount : 0;
      const botUser = this.botInfo?.username || 'QR_WORK_ON_BOT';
      const refLink = `https://t.me/${botUser}?start=ref_${userId}`;
      const commission = this.db.data.settings.referralCommissionPercent;
      const text =
        `👥 <b>${toBoldSans('INVITE FRIENDS & EARN')}</b>\n\n` +
        `Earn <b>${commission}% Lifetime Commission</b> on every QR task completed by your invitees!\n\n` +
        `🔗 <b>Your Exclusive Referral Link:</b>\n` +
        `<code>${refLink}</code>\n\n` +
        `📊 <b>Your Total Referrals:</b> <b>${refCount}</b> members\n` +
        `⚡ <i>Rewards are credited to your balance automatically!</i>`;
      const kb = new InlineKeyboard().url(
        `🚀 ${toBoldSans('Share Referral Link')}`,
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Earn cash by completing QR drops with QR KING!')}`
      );
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    });

    bot.callbackQuery('cmd_withdraw', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = this.db.getUser(ctx.from.id);
      const minW = this.db.data.settings.minWithdrawal;
      if (!user || user.balance < minW) {
        return ctx.reply(
          `⚠️ <b>${toBoldSans('Insufficient Balance')}</b>\n\n` +
            `Your Balance: <b>${this.config.currency}${user ? user.balance.toFixed(2) : '0.00'}</b>\n` +
            `Minimum Required: <b>${this.config.currency}${minW.toFixed(2)}</b>\n\n` +
            `Complete more QR tasks or invite friends to reach the threshold!`,
          { parse_mode: 'HTML' }
        );
      }
      ctx.session.step = 'AWAITING_UPI_ID';
      await ctx.reply(
        `💰 <b>${toBoldSans('UPI WITHDRAWAL SYSTEM')}</b>\n\n` +
          `Available Balance: <b>${this.config.currency}${user.balance.toFixed(2)}</b>\n` +
          `Minimum Withdrawal: <b>${this.config.currency}${minW.toFixed(2)}</b>\n\n` +
          `Please enter your valid <b>UPI ID</b> (e.g. <code>username@okaxis</code>):`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(`❌ ${toBoldSans('Cancel')}`, 'btn_cancel_withdraw')
        }
      );
    });

    bot.callbackQuery('cmd_support', async (ctx) => {
      await ctx.answerCallbackQuery();
      const supportKb = new InlineKeyboard().url(
        `💬 ${toBoldSans('Message @SRGAMER96')}`,
        `https://t.me/${this.config.supportUsername}`
      );
      await ctx.reply(
        `📞 <b>${toBoldSans('OFFICIAL SUPPORT DESK')}</b>\n\n` +
          `Have a query regarding task verification or UPI payout?\n` +
          `Our support team is available to assist you.\n\n` +
          `👤 <b>Direct Admin:</b> @${this.config.supportUsername}\n` +
          `⚡ <i>Please include your Telegram ID (<code>${ctx.from.id}</code>) when reaching out.</i>`,
        { parse_mode: 'HTML', reply_markup: supportKb }
      );
    });

    // 6. 📞 SUPPORT
    bot.hears(new RegExp(toBoldSans('SUPPORT')), async (ctx) => {
      const supportKb = new InlineKeyboard().url(
        `💬 ${toBoldSans('Message @SRGAMER96')}`,
        `https://t.me/${this.config.supportUsername}`
      );

      await ctx.reply(
        `📞 <b>${toBoldSans('OFFICIAL SUPPORT DESK')}</b>\n\n` +
          `Have a query regarding task verification or UPI payout?\n` +
          `Our support team is available to assist you.\n\n` +
          `👤 <b>Direct Admin:</b> @${this.config.supportUsername}\n` +
          `⚡ <i>Please include your Telegram ID (<code>${ctx.from!.id}</code>) when reaching out.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: supportKb
        }
      );
    });

    // 7. 🛠️ ADMIN PANEL (With requested buttons: Delete QR, Ban, Unban, User Info, Add Balance, Remove Balance, Set Ref %)
    const sendAdminMenu = async (ctx: Context) => {
      const minW = this.db.data.settings.minWithdrawal;
      const refPct = this.db.data.settings.referralCommissionPercent;

      const adminMenu = new InlineKeyboard()
        .text(`📢 ${toBoldSans('Broadcast')}`, 'adm_broadcast')
        .text(`➕ ${toBoldSans('Set QR')}`, 'adm_set_qr')
        .text(`🗑️ ${toBoldSans('Delete QR')}`, 'adm_delete_qr')
        .row()
        .text(`🚫 ${toBoldSans('Ban User')}`, 'adm_ban_user')
        .text(`✅ ${toBoldSans('Unban User')}`, 'adm_unban_user')
        .text(`🗑️ ${toBoldSans('Delete User')}`, 'adm_del_user')
        .row()
        .text(`ℹ️ ${toBoldSans('User Info')}`, 'adm_user_info')
        .text(`➕ ${toBoldSans('Add Balance')}`, 'adm_add_balance')
        .text(`➖ ${toBoldSans('Remove Bal')}`, 'adm_rem_balance')
        .row()
        .text(`📈 ${toBoldSans('Set Ref %')}`, 'adm_set_ref_pct')
        .text(`📊 ${toBoldSans('Statistics')}`, 'adm_stats')
        .text(`🔔 ${toBoldSans('Withdrawals')}`, 'adm_withdrawals');

      const text =
        `🛠️ <b>${toBoldSans('MASTER ADMIN COMMAND CENTER')}</b>\n\n` +
        `Welcome Master Admin @${this.config.supportUsername}!\n\n` +
        `⚙️ <b>Active Settings:</b>\n` +
        `• Min Withdrawal: <b>${this.config.currency}${minW}</b>\n` +
        `• Referral Commission: <b>${refPct}%</b>\n` +
        `• Active QR Status: <b>${this.db.data.activeTask ? 'Online (Active)' : 'None (Deleted)'}</b>\n\n` +
        `<i>Tap any action button below:</i>`;

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: adminMenu
      });
    };

    bot.hears(new RegExp(toBoldSans('ADMIN PANEL')), async (ctx) => {
      if (ctx.from!.id !== this.config.adminId) {
        return ctx.reply('⛔ <b>Access Denied:</b> This administrative section is reserved exclusively for the Master Admin.', {
          parse_mode: 'HTML',
          reply_markup: getKeyboard(false)
        });
      }
      await sendAdminMenu(ctx);
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from!.id !== this.config.adminId) {
        return ctx.reply('⛔ <b>Access Denied:</b> This administrative section is reserved exclusively for the Master Admin.', {
          parse_mode: 'HTML',
          reply_markup: getKeyboard(false)
        });
      }
      await sendAdminMenu(ctx);
    });

    // Admin: Delete QR Action
    bot.callbackQuery('adm_delete_qr', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      this.db.deleteActiveQR();
      await ctx.answerCallbackQuery({ text: 'Active QR deleted!' });
      await ctx.reply(
        `🗑️ <b>${toBoldSans('Active QR Code Deleted!')}</b>\n\n` +
          `The current QR drop has been removed. Users clicking 'Start Earn' will now be informed that no QR task is currently active until you publish a new one.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('« Back to Admin', 'adm_back')
        }
      );
    });

    // Admin: Ban User Action
    bot.callbackQuery('adm_ban_user', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_BAN_ID';
      await ctx.answerCallbackQuery();
      await ctx.reply('🚫 <b>Enter the numeric Telegram User ID to BAN:</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
      });
    });

    // Admin: Unban User Action
    bot.callbackQuery('adm_unban_user', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_UNBAN_ID';
      await ctx.answerCallbackQuery();
      await ctx.reply('✅ <b>Enter the numeric Telegram User ID to UNBAN:</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
      });
    });

    // Admin: Delete User Action
    bot.callbackQuery('adm_del_user', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_DELETE_USER_ID';
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '🗑️ <b>Enter the numeric Telegram User ID to DELETE from database:</b>\n\n<i>⚠️ This removes the user profile and data permanently.</i>',
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
        }
      );
    });

    // Admin: User Info Action
    bot.callbackQuery('adm_user_info', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_USER_INFO_ID';
      await ctx.answerCallbackQuery();
      await ctx.reply('ℹ️ <b>Enter the Telegram User ID to fetch detailed profile & history:</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
      });
    });

    // Admin: Add Balance Action
    bot.callbackQuery('adm_add_balance', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_ADD_BAL_USER_ID';
      await ctx.answerCallbackQuery();
      await ctx.reply('➕ <b>Step 1/2: Enter the Telegram User ID to credit balance:</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
      });
    });

    // Admin: Remove Balance Action
    bot.callbackQuery('adm_rem_balance', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_REM_BAL_USER_ID';
      await ctx.answerCallbackQuery();
      await ctx.reply('➖ <b>Step 1/2: Enter the Telegram User ID to deduct balance:</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
      });
    });

    // Admin: Set Referral Commission % Action
    bot.callbackQuery('adm_set_ref_pct', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_REF_PERCENT';
      const current = this.db.data.settings.referralCommissionPercent;
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `📈 <b>SET REFERRAL COMMISSION PERCENTAGE (%)</b>\n\n` +
          `Current Commission: <b>${current}%</b>\n\n` +
          `Enter the new percentage that referrers will earn on every task completed by their invited friends (e.g. <code>10</code>, <code>15</code>, <code>20</code>, <code>25</code>):`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
        }
      );
    });

    // Admin: Stats
    bot.callbackQuery('adm_stats', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      const userList = Object.values(this.db.data.users);
      const withdrawals = Object.values(this.db.data.withdrawals);
      const proofs = Object.values(this.db.data.proofs);

      const totalBalance = userList.reduce((acc, u) => acc + u.balance, 0);
      const totalPaid = withdrawals.filter((w) => w.status === 'approved').reduce((acc, w) => acc + w.amount, 0);

      const text =
        `📊 <b>${toBoldSans('LIVE SYSTEM STATISTICS')}</b>\n\n` +
        `👥 <b>Total Subscribers:</b> ${userList.length}\n` +
        `💰 <b>Total Active Balances:</b> ${this.config.currency}${totalBalance.toFixed(2)}\n` +
        `💸 <b>Total Payouts Approved:</b> ${this.config.currency}${totalPaid.toFixed(2)}\n` +
        `⏳ <b>Pending Withdrawals:</b> ${withdrawals.filter((w) => w.status === 'pending').length} requests\n` +
        `📥 <b>Pending Proofs:</b> ${proofs.filter((p) => p.status === 'pending').length} submissions\n` +
        `🎯 <b>Tasks Completed:</b> ${userList.reduce((acc, u) => acc + u.tasksCompleted, 0)}\n` +
        `📈 <b>Referral Commission:</b> ${this.db.data.settings.referralCommissionPercent}%\n` +
        `💳 <b>Min Cashout:</b> ${this.config.currency}${this.db.data.settings.minWithdrawal}\n\n` +
        `🟢 <b>Engine:</b> Active & Running 24/7`;

      await ctx.answerCallbackQuery();
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('« Back to Admin', 'adm_back')
      });
    });

    // Admin: Set QR Code
    bot.callbackQuery('adm_set_qr', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_NEW_QR_IMAGE';
      await ctx.answerCallbackQuery();

      await ctx.reply(
        `📸 <b>${toBoldSans('PROVIDE QR CODE PHOTO')}</b>\n\n` +
          `Please send or upload your <b>QR Code Photo</b> now! 📷\n\n` +
          `⚡ <b>Auto-Activation:</b> Once you provide the photo, the QR code will be <b>automatically added to Start Earn</b> for all members immediately!\n\n` +
          `<i>(Optional: You can include the reward in the photo caption, e.g. "50", or default ₹50 will be used)</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
        }
      );
    });

    // Admin: Change Reward Callback
    bot.callbackQuery('adm_change_reward', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_NEW_QR_REWARD';
      await ctx.answerCallbackQuery();
      await ctx.reply('💰 Enter the new reward amount for the active QR task (e.g. <code>25</code>, <code>50</code>, <code>100</code>):', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
      });
    });

    // Admin: Broadcast
    bot.callbackQuery('adm_broadcast', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'AWAITING_BROADCAST_TEXT';
      await ctx.answerCallbackQuery();

      await ctx.reply(
        `📢 <b>${toBoldSans('GLOBAL BROADCAST DISPATCH')}</b>\n\n` +
          `Please type the message you want to broadcast to all members:\n\n` +
          `<i>HTML formatting is supported. You will be asked to confirm before dispatch.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('❌ Cancel', 'adm_back')
        }
      );
    });

    // Admin: Withdrawals
    bot.callbackQuery('adm_withdrawals', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      await ctx.answerCallbackQuery();
      const pending = Object.values(this.db.data.withdrawals).filter((w) => w.status === 'pending');

      if (pending.length === 0) {
        return ctx.reply('✅ <b>No pending withdrawal requests found!</b>', {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('« Back to Admin', 'adm_back')
        });
      }

      for (const w of pending.slice(0, 5)) {
        const kb = new InlineKeyboard()
          .text(`✅ ${toBoldSans('Approve')}`, `w_app_${w.id}`)
          .text(`❌ ${toBoldSans('Reject & Refund')}`, `w_rej_${w.id}`);

        await ctx.reply(
          `💳 <b>Withdrawal Request</b>\n\n` +
            `🆔 Request ID: <code>${w.id}</code>\n` +
            `👤 User: <b>${w.userName}</b> (<code>${w.userId}</code>)\n` +
            `💰 Amount: <b>${this.config.currency}${w.amount}</b>\n` +
            `🎯 UPI ID: <code>${w.upiId}</code>\n` +
            `🕒 Date: ${new Date(w.createdAt).toLocaleString()}`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }
    });

    // Admin: Back
    bot.callbackQuery('adm_back', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      ctx.session.step = 'IDLE';
      await ctx.answerCallbackQuery();
      await sendAdminMenu(ctx);
    });

    // Inline Approval for Proof (includes automatic % commission for referrer!)
    bot.callbackQuery(/^proof_app_([a-zA-Z0-9_]+)$/, async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      const pid = ctx.match[1];
      const proof = this.db.data.proofs[pid];

      if (!proof || proof.status !== 'pending') {
        await ctx.answerCallbackQuery({ text: 'Proof already handled or not found!', show_alert: true });
        return;
      }

      proof.status = 'approved';
      this.db.adjustBalance(proof.userId, proof.reward);
      this.db.incrementTasks(proof.userId);

      // The QR task is completed and consumed! Clear it so it will never show as available
      this.db.data.activeTask = null;

      // Check if user has a referrer -> auto-credit referral commission percentage!
      const user = this.db.getUser(proof.userId);
      let referrerCommissionMsg = '';
      if (user && user.referredBy) {
        const refPct = this.db.data.settings.referralCommissionPercent;
        if (refPct > 0) {
          const commission = (proof.reward * refPct) / 100;
          this.db.addReferralEarnings(user.referredBy, commission);

          try {
            await ctx.api.sendMessage(
              user.referredBy,
              `🎉 <b>${toBoldSans('REFERRAL COMMISSION CREDITED!')}</b>\n\n` +
                `Your referral <b>${user.firstName}</b> just completed a task (Reward: ${this.config.currency}${proof.reward})!\n` +
                `💰 You received <b>${refPct}% Commission: ${this.config.currency}${commission.toFixed(2)}</b> in your wallet balance! 🚀`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {
            console.warn('Could not notify referrer of commission:', e);
          }
          referrerCommissionMsg = `\n👥 Credited ${refPct}% (${this.config.currency}${commission.toFixed(2)}) to Referrer <code>${user.referredBy}</code>.`;
        }
      }

      this.db.save();

      await ctx.answerCallbackQuery({ text: 'Proof approved!' });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(
        `✅ <b>Approved!</b> Added ${this.config.currency}${proof.reward} to User <code>${proof.userId}</code>.${referrerCommissionMsg}\n\n<i>🎯 QR task completed & closed from Start Earn.</i>`,
        { parse_mode: 'HTML' }
      );

      try {
        await ctx.api.sendMessage(
          proof.userId,
          `🎉 <b>${toBoldSans('TASK PROOF APPROVED!')}</b>\n\n` +
            `Your submission for <b>${proof.taskTitle}</b> has been verified by the admin!\n` +
            `💰 Reward Credited: <b>${this.config.currency}${proof.reward}</b>\n` +
            `Check your updated balance in 👤 ${toBoldSans('PROFILE')}!`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        console.warn('Could not notify user:', e);
      }
    });

    // Inline Rejection for Proof
    bot.callbackQuery(/^proof_rej_([a-zA-Z0-9_]+)$/, async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      const pid = ctx.match[1];
      const proof = this.db.data.proofs[pid];

      if (!proof || proof.status !== 'pending') {
        await ctx.answerCallbackQuery({ text: 'Proof already handled!', show_alert: true });
        return;
      }

      proof.status = 'rejected';
      // Close the used QR code so it does NOT show as available anymore!
      this.db.data.activeTask = null;
      this.db.save();

      await ctx.answerCallbackQuery({ text: 'Proof rejected & QR task closed.' });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(`❌ <b>Rejected!</b> The used QR task has been closed and will not show as available. Post a fresh QR anytime via ➕ Set QR.`, { parse_mode: 'HTML' });

      try {
        await ctx.api.sendMessage(
          proof.userId,
          `❌ <b>${toBoldSans('TASK PROOF REJECTED')}</b>\n\n` +
            `Your proof for <b>${proof.taskTitle}</b> could not be verified.\n` +
            `Reason: Invalid screenshot or transaction not confirmed.\n\n` +
            `Please stay tuned for the next fresh QR code drop!`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        console.warn('Could not notify user of rejection:', e);
      }
    });

    // Inline Approval for Withdrawal
    bot.callbackQuery(/^w_app_([a-zA-Z0-9_]+)$/, async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      const wid = ctx.match[1];
      const w = this.db.data.withdrawals[wid];

      if (!w || w.status !== 'pending') {
        await ctx.answerCallbackQuery({ text: 'Withdrawal already processed!', show_alert: true });
        return;
      }

      w.status = 'approved';
      this.db.save();

      await ctx.answerCallbackQuery({ text: 'Withdrawal approved!' });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(`✅ Payout of ${this.config.currency}${w.amount} to <code>${w.upiId}</code> marked <b>PAID</b>.`, {
        parse_mode: 'HTML'
      });

      try {
        await ctx.api.sendMessage(
          w.userId,
          `🎉 <b>${toBoldSans('PAYMENT PROCESSED SUCCESSFULLY!')}</b>\n\n` +
            `💰 Amount: <b>${this.config.currency}${w.amount}</b>\n` +
            `💳 Transferred to UPI: <code>${w.upiId}</code>\n` +
            `⚡ Status: <b>Completed (Paid)</b>\n\n` +
            `Thank you for earning with QR WORK!`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        console.warn('Could not notify user:', e);
      }
    });

    // Inline Rejection for Withdrawal (Refunds balance!)
    bot.callbackQuery(/^w_rej_([a-zA-Z0-9_]+)$/, async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      const wid = ctx.match[1];
      const w = this.db.data.withdrawals[wid];

      if (!w || w.status !== 'pending') {
        await ctx.answerCallbackQuery({ text: 'Withdrawal already processed!', show_alert: true });
        return;
      }

      w.status = 'rejected';
      this.db.adjustBalance(w.userId, w.amount);
      this.db.save();

      await ctx.answerCallbackQuery({ text: 'Withdrawal rejected & refunded.' });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(`❌ Payout rejected. ${this.config.currency}${w.amount} refunded to User <code>${w.userId}</code>.`, {
        parse_mode: 'HTML'
      });

      try {
        await ctx.api.sendMessage(
          w.userId,
          `⚠️ <b>${toBoldSans('WITHDRAWAL REJECTED')}</b>\n\n` +
            `Your payout request for <b>${this.config.currency}${w.amount}</b> to <code>${w.upiId}</code> was rejected.\n` +
            `💰 <b>Refund:</b> ${this.config.currency}${w.amount} has been restored to your wallet balance.\n\n` +
            `Please verify your UPI handle and retry, or contact 📞 ${toBoldSans('SUPPORT')}.`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        console.warn('Could not notify user of refund:', e);
      }
    });

    // Confirm Broadcast
    bot.callbackQuery('adm_broadcast_confirm', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      const text = ctx.session.tempBroadcastText;
      if (!text) {
        await ctx.answerCallbackQuery({ text: 'Broadcast expired!', show_alert: true });
        return;
      }

      await ctx.answerCallbackQuery({ text: 'Dispatching broadcast...' });
      await ctx.reply('🚀 Broadcast started. Sending to all members...');

      const userIds = this.db.getAllUserIds();
      let sent = 0;

      for (const uid of userIds) {
        try {
          await ctx.api.sendMessage(uid, `📢 <b>${toBoldSans('OFFICIAL ANNOUNCEMENT')}</b>\n\n${text}`, {
            parse_mode: 'HTML'
          });
          sent++;
          await new Promise((r) => setTimeout(r, 40));
        } catch {
          // ignore blocked
        }
      }

      delete ctx.session.tempBroadcastText;
      await ctx.reply(`✅ <b>Broadcast Completed!</b> Delivered to ${sent} users.`, {
        parse_mode: 'HTML',
        reply_markup: getKeyboard()
      });
    });

    bot.callbackQuery('adm_broadcast_abort', async (ctx) => {
      if (ctx.from.id !== this.config.adminId) return;
      delete ctx.session.tempBroadcastText;
      await ctx.answerCallbackQuery({ text: 'Broadcast canceled.' });
      await ctx.reply('Broadcast dispatch aborted.', { reply_markup: getKeyboard() });
    });

    // General Message and Multi-Step State Flow Handler
    bot.on('message', async (ctx) => {
      const userId = ctx.from.id;
      const user = this.db.getUser(userId);
      const text = ctx.message.text?.trim() || '';
      const isPhotoOrDoc = Boolean(ctx.message.photo && ctx.message.photo.length > 0) || Boolean(ctx.message.document);

      // 1. Prevent submitting screenshot after task cancellation
      if (ctx.session.isTaskCancelled && isPhotoOrDoc) {
        return ctx.reply(
          `🚫 <b>${toBoldSans('Action Blocked: Task Cancelled')}</b>\n\n` +
            `You cancelled this task session. Submitting screenshots for cancelled tasks is strictly blocked to prevent invalid claims.\n\n` +
            `To submit proof for a task, please tap <b>🚀 ${toBoldSans('START EARN')}</b>, follow the QR instructions, and tap <b>📤 ${toBoldSans('Submit Proof')}</b> first!`,
          { parse_mode: 'HTML', reply_markup: getCtxKb(ctx) }
        );
      }

      // 2. Proof Upload
      if (ctx.session.step === 'AWAITING_PROOF') {
        if (ctx.session.isTaskCancelled) {
          ctx.session.step = 'IDLE';
          return ctx.reply(
            `🚫 <b>${toBoldSans('Submission Blocked: Task Cancelled')}</b>\n\n` +
              `This task session was cancelled. Screenshots cannot be submitted for cancelled tasks.\n` +
              `Tap <b>🚀 ${toBoldSans('START EARN')}</b> on your keyboard to begin fresh.`,
            { parse_mode: 'HTML', reply_markup: getCtxKb(ctx) }
          );
        }

        const task = this.db.data.activeTask;
        if (!task) {
          ctx.session.step = 'IDLE';
          return ctx.reply('⚠️ Task expired or no longer available.');
        }

        let photoFileId: string | undefined;
        let proofText: string | undefined;

        if (ctx.message.photo && ctx.message.photo.length > 0) {
          photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          proofText = ctx.message.caption;
        } else if (ctx.message.text) {
          proofText = ctx.message.text;
        } else {
          return ctx.reply('Please send a screenshot photo or type the UTR transaction ID!');
        }

        const pid = 'proof_' + Date.now();
        const proofRecord: ProofRecord = {
          id: pid,
          userId,
          userName: ctx.from.first_name || 'Member',
          userUsername: ctx.from.username,
          taskId: task.id,
          taskTitle: task.title,
          reward: task.reward,
          proofImageUrl: photoFileId,
          proofText: proofText || 'Screenshot attached',
          status: 'pending',
          submittedAt: new Date().toISOString()
        };

        this.db.data.proofs[pid] = proofRecord;
        task.isLocked = true;
        task.lockedByUserId = userId;
        task.lockedByUserName = ctx.from.first_name || 'Member';
        task.status = 'in_review';
        this.db.save();

        ctx.session.step = 'IDLE';

        await ctx.reply(
          `✅ <b>${toBoldSans('Proof Submitted Successfully!')}</b>\n\n` +
            `Your submission has been queued and forwarded to the administrator.\n` +
            `🔒 This QR task is now locked until review completes.\n\n` +
            `You will receive a notification as soon as it is approved! 🚀`,
          { parse_mode: 'HTML', reply_markup: getCtxKb(ctx) }
        );

        const adminReviewKb = new InlineKeyboard()
          .text(`✅ ${toBoldSans('Approve')}`, `proof_app_${pid}`)
          .text(`❌ ${toBoldSans('Reject')}`, `proof_rej_${pid}`);

        const adminNotice =
          `📥 <b>${toBoldSans('NEW TASK PROOF SUBMITTED')}</b>\n\n` +
          `👤 User: <b>${ctx.from.first_name}</b> (@${ctx.from.username || 'none'})\n` +
          `🆔 User ID: <code>${userId}</code>\n` +
          `🎯 Task: <b>${task.title}</b>\n` +
          `💰 Reward: <b>${this.config.currency}${task.reward}</b>\n` +
          `📝 Note: ${proofText || 'Screenshot attached'}\n\n` +
          `<i>Tap an action below to process reward:</i>`;

        try {
          if (photoFileId) {
            await ctx.api.sendPhoto(this.config.adminId, photoFileId, {
              caption: adminNotice,
              parse_mode: 'HTML',
              reply_markup: adminReviewKb
            });
          } else {
            await ctx.api.sendMessage(this.config.adminId, adminNotice, {
              parse_mode: 'HTML',
              reply_markup: adminReviewKb
            });
          }
        } catch (e) {
          console.error('Failed to forward proof to admin:', e);
        }
        return;
      }

      // 2. Withdrawal UPI ID
      if (ctx.session.step === 'AWAITING_UPI_ID') {
        const upi = text;
        if (!upi || !upi.includes('@')) {
          return ctx.reply('❌ Invalid UPI ID! Format: <code>username@bank</code>', { parse_mode: 'HTML' });
        }

        ctx.session.tempUpiId = upi;
        ctx.session.step = 'AWAITING_WITHDRAW_AMOUNT';
        const minW = this.db.data.settings.minWithdrawal;

        return ctx.reply(
          `💳 <b>UPI Registered:</b> <code>${upi}</code>\n\n` +
            `Enter the amount to withdraw (Min: ${this.config.currency}${minW}, Available: ${this.config.currency}${user?.balance.toFixed(2)}):`,
          { parse_mode: 'HTML' }
        );
      }

      // 3. Withdrawal Amount
      if (ctx.session.step === 'AWAITING_WITHDRAW_AMOUNT') {
        const amount = parseFloat(text);
        const minW = this.db.data.settings.minWithdrawal;

        if (isNaN(amount) || amount < minW) {
          return ctx.reply(`❌ Minimum withdrawal is ${this.config.currency}${minW}.`);
        }

        if (amount > (user?.balance || 0)) {
          return ctx.reply(`❌ Insufficient funds. Available: ${this.config.currency}${user?.balance.toFixed(2)}`);
        }

        const upiId = ctx.session.tempUpiId!;
        this.db.adjustBalance(userId, -amount);

        const wid = 'w_' + Date.now();
        const withdrawal: WithdrawalRecord = {
          id: wid,
          userId,
          userName: ctx.from.first_name || 'Member',
          userUsername: ctx.from.username,
          upiId,
          amount,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        this.db.data.withdrawals[wid] = withdrawal;
        this.db.save();

        ctx.session.step = 'IDLE';
        delete ctx.session.tempUpiId;

        await ctx.reply(
          `✅ <b>${toBoldSans('Withdrawal Request Queued!')}</b>\n\n` +
            `💰 Amount: <b>${this.config.currency}${amount.toFixed(2)}</b>\n` +
            `💳 Destination UPI: <code>${upiId}</code>\n` +
            `📉 Remaining Balance: <b>${this.config.currency}${(user!.balance - amount).toFixed(2)}</b>\n\n` +
            `Our admin @${this.config.supportUsername} will review and transfer shortly!`,
          { parse_mode: 'HTML', reply_markup: getCtxKb(ctx) }
        );

        const adminWithdrawKb = new InlineKeyboard()
          .text(`✅ ${toBoldSans('Approve Payout')}`, `w_app_${wid}`)
          .text(`❌ ${toBoldSans('Reject & Refund')}`, `w_rej_${wid}`);

        try {
          await ctx.api.sendMessage(
            this.config.adminId,
            `🔔 <b>${toBoldSans('NEW UPI WITHDRAWAL REQUEST')}</b>\n\n` +
              `👤 User: <b>${ctx.from.first_name}</b> (@${ctx.from.username || 'none'})\n` +
              `🆔 User ID: <code>${userId}</code>\n` +
              `💰 Amount: <b>${this.config.currency}${amount}</b>\n` +
              `💳 UPI ID: <code>${upiId}</code>\n` +
              `🕒 Timestamp: ${new Date().toLocaleString()}\n\n` +
              `<i>Action:</i>`,
            { parse_mode: 'HTML', reply_markup: adminWithdrawKb }
          );
        } catch (e) {
          console.error('Failed to notify admin of withdrawal:', e);
        }
        return;
      }

      // 4. Admin Broadcast Flow
      if (ctx.session.step === 'AWAITING_BROADCAST_TEXT' && userId === this.config.adminId) {
        if (!text) return ctx.reply('Please provide text for broadcast!');

        ctx.session.tempBroadcastText = text;
        ctx.session.step = 'IDLE';

        const confirmKb = new InlineKeyboard()
          .text(`✅ ${toBoldSans('Done / Send')}`, 'adm_broadcast_confirm')
          .text(`❌ ${toBoldSans('Cancel')}`, 'adm_broadcast_abort');

        return ctx.reply(
          `📢 <b>${toBoldSans('CONFIRM BROADCAST')}</b>\n\n` +
            `<b>Preview:</b>\n${text}\n\n` +
            `Total Recipients: <b>${this.db.getAllUserIds().length}</b> users\n\n` +
            `<i>Confirm sending?</i>`,
          { parse_mode: 'HTML', reply_markup: confirmKb }
        );
      }

      // 5. Admin Set QR Flow: Automatically activate upon receiving photo
      if (ctx.session.step === 'AWAITING_NEW_QR_IMAGE' && userId === this.config.adminId) {
        let imageUrl: string | undefined;
        let specifiedReward = this.db.data.activeTask?.reward || 50;

        if (ctx.message.photo && ctx.message.photo.length > 0) {
          imageUrl = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          if (ctx.message.caption) {
            const parsed = parseFloat(ctx.message.caption.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
              specifiedReward = parsed;
            }
          }
        } else if (text.startsWith('http')) {
          imageUrl = text;
        } else {
          return ctx.reply('📸 Please send the <b>QR Code Photo</b> as a picture attachment, or provide an image link!', { parse_mode: 'HTML' });
        }

        // Automatically activate and add to Start Earn immediately!
        this.db.data.activeTask = {
          id: 'task_' + Date.now(),
          title: 'Official Scan & Earn Drop',
          qrImageUrl: imageUrl,
          reward: specifiedReward,
          instructions: 'Scan QR with any UPI app, complete payment or action, and upload screenshot proof.',
          isLocked: false,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        this.db.save();

        ctx.session.step = 'IDLE';

        return ctx.reply(
          `✅ <b>${toBoldSans('QR Code Photo Added & Activated!')}</b>\n\n` +
            `💰 Task Reward: <b>${this.config.currency}${specifiedReward}</b>\n` +
            `🚀 <b>Status:</b> The QR code photo has been <b>automatically added to Start Earn</b> for all members!\n\n` +
            `All user locks have been reset so members can start earning right now.`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text(`✏️ ${toBoldSans('Change Reward')}`, 'adm_change_reward')
              .text(`🗑️ ${toBoldSans('Delete QR')}`, 'adm_delete_qr')
              .row()
              .text('« Back to Admin', 'adm_back')
          }
        );
      }

      if (ctx.session.step === 'AWAITING_NEW_QR_REWARD' && userId === this.config.adminId) {
        const reward = parseFloat(text.replace(/[^0-9.]/g, '') || '50');
        if (this.db.data.activeTask) {
          this.db.data.activeTask.reward = reward;
          this.db.save();
        }

        ctx.session.step = 'IDLE';

        return ctx.reply(
          `✅ <b>Reward Updated!</b> New reward is <b>${this.config.currency}${reward}</b> in Start Earn.`,
          { parse_mode: 'HTML', reply_markup: getKeyboard() }
        );
      }

      // 6. Admin Ban User by ID
      if (ctx.session.step === 'AWAITING_BAN_ID' && userId === this.config.adminId) {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ Invalid ID format. Send a valid numeric User ID.');

        const ok = this.db.setBan(targetId, true);
        ctx.session.step = 'IDLE';

        if (ok) {
          return ctx.reply(`🚫 User <code>${targetId}</code> is now <b>BANNED</b>.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        } else {
          return ctx.reply(`⚠️ User <code>${targetId}</code> not found in database.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        }
      }

      // 7. Admin Unban User by ID
      if (ctx.session.step === 'AWAITING_UNBAN_ID' && userId === this.config.adminId) {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ Invalid ID format. Send a valid numeric User ID.');

        const ok = this.db.setBan(targetId, false);
        ctx.session.step = 'IDLE';

        if (ok) {
          return ctx.reply(`✅ User <code>${targetId}</code> is now <b>UNBANNED</b>.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        } else {
          return ctx.reply(`⚠️ User <code>${targetId}</code> not found in database.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        }
      }

      // 7b. Admin Delete User by ID
      if (ctx.session.step === 'AWAITING_DELETE_USER_ID' && userId === this.config.adminId) {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ Invalid ID format. Send a valid numeric User ID.');

        if (targetId === this.config.adminId) {
          ctx.session.step = 'IDLE';
          return ctx.reply('⚠️ Cannot delete Master Admin account!', { reply_markup: getKeyboard() });
        }

        const ok = this.db.deleteUser(targetId);
        ctx.session.step = 'IDLE';

        if (ok) {
          return ctx.reply(`🗑️ User <code>${targetId}</code> has been completely <b>DELETED</b> from the database.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        } else {
          return ctx.reply(`⚠️ User <code>${targetId}</code> not found in database.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        }
      }

      // 8. Admin User Info
      if (ctx.session.step === 'AWAITING_USER_INFO_ID' && userId === this.config.adminId) {
        const targetId = parseInt(text, 10);
        ctx.session.step = 'IDLE';

        const u = this.db.getUser(targetId);
        if (!u) {
          return ctx.reply(`❌ No user found with ID <code>${targetId}</code>.`, {
            parse_mode: 'HTML',
            reply_markup: getKeyboard()
          });
        }

        const infoCard =
          `ℹ️ <b>${toBoldSans('USER ACCOUNT DOSSIER')}</b>\n\n` +
          `🆔 <b>Telegram ID:</b> <code>${u.id}</code>\n` +
          `👤 <b>Name:</b> ${u.firstName} ${u.username ? `(@${u.username})` : ''}\n` +
          `💰 <b>Wallet Balance:</b> <b>${this.config.currency}${u.balance.toFixed(2)}</b>\n` +
          `👥 <b>Direct Referrals:</b> ${u.referralCount} users\n` +
          `📈 <b>Referral Earnings:</b> ${this.config.currency}${(u.referralEarnings || 0).toFixed(2)}\n` +
          `🔗 <b>Referred By:</b> ${u.referredBy ? `<code>${u.referredBy}</code>` : 'None (Direct)'}\n` +
          `✅ <b>Tasks Completed:</b> ${u.tasksCompleted}\n` +
          `🚫 <b>Status:</b> ${u.isBanned ? '🚫 <b>BANNED</b>' : '🟢 <b>Active</b>'}\n` +
          `📅 <b>Registration Date:</b> ${new Date(u.joinedAt).toLocaleString()}`;

        return ctx.reply(infoCard, {
          parse_mode: 'HTML',
          reply_markup: getKeyboard()
        });
      }

      // 9. Admin Add Balance Flow (Step 1: User ID, Step 2: Amount)
      if (ctx.session.step === 'AWAITING_ADD_BAL_USER_ID' && userId === this.config.adminId) {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId) || !this.db.getUser(targetId)) {
          return ctx.reply(`❌ User <code>${text}</code> not found in database. Enter a valid ID:`, { parse_mode: 'HTML' });
        }

        ctx.session.tempTargetUserId = targetId;
        ctx.session.step = 'AWAITING_ADD_BAL_AMOUNT';
        return ctx.reply(`➕ <b>Step 2/2:</b> Enter the amount (${this.config.currency}) to ADD to User <code>${targetId}</code>:`, {
          parse_mode: 'HTML'
        });
      }

      if (ctx.session.step === 'AWAITING_ADD_BAL_AMOUNT' && userId === this.config.adminId) {
        const amount = parseFloat(text);
        const targetId = ctx.session.tempTargetUserId;
        ctx.session.step = 'IDLE';
        delete ctx.session.tempTargetUserId;

        if (isNaN(amount) || amount <= 0 || !targetId) {
          return ctx.reply('❌ Invalid amount. Transaction aborted.', { reply_markup: getKeyboard() });
        }

        const newBal = this.db.adjustBalance(targetId, amount);

        await ctx.reply(
          `✅ <b>Balance Credited!</b>\n\n` +
            `Added <b>${this.config.currency}${amount.toFixed(2)}</b> to User <code>${targetId}</code>.\n` +
            `New User Balance: <b>${this.config.currency}${newBal.toFixed(2)}</b>`,
          { parse_mode: 'HTML', reply_markup: getKeyboard() }
        );

        try {
          await ctx.api.sendMessage(
            targetId,
            `🎉 <b>WALLET BALANCE CREDITED!</b>\n\n` +
              `The administrator has added <b>${this.config.currency}${amount.toFixed(2)}</b> to your account.\n` +
              `Your new balance: <b>${this.config.currency}${newBal.toFixed(2)}</b> 🚀`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          console.warn('Could not notify user of added balance:', e);
        }
        return;
      }

      // 10. Admin Remove Balance Flow (Step 1: User ID, Step 2: Amount)
      if (ctx.session.step === 'AWAITING_REM_BAL_USER_ID' && userId === this.config.adminId) {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId) || !this.db.getUser(targetId)) {
          return ctx.reply(`❌ User <code>${text}</code> not found in database. Enter a valid ID:`, { parse_mode: 'HTML' });
        }

        ctx.session.tempTargetUserId = targetId;
        ctx.session.step = 'AWAITING_REM_BAL_AMOUNT';
        const u = this.db.getUser(targetId);

        return ctx.reply(
          `➖ <b>Step 2/2:</b> Enter the amount (${this.config.currency}) to DEDUCT from User <code>${targetId}</code> (Current: ${this.config.currency}${u?.balance.toFixed(2)}):`,
          { parse_mode: 'HTML' }
        );
      }

      if (ctx.session.step === 'AWAITING_REM_BAL_AMOUNT' && userId === this.config.adminId) {
        const amount = parseFloat(text);
        const targetId = ctx.session.tempTargetUserId;
        ctx.session.step = 'IDLE';
        delete ctx.session.tempTargetUserId;

        if (isNaN(amount) || amount <= 0 || !targetId) {
          return ctx.reply('❌ Invalid amount. Transaction aborted.', { reply_markup: getKeyboard() });
        }

        const newBal = this.db.adjustBalance(targetId, -amount);

        await ctx.reply(
          `✅ <b>Balance Deducted!</b>\n\n` +
            `Deducted <b>${this.config.currency}${amount.toFixed(2)}</b> from User <code>${targetId}</code>.\n` +
            `New User Balance: <b>${this.config.currency}${newBal.toFixed(2)}</b>`,
          { parse_mode: 'HTML', reply_markup: getKeyboard() }
        );

        try {
          await ctx.api.sendMessage(
            targetId,
            `⚠️ <b>WALLET BALANCE ADJUSTMENT</b>\n\n` +
              `The administrator has debited <b>${this.config.currency}${amount.toFixed(2)}</b> from your account.\n` +
              `Your updated balance: <b>${this.config.currency}${newBal.toFixed(2)}</b>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          console.warn('Could not notify user of debited balance:', e);
        }
        return;
      }

      // 11. Admin Set Referral %
      if (ctx.session.step === 'AWAITING_REF_PERCENT' && userId === this.config.adminId) {
        const pct = parseFloat(text);
        ctx.session.step = 'IDLE';

        if (isNaN(pct) || pct < 0 || pct > 100) {
          return ctx.reply('❌ Please enter a valid percentage between 0 and 100.', { reply_markup: getKeyboard() });
        }

        this.db.setReferralPercent(pct);

        return ctx.reply(
          `✅ <b>Referral Commission Updated!</b>\n\n` +
            `New Rate: <b>${pct}%</b>\n` +
            `Referrers will now automatically earn <b>${pct}%</b> of the task reward whenever their referred users complete a QR earning task! 🚀`,
          { parse_mode: 'HTML', reply_markup: getKeyboard() }
        );
      }

      // Default fallback for any photo/document sent when not awaiting proof
      if (isPhotoOrDoc && userId !== this.config.adminId) {
        return ctx.reply(
          `⚠️ <b>${toBoldSans('No Active Proof Request')}</b>\n\n` +
            `Screenshots sent without an active task submission cannot be processed or verified.\n\n` +
            `To submit proof for a QR task, please tap <b>🚀 ${toBoldSans('START EARN')}</b>, follow the instructions, and tap <b>📤 ${toBoldSans('Submit Proof')}</b> before uploading your screenshot.`,
          { parse_mode: 'HTML', reply_markup: getCtxKb(ctx) }
        );
      }
    });

    bot.catch((err) => {
      console.error('Error in Telegram bot handler:', err);
    });
  }
}
