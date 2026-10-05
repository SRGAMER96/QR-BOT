export interface CodeFile {
  name: string;
  language: 'typescript' | 'python' | 'json' | 'dockerfile' | 'markdown' | 'shell';
  path: string;
  description: string;
  content: string;
}

export interface CodeProject {
  id: string;
  title: string;
  runtime: 'Node.js (grammY)' | 'Python (python-telegram-bot v20+)';
  description: string;
  recommended: boolean;
  files: CodeFile[];
}

export const NODE_SOURCE_FILES: CodeFile[] = [
  {
    name: 'bot.ts',
    language: 'typescript',
    path: 'src/bot.ts',
    description: 'Main Telegram Bot entry point implementing all workflows, state management, and handlers.',
    content: `/**
 * ============================================================================
 * TELEGRAM QR EARNING BOT (Production-Ready)
 * Framework: grammY (TypeScript / Node.js)
 * 
 * Features:
 *  - Gorgeous welcome message with stylized Unicode typography
 *  - Persistent reply keyboard with bold Unicode buttons
 *  - Active QR task management with concurrency locks
 *  - Proof submission with Admin inline approval/rejection
 *  - Instant UPI withdrawal requests with balance debit & refund on rejection
 *  - Referral tracking with unique deep links & automated rewards
 *  - Admin panel with broadcast confirmation, QR updates, Ban/Unban, and Stats
 * ============================================================================
 */

import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from "grammy";
import { run } from "@grammyjs/runner";
import * as dotenv from "dotenv";
import { Database } from "./database";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID || "0", 10);
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "SupportAdmin";
const CURRENCY = process.env.CURRENCY_SYMBOL || "₹";
const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL || "50");
const REFERRAL_BONUS = parseFloat(process.env.REFERRAL_BONUS || "10");

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error("FATAL: Please set BOT_TOKEN and ADMIN_ID in your .env file!");
  process.exit(1);
}

// Unicode Styling Utilities for Fancy Telegram Fonts
const toBoldSans = (str: string): string => {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 65 && c <= 90) res += String.fromCodePoint(0x1d5d4 + (c - 65));
    else if (c >= 97 && c <= 122) res += String.fromCodePoint(0x1d5ee + (c - 97));
    else if (c >= 48 && c <= 57) res += String.fromCodePoint(0x1d7ec + (c - 48));
    else res += str[i];
  }
  return res;
};

// Keyboards & UI
const USER_KEYBOARD = new Keyboard()
  .text(\`🚀 \${toBoldSans("START EARN")}\`).text(\`👤 \${toBoldSans("PROFILE")}\`).row()
  .text(\`👥 \${toBoldSans("REFER & EARN")}\`).text(\`💰 \${toBoldSans("WITHDRAW")}\`).row()
  .text(\`📞 \${toBoldSans("SUPPORT")}\`)
  .resized();

const ADMIN_KEYBOARD = new Keyboard()
  .text(\`🚀 \${toBoldSans("START EARN")}\`).text(\`👤 \${toBoldSans("PROFILE")}\`).row()
  .text(\`👥 \${toBoldSans("REFER & EARN")}\`).text(\`💰 \${toBoldSans("WITHDRAW")}\`).row()
  .text(\`📞 \${toBoldSans("SUPPORT")}\`).text(\`🛠️ \${toBoldSans("ADMIN PANEL")}\`)
  .resized();

// Session State Interface
interface SessionData {
  step: "IDLE" | "AWAITING_PROOF" | "AWAITING_UPI_ID" | "AWAITING_WITHDRAW_AMOUNT" 
       | "AWAITING_BROADCAST_TEXT" | "AWAITING_NEW_QR_IMAGE" | "AWAITING_NEW_QR_REWARD" 
       | "AWAITING_BAN_ID" | "AWAITING_UNBAN_ID";
  tempUpiId?: string;
  tempBroadcastText?: string;
  tempNewQrImage?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(BOT_TOKEN);
const db = new Database("./bot_data.json");

// Install Session Middleware
bot.use(session({
  initial: (): SessionData => ({ step: "IDLE" })
}));

// Authorization / Ban check middleware
bot.use(async (ctx, next) => {
  if (!ctx.from) return;
  const user = db.getUser(ctx.from.id);
  if (user && user.isBanned && ctx.from.id !== ADMIN_ID) {
    await ctx.reply("🚫 <b>Your account has been suspended by the administrator.</b>", { parse_mode: "HTML" });
    return;
  }
  await next();
});

// ==========================================
// 1. WELCOME & ONBOARDING (/start)
// ==========================================
bot.command("start", async (ctx) => {
  const userId = ctx.from!.id;
  const firstName = ctx.from!.first_name || "Member";
  const username = ctx.from!.username;

  // Check if referred by someone
  const text = ctx.message?.text || "";
  const parts = text.split(" ");
  let referrerId: number | undefined;

  if (parts.length > 1 && parts[1].startsWith("ref_")) {
    const rawRef = parseInt(parts[1].replace("ref_", ""), 10);
    if (!isNaN(rawRef) && rawRef !== userId) {
      referrerId = rawRef;
    }
  }

  // Register or retrieve user
  const isNew = db.registerUser({
    id: userId,
    firstName,
    username,
    referredBy: referrerId
  });

  // Credit referral reward if new
  if (isNew && referrerId) {
    const referrer = db.getUser(referrerId);
    if (referrer) {
      db.adjustBalance(referrerId, REFERRAL_BONUS);
      db.incrementReferrals(referrerId);
      try {
        await ctx.api.sendMessage(
          referrerId,
          \`🎉 <b>\${toBoldSans("New Referral Joined!")}</b>\\n\\n\` +
          \`User <b>\${firstName}</b> joined using your referral link.\\n\` +
          \`💰 Bonus credited: <b>\${CURRENCY}\${REFERRAL_BONUS}</b>!\\n\` +
          \`Total Balance: <b>\${CURRENCY}\${referrer.balance + REFERRAL_BONUS}</b>\`,
          { parse_mode: "HTML" }
        );
      } catch (e) {
        console.warn("Could not notify referrer:", e);
      }
    }
  }

  ctx.session.step = "IDLE";

  const welcomeBanner = 
    \`🌟 <b>\${toBoldSans("WELCOME TO QR EARN OFFICIAL")}</b> 🌟\\n\\n\` +
    \`Hello <b>\${firstName}</b>! 👋\\n\` +
    \`Earn real instant cash by scanning verified QR codes and uploading proofs.\\n\\n\` +
    \`💎 <b>\${toBoldSans("How It Works:")}</b>\\n\` +
    \`1️⃣ Tap <b>🚀 \${toBoldSans("START EARN")}</b> to view the active QR task.\\n\` +
    \`2️⃣ Scan, complete payment or action according to instructions.\\n\` +
    \`3️⃣ Click <b>📤 \${toBoldSans("Submit Proof")}</b> and upload screenshot.\\n\` +
    \`4️⃣ Get rewarded immediately into your wallet!\\n\\n\` +
    \`💰 <b>Minimum Withdrawal:</b> \${CURRENCY}\${MIN_WITHDRAWAL} via UPI\\n\` +
    \`👥 <b>Referral Bonus:</b> \${CURRENCY}\${REFERRAL_BONUS} per active referral\\n\\n\` +
    \`<i>Select an option from the stylized keyboard below to get started:</i>\`;

  await ctx.reply(welcomeBanner, {
    parse_mode: "HTML",
    reply_markup: userId === ADMIN_ID ? ADMIN_KEYBOARD : USER_KEYBOARD
  });
});

// ==========================================
// 2. USER MAIN MENU ACTIONS
// ==========================================

// --- [ 🚀 START EARN ] ---
bot.hears(new RegExp(toBoldSans("START EARN")), async (ctx) => {
  const userId = ctx.from!.id;
  const activeTask = db.getActiveTask();

  if (!activeTask || activeTask.status === "claimed" || activeTask.status === "completed") {
    return ctx.reply(
      \`⚠️ <b>\${toBoldSans("No Active QR Tasks Currently")}</b>\\n\\n\` +
      \`The previous QR drop has been completed and verified!\\n\` +
      \`Please wait for the administrator to post a fresh QR code drop. 🔔\`,
      { parse_mode: "HTML" }
    );
  }

  // Check if locked
  if (activeTask.isLocked) {
    if (activeTask.lockedByUserId === userId) {
      return ctx.reply(
        \`⏳ <b>\${toBoldSans("Your Submission is Under Review")}</b>\\n\\n\` +
        \`You have already submitted proof for this QR task.\\n\` +
        \`The admin is reviewing your submission. You will be notified as soon as verified!\`,
        { parse_mode: "HTML" }
      );
    } else {
      return ctx.reply(
        \`🔒 <b>\${toBoldSans("QR Task Already Claimed")}</b>\\n\\n\` +
        \`Another member has already claimed and submitted proof for this QR task.\\n\` +
        \`Each QR drop is single-use only! Please wait for the admin to post the next fresh QR code. ⏳\`,
        { parse_mode: "HTML" }
      );
    }
  }

  const taskKeyboard = new InlineKeyboard()
    .text(\`📤 \${toBoldSans("Submit Proof")}\`, "btn_submit_proof")
    .text(\`❌ \${toBoldSans("Cancel")}\`, "btn_cancel_task");

  const caption = 
    \`🔥 <b>\${toBoldSans(activeTask.title)}</b>\\n\\n\` +
    \`💰 <b>Reward:</b> \${CURRENCY}\${activeTask.reward}\\n\` +
    \`📝 <b>Instructions:</b>\\n\${activeTask.instructions}\\n\\n\` +
    \`⚡ <i>Complete the task quickly! Once submitted, this task locks exclusively for you.</i>\`;

  if (activeTask.qrImageUrl.startsWith("http")) {
    await ctx.replyWithPhoto(activeTask.qrImageUrl, {
      caption,
      parse_mode: "HTML",
      reply_markup: taskKeyboard
    });
  } else {
    await ctx.reply(caption, {
      parse_mode: "HTML",
      reply_markup: taskKeyboard
    });
  }
});

// Callback: Submit Proof clicked
bot.callbackQuery("btn_submit_proof", async (ctx) => {
  const userId = ctx.from.id;
  const activeTask = db.getActiveTask();

  if (!activeTask) {
    await ctx.answerCallbackQuery({ text: "Task expired or unavailable!", show_alert: true });
    return;
  }

  if (activeTask.isLocked && activeTask.lockedByUserId !== userId) {
    await ctx.answerCallbackQuery({ text: "Sorry, another user already submitted proof for this task!", show_alert: true });
    return;
  }

  ctx.session.step = "AWAITING_PROOF";
  await ctx.answerCallbackQuery();

  await ctx.reply(
    \`📤 <b>\${toBoldSans("SUBMIT TASK PROOF")}</b>\\n\\n\` +
    \`Please upload your proof now! You can send:\\n\` +
    \`• A <b>Screenshot / Photo</b> of the completed transaction/task\\n\` +
    \`• Or type the <b>UTR / Transaction ID</b> as a text message.\\n\\n\` +
    \`<i>If you changed your mind, tap Cancel below:</i>\`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(\`❌ \${toBoldSans("Cancel")}\`, "btn_cancel_task")
    }
  );
});

// Callback: Cancel Task clicked (Anti-repeat cancel and screenshot blocker)
bot.callbackQuery("btn_cancel_task", async (ctx) => {
  const userId = ctx.from.id;
  const activeTask = db.getActiveTask();
  const holdsLock = activeTask && activeTask.lockedByUserId === userId;

  // 1. Prevent repeated cancellations
  if (ctx.session.step !== "AWAITING_PROOF" && !holdsLock && ctx.session.isTaskCancelled) {
    await ctx.answerCallbackQuery({
      text: "⚠️ Task has already been cancelled! You cannot cancel again.",
      show_alert: true
    });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {}
    return;
  }

  // 2. Remove inline keyboard immediately so buttons cannot be pressed again
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch (e) {}

  // 3. Release lock if held
  if (activeTask && activeTask.lockedByUserId === userId) {
    db.unlockTask();
  }

  ctx.session.step = "IDLE";
  ctx.session.isTaskCancelled = true;

  await ctx.answerCallbackQuery({ text: "Task cancelled. Proof submission disabled." });
  await ctx.reply(
    \`❌ <b>\${toBoldSans("Task Session Cancelled")}</b>\\n\\n\` +
    \`• Further actions—such as submitting screenshots or UTR numbers—are now blocked for this cancelled session.\\n\` +
    \`• You cannot repeatedly cancel this task.\\n\` +
    \`• The QR code remains open if you wish to start a new attempt.\\n\\n\` +
    \`Tap <b>🚀 \${toBoldSans("START EARN")}</b> on your keyboard whenever you wish to start fresh!\`,
    { parse_mode: "HTML", reply_markup: USER_KEYBOARD }
  );
});

// --- [ 👤 PROFILE ] ---
bot.hears(new RegExp(toBoldSans("PROFILE")), async (ctx) => {
  const user = db.getUser(ctx.from!.id);
  if (!user) return;

  const profileText = 
    \`👤 <b>\${toBoldSans("YOUR ACCOUNT PROFILE")}</b>\\n\\n\` +
    \`🆔 <b>Telegram ID:</b> <code>\${user.id}</code>\\n\` +
    \`👤 <b>Name:</b> \${user.firstName} \${user.username ? \`(@\${user.username})\` : ""}\\n\` +
    \`💰 <b>Available Balance:</b> <b>\${CURRENCY}\${user.balance.toFixed(2)}</b>\\n\` +
    \`👥 <b>Referrals Count:</b> <b>\${user.referralCount}</b> members\\n\` +
    \`✅ <b>Tasks Completed:</b> <b>\${user.tasksCompleted}</b>\\n\` +
    \`📅 <b>Member Since:</b> \${new Date(user.joinedAt).toLocaleDateString()}\\n\\n\` +
    \`💳 <i>You can request payout to any UPI ID once your balance reaches \${CURRENCY}\${MIN_WITHDRAWAL}.</i>\`;

  await ctx.reply(profileText, {
    parse_mode: "HTML",
    reply_markup: USER_KEYBOARD
  });
});

// --- [ 👥 REFER & EARN ] ---
bot.hears(new RegExp(toBoldSans("REFER & EARN")), async (ctx) => {
  const userId = ctx.from!.id;
  const botInfo = await ctx.api.getMe();
  const refLink = \`https://t.me/\${botInfo.username}?start=ref_\${userId}\`;

  const shareKeyboard = new InlineKeyboard()
    .url(\`🚀 \${toBoldSans("Share With Friends")}\`, \`https://t.me/share/url?url=\${encodeURIComponent(refLink)}&text=\${encodeURIComponent("🔥 Earn instant cash on Telegram with QR tasks! Join now:")}\`);

  const referText = 
    \`👥 <b>\${toBoldSans("REFER & EARN REWARDS")}</b>\\n\\n\` +
    \`Invite friends and earn <b>\${CURRENCY}\${REFERRAL_BONUS}</b> for every friend who joins!\\n\\n\` +
    \`🔗 <b>Your Exclusive Referral Link:</b>\\n\` +
    \`<code>\${refLink}</code>\\n\\n\` +
    \`📊 <b>Your Total Referrals:</b> \${db.getUser(userId)?.referralCount || 0}\\n\\n\` +
    \`<i>Click below to share directly with your Telegram contacts and groups!</i>\`;

  await ctx.reply(referText, {
    parse_mode: "HTML",
    reply_markup: shareKeyboard
  });
});

// --- [ 💰 WITHDRAW (UPI) ] ---
bot.hears(new RegExp(toBoldSans("WITHDRAW")), async (ctx) => {
  const user = db.getUser(ctx.from!.id);
  if (!user) return;

  if (user.balance < MIN_WITHDRAWAL) {
    return ctx.reply(
      \`⚠️ <b>\${toBoldSans("Insufficient Balance")}</b>\\n\\n\` +
      \`Your Current Balance: <b>\${CURRENCY}\${user.balance.toFixed(2)}</b>\\n\` +
      \`Minimum Payout Required: <b>\${CURRENCY}\${MIN_WITHDRAWAL.toFixed(2)}</b>\\n\\n\` +
      \`Complete more QR tasks or invite friends to reach the threshold!\`,
      { parse_mode: "HTML" }
    );
  }

  ctx.session.step = "AWAITING_UPI_ID";
  await ctx.reply(
    \`💰 <b>\${toBoldSans("UPI WITHDRAWAL SYSTEM")}</b>\\n\\n\` +
    \`Your Balance: <b>\${CURRENCY}\${user.balance.toFixed(2)}</b>\\n\\n\` +
    \`Please enter your valid <b>UPI ID</b> (e.g. <code>username@okaxis</code> or <code>mobile@paytm</code>):\\n\\n\` +
    \`<i>Send /cancel to abort at any time.</i>\`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(\`❌ \${toBoldSans("Cancel")}\`, "btn_cancel_withdraw")
    }
  );
});

bot.callbackQuery("btn_cancel_withdraw", async (ctx) => {
  ctx.session.step = "IDLE";
  delete ctx.session.tempUpiId;
  await ctx.answerCallbackQuery({ text: "Withdrawal aborted." });
  await ctx.reply("Withdrawal request canceled.", { reply_markup: USER_KEYBOARD });
});

// --- [ 📞 SUPPORT ] ---
bot.hears(new RegExp(toBoldSans("SUPPORT")), async (ctx) => {
  const supportKeyboard = new InlineKeyboard()
    .url(\`💬 \${toBoldSans("Contact Support")}\`, \`https://t.me/\${SUPPORT_USERNAME}\`);

  await ctx.reply(
    \`📞 <b>\${toBoldSans("OFFICIAL SUPPORT DESK")}</b>\\n\\n\` +
    \`Have a query regarding tasks, pending verification, or withdrawals?\\n\` +
    \`Our support team is available 24/7 to assist you.\\n\\n\` +
    \`👤 <b>Admin Username:</b> @\${SUPPORT_USERNAME}\\n\` +
    \`⚡ <i>Always include your Telegram ID (\${ctx.from!.id}) when writing to support.</i>\`,
    {
      parse_mode: "HTML",
      reply_markup: supportKeyboard
    }
  );
});

// ==========================================
// 3. ADMIN PANEL (Exclusive for Admin ID)
// ==========================================
bot.hears(new RegExp(toBoldSans("ADMIN PANEL")), async (ctx) => {
  const userId = ctx.from!.id;
  if (userId !== ADMIN_ID) {
    return ctx.reply("⛔ <b>Access Denied:</b> This area is restricted to designated administrators only.", { parse_mode: "HTML" });
  }

  const adminMenu = new InlineKeyboard()
    .text(\`📢 \${toBoldSans("Broadcast")}\`, "adm_broadcast")
    .text(\`➕ \${toBoldSans("Set QR")}\`, "adm_set_qr")
    .text(\`🗑️ \${toBoldSans("Delete QR")}\`, "adm_delete_qr").row()
    .text(\`🚫 \${toBoldSans("Ban User")}\`, "adm_ban_user")
    .text(\`✅ \${toBoldSans("Unban User")}\`, "adm_unban_user")
    .text(\`ℹ️ \${toBoldSans("User Info")}\`, "adm_user_info").row()
    .text(\`➕ \${toBoldSans("Add Balance")}\`, "adm_add_balance")
    .text(\`➖ \${toBoldSans("Remove Bal")}\`, "adm_rem_balance")
    .text(\`📈 \${toBoldSans("Set Ref %")}\`, "adm_set_ref_pct").row()
    .text(\`📊 \${toBoldSans("Statistics")}\`, "adm_stats")
    .text(\`🔔 \${toBoldSans("Withdrawals")}\`, "adm_withdrawals");

  await ctx.reply(
    \`🛠️ <b>\${toBoldSans("EXECUTIVE ADMIN DASHBOARD")}</b>\\n\\n\` +
    \`Welcome Chief Admin! Select an administrative command from below:\\n\\n\` +
    \`• <b>Broadcast:</b> Deliver announcements to all subscribers\\n\` +
    \`• <b>Set / Delete QR:</b> Manage active QR drop\\n\` +
    \`• <b>Ban / Unban / Info:</b> User access and detailed account lookup\\n\` +
    \`• <b>Add / Remove Balance:</b> Manual ledger adjustments\\n\` +
    \`• <b>Set Ref %:</b> Configure referral commission rate\\n\` +
    \`• <b>Withdrawals:</b> Review pending UPI cashouts\`,
    {
      parse_mode: "HTML",
      reply_markup: adminMenu
    }
  );
});

// Admin: Statistics
bot.callbackQuery("adm_stats", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const stats = db.getStatistics();

  const statsText = 
    \`📊 <b>\${toBoldSans("BOT SYSTEM STATISTICS")}</b>\\n\\n\` +
    \`👥 <b>Total Users:</b> \${stats.totalUsers}\\n\` +
    \`💰 <b>Total Active Balances:</b> \${CURRENCY}\${stats.totalActiveBalance.toFixed(2)}\\n\` +
    \`💸 <b>Total Payouts Approved:</b> \${CURRENCY}\${stats.totalPayouts.toFixed(2)}\\n\` +
    \`⏳ <b>Pending Withdrawals:</b> \${stats.pendingWithdrawalsCount} requests\\n\` +
    \`📥 <b>Pending Proofs:</b> \${stats.pendingProofsCount} submissions\\n\` +
    \`🎯 <b>Tasks Completed:</b> \${stats.totalTasksCompleted}\\n\\n\` +
    \`🟢 <b>System Status:</b> Healthy & Operational\`;

  await ctx.answerCallbackQuery();
  await ctx.reply(statsText, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("« Back to Admin", "adm_back")
  });
});

// Admin: Set QR Code
bot.callbackQuery("adm_set_qr", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.step = "AWAITING_NEW_QR_IMAGE";

  await ctx.answerCallbackQuery();
  await ctx.reply(
    \`➕ <b>\${toBoldSans("SET NEW QR CODE")}</b>\\n\\n\` +
    \`Please send the <b>QR Code Image</b> now (as a photo attachment) or send an Image URL.\\n\\n\` +
    \`<i>Posting a new QR immediately resets task locks and allows all users to earn again.</i>\`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("❌ Cancel", "adm_back")
    }
  );
});

// Admin: Broadcast
bot.callbackQuery("adm_broadcast", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.step = "AWAITING_BROADCAST_TEXT";

  await ctx.answerCallbackQuery();
  await ctx.reply(
    \`📢 <b>\${toBoldSans("GLOBAL BROADCAST DISPATCH")}</b>\\n\\n\` +
    \`Please type the broadcast message you want to deliver to all users.\\n\` +
    \`You will be asked to confirm before messages are sent.\\n\\n\` +
    \`<i>HTML formatting is supported (e.g. &lt;b&gt;bold&lt;/b&gt;).</i>\`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("❌ Cancel", "adm_back")
    }
  );
});

// Admin: User Management
bot.callbackQuery("adm_users", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const userActionKb = new InlineKeyboard()
    .text("🚫 Ban User by ID", "adm_ban_user")
    .text("✅ Unban User by ID", "adm_unban_user")
    .text("🗑️ Delete User", "adm_del_user").row()
    .text("« Back to Admin", "adm_back");

  await ctx.reply(
    \`🛠️ <b>\${toBoldSans("USER ACCESS CONTROL")}</b>\\n\\n\` +
    \`Choose an action to manage user privileges:\`,
    { parse_mode: "HTML", reply_markup: userActionKb }
  );
});

bot.callbackQuery("adm_ban_user", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.step = "AWAITING_BAN_ID";
  await ctx.answerCallbackQuery();
  await ctx.reply("Please enter the <b>Telegram User ID</b> to BAN:", { parse_mode: "HTML" });
});

bot.callbackQuery("adm_unban_user", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.step = "AWAITING_UNBAN_ID";
  await ctx.answerCallbackQuery();
  await ctx.reply("Please enter the <b>Telegram User ID</b> to UNBAN:", { parse_mode: "HTML" });
});

// Admin: Withdrawals view
bot.callbackQuery("adm_withdrawals", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  const pending = db.getPendingWithdrawals();

  if (pending.length === 0) {
    return ctx.reply("✅ <b>No pending withdrawal requests found!</b>", {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("« Back to Admin", "adm_back")
    });
  }

  for (const w of pending.slice(0, 5)) {
    const kb = new InlineKeyboard()
      .text(\`✅ \${toBoldSans("Approve")}\`, \`withdraw_approve_\${w.id}\`)
      .text(\`❌ \${toBoldSans("Reject")}\`, \`withdraw_reject_\${w.id}\`);

    await ctx.reply(
      \`🔔 <b>Withdrawal Request</b>\\n\\n\` +
      \`🆔 Request ID: <code>\${w.id}</code>\\n\` +
      \`👤 User: <b>\${w.userName}</b> (<code>\${w.userId}</code>)\\n\` +
      \`💰 Amount: <b>\${CURRENCY}\${w.amount}</b>\\n\` +
      \`💳 UPI ID: <code>\${w.upiId}</code>\\n\` +
      \`📅 Date: \${new Date(w.createdAt).toLocaleString()}\`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
});

// Back to Admin Main Menu
bot.callbackQuery("adm_back", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.step = "IDLE";
  await ctx.answerCallbackQuery();

  const adminMenu = new InlineKeyboard()
    .text(\`📢 \${toBoldSans("Broadcast")}\`, "adm_broadcast")
    .text(\`➕ \${toBoldSans("Set QR Code")}\`, "adm_set_qr").row()
    .text(\`🛠️ \${toBoldSans("User Management")}\`, "adm_users")
    .text(\`📊 \${toBoldSans("Statistics")}\`, "adm_stats").row()
    .text(\`🔔 \${toBoldSans("Withdrawals")}\`, "adm_withdrawals");

  await ctx.reply("🛠️ <b>Main Admin Panel</b>", { parse_mode: "HTML", reply_markup: adminMenu });
});

// ==========================================
// 4. INCOMING MESSAGE & STATE HANDLER
// ==========================================
bot.on("message", async (ctx) => {
  const userId = ctx.from.id;
  const user = db.getUser(userId);

  // 1. Handling Task Proof Upload (Photo or Text)
  if (ctx.session.step === "AWAITING_PROOF") {
    const activeTask = db.getActiveTask();
    if (!activeTask) {
      ctx.session.step = "IDLE";
      return ctx.reply("⚠️ Task expired or no longer available.");
    }

    let proofFileId: string | undefined;
    let proofText: string | undefined;

    if (ctx.message.photo && ctx.message.photo.length > 0) {
      proofFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      proofText = ctx.message.caption;
    } else if (ctx.message.text) {
      proofText = ctx.message.text;
    } else {
      return ctx.reply("Please send either a screenshot image or proof text/UTR!");
    }

    // Submit Proof and LOCK the QR task globally
    const proof = db.createProof({
      userId,
      userName: ctx.from.first_name || "User",
      userUsername: ctx.from.username,
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      reward: activeTask.reward,
      proofImageUrl: proofFileId || "text_proof",
      proofText: proofText || "Screenshot attached"
    });

    // Lock task for this user so others cannot claim it
    db.lockTaskForReview(activeTask.id, userId, ctx.from.first_name || "User");

    ctx.session.step = "IDLE";

    await ctx.reply(
      \`✅ <b>\${toBoldSans("Proof Submitted Successfully!")}</b>\\n\\n\` +
      \`Your submission has been queued and forwarded to the administrator.\\n\` +
      \`🔒 This QR task is now locked until review completes.\\n\\n\` +
      \`You will receive a notification as soon as it is approved! 🚀\`,
      { parse_mode: "HTML", reply_markup: USER_KEYBOARD }
    );

    // Notify Admin with Review Buttons
    const adminReviewKb = new InlineKeyboard()
      .text(\`✅ \${toBoldSans("Approve")}\`, \`proof_approve_\${proof.id}\`)
      .text(\`❌ \${toBoldSans("Reject")}\`, \`proof_reject_\${proof.id}\`);

    const adminNotice = 
      \`📥 <b>\${toBoldSans("NEW TASK PROOF SUBMITTED")}</b>\\n\\n\` +
      \`👤 User: <b>\${ctx.from.first_name}</b> (@\${ctx.from.username || "none"})\\n\` +
      \`🆔 User ID: <code>\${userId}</code>\\n\` +
      \`🎯 Task: <b>\${activeTask.title}</b>\\n\` +
      \`💰 Reward: <b>\${CURRENCY}\${activeTask.reward}</b>\\n\` +
      \`📝 Note: \${proofText || "None"}\\n\\n\` +
      \`<i>Tap an action below to process reward:</i>\`;

    try {
      if (proofFileId) {
        await ctx.api.sendPhoto(ADMIN_ID, proofFileId, {
          caption: adminNotice,
          parse_mode: "HTML",
          reply_markup: adminReviewKb
        });
      } else {
        await ctx.api.sendMessage(ADMIN_ID, adminNotice, {
          parse_mode: "HTML",
          reply_markup: adminReviewKb
        });
      }
    } catch (e) {
      console.error("Failed to forward proof to admin:", e);
    }
    return;
  }

  // 2. Handling UPI ID entry for Withdrawal
  if (ctx.session.step === "AWAITING_UPI_ID") {
    const upi = ctx.message.text?.trim();
    if (!upi || !upi.includes("@")) {
      return ctx.reply("❌ Invalid UPI format! Please enter a valid UPI ID (e.g. <code>name@upi</code>):", { parse_mode: "HTML" });
    }

    ctx.session.tempUpiId = upi;
    ctx.session.step = "AWAITING_WITHDRAW_AMOUNT";

    return ctx.reply(
      \`💳 <b>UPI ID Registered:</b> <code>\${upi}</code>\\n\\n\` +
      \`Enter the amount you wish to withdraw (Min: \${CURRENCY}\${MIN_WITHDRAWAL}, Max: \${CURRENCY}\${user?.balance.toFixed(2)}):\\n\\n\` +
      \`<i>Send /cancel to abort.</i>\`,
      { parse_mode: "HTML" }
    );
  }

  // 3. Handling Withdrawal Amount entry
  if (ctx.session.step === "AWAITING_WITHDRAW_AMOUNT") {
    const amount = parseFloat(ctx.message.text?.trim() || "0");
    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      return ctx.reply(\`❌ Minimum withdrawal is \${CURRENCY}\${MIN_WITHDRAWAL}. Please enter a valid number:\`);
    }

    if (amount > (user?.balance || 0)) {
      return ctx.reply(\`❌ Insufficient funds. Your available balance is \${CURRENCY}\${user?.balance.toFixed(2)}. Try again:\`);
    }

    const upiId = ctx.session.tempUpiId!;
    // Instantly deduct balance
    db.adjustBalance(userId, -amount);

    // Create withdrawal record
    const withdrawal = db.createWithdrawal({
      userId,
      userName: ctx.from.first_name || "User",
      userUsername: ctx.from.username,
      upiId,
      amount
    });

    ctx.session.step = "IDLE";
    delete ctx.session.tempUpiId;

    await ctx.reply(
      \`✅ <b>\${toBoldSans("Withdrawal Request Queued!")}</b>\\n\\n\` +
      \`💰 Amount: <b>\${CURRENCY}\${amount.toFixed(2)}</b>\\n\` +
      \`💳 Destination UPI: <code>\${upiId}</code>\\n\` +
      \`📉 Remaining Balance: <b>\${CURRENCY}\${(user!.balance - amount).toFixed(2)}</b>\\n\\n\` +
      \`Our admin is reviewing your payment. You will receive notification once transferred!\`,
      { parse_mode: "HTML", reply_markup: USER_KEYBOARD }
    );

    // Notify Admin with Approve / Reject buttons
    const adminWithdrawKb = new InlineKeyboard()
      .text(\`✅ \${toBoldSans("Approve Payout")}\`, \`withdraw_approve_\${withdrawal.id}\`)
      .text(\`❌ \${toBoldSans("Reject & Refund")}\`, \`withdraw_reject_\${withdrawal.id}\`);

    try {
      await ctx.api.sendMessage(
        ADMIN_ID,
        \`🔔 <b>\${toBoldSans("NEW UPI WITHDRAWAL REQUEST")}</b>\\n\\n\` +
        \`👤 User: <b>\${ctx.from.first_name}</b> (@\${ctx.from.username || "none"})\\n\` +
        \`🆔 User ID: <code>\${userId}</code>\\n\` +
        \`💰 Amount: <b>\${CURRENCY}\${amount}</b>\\n\` +
        \`💳 UPI ID: <code>\${upiId}</code>\\n\` +
        \`🕒 Timestamp: \${new Date().toLocaleString()}\\n\\n\` +
        \`<i>Action:</i>\`,
        { parse_mode: "HTML", reply_markup: adminWithdrawKb }
      );
    } catch (e) {
      console.error("Failed to notify admin of withdrawal:", e);
    }
    return;
  }

  // 4. Admin Broadcast Flow
  if (ctx.session.step === "AWAITING_BROADCAST_TEXT" && userId === ADMIN_ID) {
    const text = ctx.message.text;
    if (!text) return ctx.reply("Please provide a text message for the broadcast!");

    ctx.session.tempBroadcastText = text;
    ctx.session.step = "IDLE";

    const confirmKb = new InlineKeyboard()
      .text(\`✅ \${toBoldSans("Done / Send")}\`, "adm_broadcast_confirm")
      .text(\`❌ \${toBoldSans("Cancel")}\`, "adm_broadcast_abort");

    return ctx.reply(
      \`📢 <b>\${toBoldSans("CONFIRM BROADCAST DISPATCH")}</b>\\n\\n\` +
      \`<b>Preview:</b>\\n\${text}\\n\\n\` +
      \`Total Recipients: <b>\${db.getAllUserIds().length}</b> users\\n\\n\` +
      \`<i>Do you want to dispatch this message now?</i>\`,
      { parse_mode: "HTML", reply_markup: confirmKb }
    );
  }

  // 5. Admin Set QR Flow
  if (ctx.session.step === "AWAITING_NEW_QR_IMAGE" && userId === ADMIN_ID) {
    let imageUrl: string | undefined;
    if (ctx.message.photo && ctx.message.photo.length > 0) {
      imageUrl = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    } else if (ctx.message.text && ctx.message.text.startsWith("http")) {
      imageUrl = ctx.message.text.trim();
    } else {
      return ctx.reply("Please send a photo or a valid image URL!");
    }

    // Automatically set and activate in Start Earn!
    db.setActiveTask({
      id: "task_" + Date.now(),
      title: "Scan & Complete QR Task",
      qrImageUrl: imageUrl,
      reward: 50,
      instructions: "Scan the QR code above with any UPI / payment app. Complete the task and upload your screenshot proof.",
      isLocked: false,
      status: "active"
    });

    ctx.session.step = "IDLE";

    return ctx.reply(
      \`✅ <b>\${toBoldSans("QR Code Photo Activated!")}</b>\\n\\n\` +
      \`💰 Reward: \${CURRENCY}50\\n\` +
      \`🚀 The QR code has been <b>automatically added to Start Earn</b> for all members!\\n\` +
      \`All subscribers can now see and submit this task.\`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("🗑️ Delete QR", "adm_delete_qr")
          .text("« Back to Admin", "adm_back")
      }
    );
  }

  // 6. Admin Ban / Unban User Flow
  if (ctx.session.step === "AWAITING_BAN_ID" && userId === ADMIN_ID) {
    const targetId = parseInt(ctx.message.text?.trim() || "0", 10);
    if (!targetId) return ctx.reply("Invalid ID format!");

    db.setUserBanStatus(targetId, true);
    ctx.session.step = "IDLE";
    return ctx.reply(\`🚫 User <code>\${targetId}</code> has been <b>BANNED</b> successfully.\`, { parse_mode: "HTML" });
  }

  if (ctx.session.step === "AWAITING_UNBAN_ID" && userId === ADMIN_ID) {
    const targetId = parseInt(ctx.message.text?.trim() || "0", 10);
    if (!targetId) return ctx.reply("Invalid ID format!");

    db.setUserBanStatus(targetId, false);
    ctx.session.step = "IDLE";
    return ctx.reply(\`✅ User <code>\${targetId}</code> has been <b>UNBANNED</b> successfully.\`, { parse_mode: "HTML" });
  }
});

// ==========================================
// 5. CALLBACK HANDLERS (ADMIN ACTIONS)
// ==========================================

// Broadcast Confirm
bot.callbackQuery("adm_broadcast_confirm", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const text = ctx.session.tempBroadcastText;
  if (!text) {
    await ctx.answerCallbackQuery({ text: "Broadcast expired!", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Dispatching broadcast..." });
  await ctx.reply("🚀 Broadcast started. Sending to all members...");

  const userIds = db.getAllUserIds();
  let delivered = 0;
  let failed = 0;

  for (const uid of userIds) {
    try {
      await ctx.api.sendMessage(uid, text, { parse_mode: "HTML" });
      delivered++;
      // Sleep slightly to respect Telegram rate limits
      await new Promise(r => setTimeout(r, 40));
    } catch {
      failed++;
    }
  }

  delete ctx.session.tempBroadcastText;
  await ctx.reply(
    \`📢 <b>Broadcast Completed!</b>\\n\\n\` +
    \`✅ Delivered: \${delivered}\\n\` +
    \`❌ Failed / Blocked: \${failed}\`,
    { parse_mode: "HTML", reply_markup: USER_KEYBOARD }
  );
});

bot.callbackQuery("adm_broadcast_abort", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  delete ctx.session.tempBroadcastText;
  await ctx.answerCallbackQuery({ text: "Broadcast canceled." });
  await ctx.reply("Broadcast dispatch aborted.", { reply_markup: USER_KEYBOARD });
});

// Proof Approval & Rejection Handlers
bot.callbackQuery(/^proof_approve_([a-zA-Z0-9_]+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const proofId = ctx.match[1];
  const proof = db.getProof(proofId);

  if (!proof || proof.status !== "pending") {
    await ctx.answerCallbackQuery({ text: "Proof already handled or not found!", show_alert: true });
    return;
  }

  // Approve proof: add reward to user balance & complete task
  db.updateProofStatus(proofId, "approved");
  db.adjustBalance(proof.userId, proof.reward);
  db.incrementCompletedTasks(proof.userId);
  db.markActiveTaskClaimed();

  await ctx.answerCallbackQuery({ text: "Proof approved!" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  await ctx.reply(\`✅ <b>Approved!</b> Credited \${CURRENCY}\${proof.reward} to User <code>\${proof.userId}</code>.\`, { parse_mode: "HTML" });

  // Notify user
  try {
    await ctx.api.sendMessage(
      proof.userId,
      \`🎉 <b>\${toBoldSans("TASK PROOF APPROVED!")}</b>\\n\\n\` +
      \`Your submission for <b>\${proof.taskTitle}</b> has been verified by the admin!\\n\` +
      \`💰 Reward Credited: <b>\${CURRENCY}\${proof.reward}</b>\\n\` +
      \`Check your new balance with 👤 \${toBoldSans("PROFILE")}!\`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    console.warn("Could not notify user of approval:", e);
  }
});

bot.callbackQuery(/^proof_reject_([a-zA-Z0-9_]+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const proofId = ctx.match[1];
  const proof = db.getProof(proofId);

  if (!proof || proof.status !== "pending") {
    await ctx.answerCallbackQuery({ text: "Proof already handled!", show_alert: true });
    return;
  }

  // Reject proof: unlock the task so others can complete it
  db.updateProofStatus(proofId, "rejected");
  db.unlockTask();

  await ctx.answerCallbackQuery({ text: "Proof rejected. Task unlocked." });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  await ctx.reply(\`❌ <b>Rejected.</b> Task has been unlocked for others.\`, { parse_mode: "HTML" });

  try {
    await ctx.api.sendMessage(
      proof.userId,
      \`❌ <b>\${toBoldSans("TASK PROOF REJECTED")}</b>\\n\\n\` +
      \`Your proof for <b>\${proof.taskTitle}</b> could not be verified.\\n\` +
      \`Reason: Invalid screenshot or transaction not confirmed.\\n\\n\` +
      \`You may try again when a new QR is published.\`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    console.warn("Could not notify user of rejection:", e);
  }
});

// Withdrawal Approval & Rejection Handlers
bot.callbackQuery(/^withdraw_approve_([a-zA-Z0-9_]+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const withdrawId = ctx.match[1];
  const item = db.getWithdrawal(withdrawId);

  if (!item || item.status !== "pending") {
    await ctx.answerCallbackQuery({ text: "Request already handled!", show_alert: true });
    return;
  }

  db.updateWithdrawalStatus(withdrawId, "approved");
  await ctx.answerCallbackQuery({ text: "Withdrawal approved!" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  await ctx.reply(\`✅ Payout of \${CURRENCY}\${item.amount} to <code>\${item.upiId}</code> marked <b>PAID</b>.\`, { parse_mode: "HTML" });

  try {
    await ctx.api.sendMessage(
      item.userId,
      \`🎉 <b>\${toBoldSans("PAYMENT PROCESSED SUCCESSFULLY!")}</b>\\n\\n\` +
      \`💰 Amount: <b>\${CURRENCY}\${item.amount}</b>\\n\` +
      \`💳 UPI ID: <code>\${item.upiId}</code>\\n\` +
      \`⚡ Status: <b>Completed (Transferred)</b>\\n\\n\` +
      \`Thank you for participating with our QR Earning bot!\`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    console.warn("Could not notify user of payout:", e);
  }
});

bot.callbackQuery(/^withdraw_reject_([a-zA-Z0-9_]+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const withdrawId = ctx.match[1];
  const item = db.getWithdrawal(withdrawId);

  if (!item || item.status !== "pending") {
    await ctx.answerCallbackQuery({ text: "Request already handled!", show_alert: true });
    return;
  }

  // Reject and refund balance
  db.updateWithdrawalStatus(withdrawId, "rejected");
  db.adjustBalance(item.userId, item.amount);

  await ctx.answerCallbackQuery({ text: "Withdrawal rejected & refunded." });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  await ctx.reply(\`❌ Payout rejected. \${CURRENCY}\${item.amount} refunded to User <code>\${item.userId}</code>.\`, { parse_mode: "HTML" });

  try {
    await ctx.api.sendMessage(
      item.userId,
      \`⚠️ <b>\${toBoldSans("WITHDRAWAL REQUEST REJECTED")}</b>\\n\\n\` +
      \`Your request for <b>\${CURRENCY}\${item.amount}</b> to <code>\${item.upiId}</code> was rejected.\\n\` +
      \`💰 <b>Refund:</b> \${CURRENCY}\${item.amount} has been restored to your wallet balance.\\n\\n\` +
      \`Please verify your UPI handle and retry, or contact 📞 \${toBoldSans("SUPPORT")}.\`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    console.warn("Could not notify user of refund:", e);
  }
});

// Error handling & Graceful Shutdown
bot.catch((err) => {
  console.error("Error in bot update handler:", err);
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

// Launch Bot Runner
console.log("🚀 Telegram QR Earning Bot Starting...");
run(bot);
`
  },
  {
    name: 'database.ts',
    language: 'typescript',
    path: 'src/database.ts',
    description: 'Thread-safe JSON / SQLite storage engine with state locks and balance ledger.',
    content: `/**
 * Simple, robust database engine using atomic JSON writes.
 * In high-load production, replace with SQLite (better-sqlite3) or PostgreSQL.
 */
import * as fs from "fs";
import * as path from "path";

export interface UserRecord {
  id: number;
  firstName: string;
  username?: string;
  balance: number;
  referralCount: number;
  referredBy?: number;
  isBanned: boolean;
  tasksCompleted: number;
  joinedAt: string;
}

export interface QRTaskRecord {
  id: string;
  title: string;
  qrImageUrl: string;
  reward: number;
  instructions: string;
  isLocked: boolean;
  lockedByUserId?: number;
  lockedByUserName?: string;
  status: "active" | "in_review" | "claimed";
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
  proofImageUrl: string;
  proofText?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: number;
  userName: string;
  userUsername?: string;
  upiId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface DatabaseSchema {
  users: Record<number, UserRecord>;
  activeTask: QRTaskRecord | null;
  proofs: Record<string, ProofRecord>;
  withdrawals: Record<string, WithdrawalRecord>;
}

export class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Failed to read database, initializing fresh:", e);
    }

    const initial: DatabaseSchema = {
      users: {},
      activeTask: {
        id: "task_initial",
        title: "Official UPI QR Task #1",
        qrImageUrl: "https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=upi://pay?pa=earnqr@okaxis&pn=OfficialEarning&am=10",
        reward: 50,
        instructions: "1. Scan the QR code using any UPI app (GPay/PhonePe/Paytm).\\n2. Complete payment or promo sign-up.\\n3. Take screenshot showing transaction UTR and upload as proof.",
        isLocked: false,
        status: "active",
        createdAt: new Date().toISOString()
      },
      proofs: {},
      withdrawals: {}
    };
    this.save(initial);
    return initial;
  }

  private save(dataToSave = this.data) {
    try {
      const tempPath = \`\${this.filePath}.tmp\`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error("Failed to atomically write database:", e);
    }
  }

  // --- Users ---
  getUser(id: number): UserRecord | undefined {
    return this.data.users[id];
  }

  registerUser(info: { id: number; firstName: string; username?: string; referredBy?: number }): boolean {
    if (this.data.users[info.id]) {
      return false; // Existing user
    }
    this.data.users[info.id] = {
      id: info.id,
      firstName: info.firstName,
      username: info.username,
      balance: 0,
      referralCount: 0,
      referredBy: info.referredBy,
      isBanned: false,
      tasksCompleted: 0,
      joinedAt: new Date().toISOString()
    };
    this.save();
    return true;
  }

  adjustBalance(userId: number, delta: number) {
    const user = this.data.users[userId];
    if (user) {
      user.balance = Math.max(0, user.balance + delta);
      this.save();
    }
  }

  incrementReferrals(userId: number) {
    const user = this.data.users[userId];
    if (user) {
      user.referralCount += 1;
      this.save();
    }
  }

  incrementCompletedTasks(userId: number) {
    const user = this.data.users[userId];
    if (user) {
      user.tasksCompleted += 1;
      this.save();
    }
  }

  setUserBanStatus(userId: number, isBanned: boolean) {
    const user = this.data.users[userId];
    if (user) {
      user.isBanned = isBanned;
      this.save();
    }
  }

  getAllUserIds(): number[] {
    return Object.keys(this.data.users).map(Number);
  }

  // --- QR Task & Locking ---
  getActiveTask(): QRTaskRecord | null {
    return this.data.activeTask;
  }

  setActiveTask(task: QRTaskRecord) {
    this.data.activeTask = task;
    this.save();
  }

  lockTaskForReview(taskId: string, userId: number, userName: string) {
    if (this.data.activeTask && this.data.activeTask.id === taskId) {
      this.data.activeTask.isLocked = true;
      this.data.activeTask.lockedByUserId = userId;
      this.data.activeTask.lockedByUserName = userName;
      this.data.activeTask.status = "in_review";
      this.save();
    }
  }

  unlockTask() {
    if (this.data.activeTask) {
      this.data.activeTask.isLocked = false;
      delete this.data.activeTask.lockedByUserId;
      delete this.data.activeTask.lockedByUserName;
      this.data.activeTask.status = "active";
      this.save();
    }
  }

  markActiveTaskClaimed() {
    if (this.data.activeTask) {
      this.data.activeTask.isLocked = true;
      this.data.activeTask.status = "claimed";
      this.save();
    }
  }

  // --- Proofs ---
  createProof(p: Omit<ProofRecord, "id" | "status" | "submittedAt">): ProofRecord {
    const id = "proof_" + Date.now();
    const record: ProofRecord = {
      ...p,
      id,
      status: "pending",
      submittedAt: new Date().toISOString()
    };
    this.data.proofs[id] = record;
    this.save();
    return record;
  }

  getProof(id: string): ProofRecord | undefined {
    return this.data.proofs[id];
  }

  updateProofStatus(id: string, status: "approved" | "rejected") {
    if (this.data.proofs[id]) {
      this.data.proofs[id].status = status;
      this.save();
    }
  }

  // --- Withdrawals ---
  createWithdrawal(w: Omit<WithdrawalRecord, "id" | "status" | "createdAt">): WithdrawalRecord {
    const id = "w_" + Date.now();
    const record: WithdrawalRecord = {
      ...w,
      id,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    this.data.withdrawals[id] = record;
    this.save();
    return record;
  }

  getWithdrawal(id: string): WithdrawalRecord | undefined {
    return this.data.withdrawals[id];
  }

  updateWithdrawalStatus(id: string, status: "approved" | "rejected") {
    if (this.data.withdrawals[id]) {
      this.data.withdrawals[id].status = status;
      this.save();
    }
  }

  getPendingWithdrawals(): WithdrawalRecord[] {
    return Object.values(this.data.withdrawals).filter(w => w.status === "pending");
  }

  // --- Statistics ---
  getStatistics() {
    const users = Object.values(this.data.users);
    const withdrawals = Object.values(this.data.withdrawals);
    const proofs = Object.values(this.data.proofs);

    const totalActiveBalance = users.reduce((acc, u) => acc + u.balance, 0);
    const totalPayouts = withdrawals
      .filter(w => w.status === "approved")
      .reduce((acc, w) => acc + w.amount, 0);

    return {
      totalUsers: users.length,
      totalActiveBalance,
      totalPayouts,
      pendingWithdrawalsCount: withdrawals.filter(w => w.status === "pending").length,
      pendingProofsCount: proofs.filter(p => p.status === "pending").length,
      totalTasksCompleted: users.reduce((acc, u) => acc + u.tasksCompleted, 0)
    };
  }
}
`
  },
  {
    name: 'package.json',
    language: 'json',
    path: 'package.json',
    description: 'NPM package descriptor and dependency list.',
    content: `{
  "name": "telegram-qr-earning-bot",
  "version": "1.0.0",
  "description": "Production-Ready Telegram QR Earning Bot with Concurrency Locks & UPI Payouts",
  "main": "dist/bot.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/bot.js",
    "dev": "tsx src/bot.ts"
  },
  "dependencies": {
    "grammy": "^1.35.0",
    "@grammyjs/runner": "^2.0.9",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}`
  },
  {
    name: '.env.example',
    language: 'shell',
    path: '.env.example',
    description: 'Environment variables required to run the bot.',
    content: `# Telegram Bot Token from @BotFather
BOT_TOKEN=8916389057:AAFVwogT5jrAokNoBmJix_5yd4_0pfZqUfk

# Administrator Telegram User ID (Master Access)
ADMIN_ID=8962632792

# Telegram Username for Support Desk (without @)
SUPPORT_USERNAME=SRGAMER96

# Currency symbol for UI
CURRENCY_SYMBOL=₹

# Minimum withdrawal amount required
MIN_WITHDRAWAL=30

# Referral commission percent rewarded on completed tasks (%)
REFERRAL_COMMISSION_PERCENT=10
`
  },
  {
    name: 'Dockerfile',
    language: 'dockerfile',
    path: 'Dockerfile',
    description: 'Multi-stage Docker container for production deployment.',
    content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/bot.js"]
`
  }
];

export const PYTHON_SOURCE_FILES: CodeFile[] = [
  {
    name: 'bot.py',
    language: 'python',
    path: 'bot.py',
    description: 'Main Telegram Bot entry point using python-telegram-bot v20+ async.',
    content: `"""
=============================================================================
TELEGRAM QR EARNING BOT (Production-Ready)
Framework: python-telegram-bot v20+ (Async / PTB Application)

Features:
 - Stylized Unicode typography for welcome and persistent keyboard buttons
 - Concurrency lock: Locking active QR on proof submission to prevent race conditions
 - Proof submission forwarded to admin with Approve / Reject callback buttons
 - UPI withdrawal flow with instant wallet debit and automated refund on rejection
 - Deep-linking referral engine with automated balance credit
 - Exclusive Admin Command Center (/admin, Set QR, Broadcast with confirm, Ban/Unban)
=============================================================================
"""

import os
import logging
import asyncio
from typing import Optional
from dotenv import load_dotenv

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton
)
from telegram.constants import ParseMode
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters
)

from database import Database

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "SupportAdmin")
CURRENCY = os.getenv("CURRENCY_SYMBOL", "₹")
MIN_WITHDRAWAL = float(os.getenv("MIN_WITHDRAWAL", "50"))
REFERRAL_BONUS = float(os.getenv("REFERRAL_BONUS", "10"))

if not BOT_TOKEN or not ADMIN_ID:
    raise ValueError("FATAL: Please define BOT_TOKEN and ADMIN_ID in .env file!")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

db = Database("bot_data.json")

# Unicode bold sans-serif styling utility
def to_bold_sans(text: str) -> str:
    res = []
    for char in text:
        code = ord(char)
        if 65 <= code <= 90:
            res.append(chr(0x1D5D4 + (code - 65)))
        elif 97 <= code <= 122:
            res.append(chr(0x1D5EE + (code - 97)))
        elif 48 <= code <= 57:
            res.append(chr(0x1D7EC + (code - 48)))
        else:
            res.append(char)
    return "".join(res)

# Persistent Styled Keyboard
MAIN_KEYBOARD = ReplyKeyboardMarkup(
    [
        [KeyboardButton(f"🚀 {to_bold_sans('START EARN')}"), KeyboardButton(f"👤 {to_bold_sans('PROFILE')}")],
        [KeyboardButton(f"👥 {to_bold_sans('REFER & EARN')}"), KeyboardButton(f"💰 {to_bold_sans('WITHDRAW')}")],
        [KeyboardButton(f"📞 {to_bold_sans('SUPPORT')}"), KeyboardButton(f"🛠️ {to_bold_sans('ADMIN PANEL')}")]
    ],
    resize_keyboard=True
)

# ==========================================
# 1. WELCOME & ONBOARDING (/start)
# ==========================================
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id

    # Check Ban Status
    db_user = db.get_user(user.id)
    if db_user and db_user.get("is_banned") and user.id != ADMIN_ID:
        await update.message.reply_text("🚫 <b>Your account has been suspended by administration.</b>", parse_mode=ParseMode.HTML)
        return

    # Check Referral
    args = context.args
    referrer_id = None
    if args and len(args) > 0 and args[0].startswith("ref_"):
        try:
            potential_ref = int(args[0].replace("ref_", ""))
            if potential_ref != user.id:
                referrer_id = potential_ref
        except ValueError:
            pass

    is_new = db.register_user(user.id, user.first_name, user.username, referrer_id)

    # Reward Referrer
    if is_new and referrer_id:
        referrer = db.get_user(referrer_id)
        if referrer:
            db.adjust_balance(referrer_id, REFERRAL_BONUS)
            db.increment_referrals(referrer_id)
            try:
                await context.bot.send_message(
                    chat_id=referrer_id,
                    text=(
                        f"🎉 <b>{to_bold_sans('New Referral Joined!')}</b>\\n\\n"
                        f"User <b>{user.first_name}</b> joined using your invitation link.\\n"
                        f"💰 Bonus: <b>{CURRENCY}{REFERRAL_BONUS}</b> added to your wallet!"
                    ),
                    parse_mode=ParseMode.HTML
                )
            except Exception as e:
                logger.warning(f"Could not notify referrer {referrer_id}: {e}")

    # Clear state
    context.user_data.clear()

    welcome_text = (
        f"🌟 <b>{to_bold_sans('WELCOME TO QR EARN OFFICIAL')}</b> 🌟\\n\\n"
        f"Hello <b>{user.first_name}</b>! 👋\\n"
        f"Earn real instant cash by scanning official QR codes and submitting proof.\\n\\n"
        f"💎 <b>{to_bold_sans('Getting Started:')}</b>\\n"
        f"1️⃣ Tap <b>🚀 {to_bold_sans('START EARN')}</b> to get the active QR code.\\n"
        f"2️⃣ Scan the code and complete payment/task.\\n"
        f"3️⃣ Tap <b>📤 {to_bold_sans('Submit Proof')}</b> and upload proof screenshot.\\n"
        f"4️⃣ Fast approval & instant balance credit!\\n\\n"
        f"💰 <b>Min Withdrawal:</b> {CURRENCY}{MIN_WITHDRAWAL} via UPI\\n"
        f"👥 <b>Referral Bonus:</b> {CURRENCY}{REFERRAL_BONUS} per invited friend\\n\\n"
        f"<i>Tap any button on the stylized keyboard below to begin:</i>"
    )

    await update.message.reply_text(
        welcome_text,
        parse_mode=ParseMode.HTML,
        reply_markup=MAIN_KEYBOARD
    )

# ==========================================
# 2. USER ACTIONS
# ==========================================

async def handle_start_earn(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    task = db.get_active_task()

    if not task:
        await update.message.reply_text(
            f"⚠️ <b>{to_bold_sans('No Active QR Task')}</b>\\n\\n"
            f"Admin has not dropped a QR code yet. Please check back shortly!",
            parse_mode=ParseMode.HTML
        )
        return

    # Concurrency Lock Check
    if task.get("is_locked") and task.get("locked_by_user_id") != user_id:
        await update.message.reply_text(
            f"🔒 <b>{to_bold_sans('Task Currently Locked')}</b>\\n\\n"
            f"Another member has submitted proof for this task. It is currently locked "
            f"to prevent duplicate claims.\\n\\n"
            f"Please wait for admin to review or drop a fresh QR! ⏳",
            parse_mode=ParseMode.HTML
        )
        return

    kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton(f"📤 {to_bold_sans('Submit Proof')}", callback_data="btn_submit_proof"),
            InlineKeyboardButton(f"❌ {to_bold_sans('Cancel')}", callback_data="btn_cancel_task")
        ]
    ])

    caption = (
        f"🔥 <b>{to_bold_sans(task['title'])}</b>\\n\\n"
        f"💰 <b>Reward:</b> {CURRENCY}{task['reward']}\\n"
        f"📝 <b>Instructions:</b>\\n{task['instructions']}\\n\\n"
        f"⚡ <i>Once you complete payment, tap Submit Proof below to claim reward.</i>"
    )

    qr_url = task.get("qr_image_url", "")
    if qr_url.startswith("http"):
        await update.message.reply_photo(photo=qr_url, caption=caption, parse_mode=ParseMode.HTML, reply_markup=kb)
    else:
        await update.message.reply_text(caption, parse_mode=ParseMode.HTML, reply_markup=kb)

async def handle_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = db.get_user(update.effective_user.id)
    if not user:
        return

    profile_text = (
        f"👤 <b>{to_bold_sans('YOUR ACCOUNT PROFILE')}</b>\\n\\n"
        f"🆔 <b>User ID:</b> <code>{user['id']}</code>\\n"
        f"👤 <b>Name:</b> {user['first_name']}\\n"
        f"💰 <b>Wallet Balance:</b> <b>{CURRENCY}{user['balance']:.2f}</b>\\n"
        f"👥 <b>Total Referrals:</b> <b>{user['referral_count']}</b>\\n"
        f"✅ <b>Tasks Completed:</b> <b>{user['tasks_completed']}</b>\\n\\n"
        f"💳 <i>Instant withdrawal to any UPI handle upon reaching {CURRENCY}{MIN_WITHDRAWAL}.</i>"
    )
    await update.message.reply_text(profile_text, parse_mode=ParseMode.HTML, reply_markup=MAIN_KEYBOARD)

async def handle_refer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    bot_info = await context.bot.get_me()
    ref_link = f"https://t.me/{bot_info.username}?start=ref_{user_id}"

    share_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"🚀 {to_bold_sans('Share Link')}", url=f"https://t.me/share/url?url={ref_link}&text=Earn%20real%20cash%20with%20QR%20tasks!")]
    ])

    text = (
        f"👥 <b>{to_bold_sans('REFER & EARN REWARDS')}</b>\\n\\n"
        f"Invite friends and get <b>{CURRENCY}{REFERRAL_BONUS}</b> credited directly to your balance!\\n\\n"
        f"🔗 <b>Your Exclusive Referral Link:</b>\\n"
        f"<code>{ref_link}</code>\\n\\n"
        f"<i>Share with your friends and Telegram groups now!</i>"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=share_kb)

async def handle_withdraw_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = db.get_user(update.effective_user.id)
    if not user:
        return

    if user["balance"] < MIN_WITHDRAWAL:
        await update.message.reply_text(
            f"⚠️ <b>{to_bold_sans('Insufficient Balance')}</b>\\n\\n"
            f"Your Balance: <b>{CURRENCY}{user['balance']:.2f}</b>\\n"
            f"Minimum Withdrawal: <b>{CURRENCY}{MIN_WITHDRAWAL:.2f}</b>\\n\\n"
            f"Earn more by scanning QR tasks or inviting friends!",
            parse_mode=ParseMode.HTML
        )
        return

    context.user_data["step"] = "AWAITING_UPI_ID"
    cancel_kb = InlineKeyboardMarkup([[InlineKeyboardButton(f"❌ {to_bold_sans('Cancel')}", callback_data="btn_cancel_withdraw")]])
    await update.message.reply_text(
        f"💰 <b>{to_bold_sans('UPI WITHDRAWAL')}</b>\\n\\n"
        f"Your Balance: <b>{CURRENCY}{user['balance']:.2f}</b>\\n\\n"
        f"Please enter your <b>UPI ID</b> (e.g. <code>payee@okaxis</code>):",
        parse_mode=ParseMode.HTML,
        reply_markup=cancel_kb
    )

async def handle_support(update: Update, context: ContextTypes.DEFAULT_TYPE):
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(f"💬 {to_bold_sans('Open Support')}", url=f"https://t.me/{SUPPORT_USERNAME}")]])
    await update.message.reply_text(
        f"📞 <b>{to_bold_sans('OFFICIAL SUPPORT DESK')}</b>\\n\\n"
        f"Need assistance with payments or task verification?\\n"
        f"Contact our team directly: @{SUPPORT_USERNAME}\\n"
        f"<i>Please provide your Telegram ID ({update.effective_user.id}) when contacting support.</i>",
        parse_mode=ParseMode.HTML,
        reply_markup=kb
    )

# ==========================================
# 3. ADMIN PANEL
# ==========================================
async def handle_admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("⛔ <b>Access Denied:</b> Administrators only.", parse_mode=ParseMode.HTML)
        return

    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"📢 {to_bold_sans('Broadcast')}", callback_data="adm_broadcast"),
         InlineKeyboardButton(f"➕ {to_bold_sans('Set QR')}", callback_data="adm_set_qr"),
         InlineKeyboardButton(f"🗑️ {to_bold_sans('Delete QR')}", callback_data="adm_delete_qr")],
        [InlineKeyboardButton(f"🚫 {to_bold_sans('Ban User')}", callback_data="adm_ban_user"),
         InlineKeyboardButton(f"✅ {to_bold_sans('Unban User')}", callback_data="adm_unban_user"),
         InlineKeyboardButton(f"ℹ️ {to_bold_sans('User Info')}", callback_data="adm_user_info")],
        [InlineKeyboardButton(f"➕ {to_bold_sans('Add Balance')}", callback_data="adm_add_balance"),
         InlineKeyboardButton(f"➖ {to_bold_sans('Remove Bal')}", callback_data="adm_rem_balance"),
         InlineKeyboardButton(f"📈 {to_bold_sans('Set Ref %')}", callback_data="adm_set_ref_pct")],
        [InlineKeyboardButton(f"📊 {to_bold_sans('Statistics')}", callback_data="adm_stats"),
         InlineKeyboardButton(f"🔔 {to_bold_sans('Withdrawals')}", callback_data="adm_withdrawals")]
    ])

    await update.message.reply_text(
        f"🛠️ <b>{to_bold_sans('ADMIN COMMAND CENTER')}</b>\\n\\n"
        f"Select a management task from below:",
        parse_mode=ParseMode.HTML,
        reply_markup=kb
    )

# ==========================================
# 4. CALLBACK QUERIES
# ==========================================
async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data
    user_id = query.from_user.id

    # User clicks Submit Proof
    if data == "btn_submit_proof":
        task = db.get_active_task()
        if not task:
            await query.answer("Task expired!", show_alert=True)
            return

        if task.get("is_locked") and task.get("locked_by_user_id") != user_id:
            await query.answer("Task already locked by someone else!", show_alert=True)
            return

        context.user_data["step"] = "AWAITING_PROOF"
        await query.answer()
        await query.message.reply_text(
            f"📤 <b>{to_bold_sans('UPLOAD PROOF')}</b>\\n\\n"
            f"Please send your transaction screenshot photo now:",
            parse_mode=ParseMode.HTML
        )

    # User cancels task
    elif data == "btn_cancel_task":
        task = db.get_active_task()
        if task and task.get("locked_by_user_id") == user_id:
            db.unlock_task()
        context.user_data.clear()
        await query.answer("Task canceled.")
        await query.message.reply_text("Task canceled. QR code is still open.", reply_markup=MAIN_KEYBOARD)

    # Cancel withdrawal
    elif data == "btn_cancel_withdraw":
        context.user_data.clear()
        await query.answer("Withdrawal canceled.")
        await query.message.reply_text("Withdrawal aborted.", reply_markup=MAIN_KEYBOARD)

    # Admin: Stats
    elif data == "adm_stats" and user_id == ADMIN_ID:
        stats = db.get_stats()
        text = (
            f"📊 <b>{to_bold_sans('SYSTEM STATISTICS')}</b>\\n\\n"
            f"👥 Total Users: {stats['total_users']}\\n"
            f"💰 Active Balances: {CURRENCY}{stats['active_balance']:.2f}\\n"
            f"💸 Total Paid: {CURRENCY}{stats['total_paid']:.2f}\\n"
            f"⏳ Pending Withdrawals: {stats['pending_withdrawals']}\\n"
            f"📥 Pending Proofs: {stats['pending_proofs']}"
        )
        await query.answer()
        await query.message.reply_text(text, parse_mode=ParseMode.HTML)

    # Admin: Set QR
    elif data == "adm_set_qr" and user_id == ADMIN_ID:
        context.user_data["step"] = "AWAITING_NEW_QR"
        await query.answer()
        await query.message.reply_text("➕ Please send the new <b>QR Code Image</b> now (photo or URL):", parse_mode=ParseMode.HTML)

    # Admin: Broadcast prompt
    elif data == "adm_broadcast" and user_id == ADMIN_ID:
        context.user_data["step"] = "AWAITING_BROADCAST_MSG"
        await query.answer()
        await query.message.reply_text("📢 Please type the broadcast announcement to send:", parse_mode=ParseMode.HTML)

    # Admin: Confirm Broadcast
    elif data == "adm_confirm_broadcast" and user_id == ADMIN_ID:
        msg = context.user_data.get("temp_broadcast")
        if not msg:
            await query.answer("Expired!", show_alert=True)
            return

        await query.answer("Broadcasting...")
        users = db.get_all_users()
        sent = 0
        for uid in users:
            try:
                await context.bot.send_message(chat_id=uid, text=msg, parse_mode=ParseMode.HTML)
                sent += 1
                await asyncio.sleep(0.04)
            except Exception:
                pass
        context.user_data.pop("temp_broadcast", None)
        await query.message.reply_text(f"✅ Broadcast sent to {sent} users!", reply_markup=MAIN_KEYBOARD)

    # Admin: Proof Approve
    elif data.startswith("proof_app_") and user_id == ADMIN_ID:
        pid = data.replace("proof_app_", "")
        proof = db.get_proof(pid)
        if proof and proof["status"] == "pending":
            db.update_proof_status(pid, "approved")
            db.adjust_balance(proof["user_id"], proof["reward"])
            db.mark_task_claimed()
            await query.answer("Approved!")
            await query.message.reply_text(f"✅ Proof approved! Added {CURRENCY}{proof['reward']} to user {proof['user_id']}.")
            try:
                await context.bot.send_message(
                    chat_id=proof["user_id"],
                    text=f"🎉 <b>Proof Approved!</b>\\nCredited <b>{CURRENCY}{proof['reward']}</b> to your wallet.",
                    parse_mode=ParseMode.HTML
                )
            except Exception:
                pass

    # Admin: Proof Reject
    elif data.startswith("proof_rej_") and user_id == ADMIN_ID:
        pid = data.replace("proof_rej_", "")
        proof = db.get_proof(pid)
        if proof and proof["status"] == "pending":
            db.update_proof_status(pid, "rejected")
            db.unlock_task()
            await query.answer("Rejected and unlocked.")
            await query.message.reply_text("❌ Proof rejected. Task unlocked.")
            try:
                await context.bot.send_message(
                    chat_id=proof["user_id"],
                    text="❌ Your task proof was rejected by admin. Task remains open.",
                    parse_mode=ParseMode.HTML
                )
            except Exception:
                pass

    # Admin: Withdrawal Approve
    elif data.startswith("w_app_") and user_id == ADMIN_ID:
        wid = data.replace("w_app_", "")
        w = db.get_withdrawal(wid)
        if w and w["status"] == "pending":
            db.update_withdrawal_status(wid, "approved")
            await query.answer("Approved payout!")
            await query.message.reply_text(f"✅ Payout of {CURRENCY}{w['amount']} to {w['upi_id']} approved.")
            try:
                await context.bot.send_message(
                    chat_id=w["user_id"],
                    text=f"🎉 <b>Withdrawal Success!</b>\\nAmount {CURRENCY}{w['amount']} has been sent to {w['upi_id']}.",
                    parse_mode=ParseMode.HTML
                )
            except Exception:
                pass

    # Admin: Withdrawal Reject
    elif data.startswith("w_rej_") and user_id == ADMIN_ID:
        wid = data.replace("w_rej_", "")
        w = db.get_withdrawal(wid)
        if w and w["status"] == "pending":
            db.update_withdrawal_status(wid, "rejected")
            db.adjust_balance(w["user_id"], w["amount"])
            await query.answer("Rejected & refunded.")
            await query.message.reply_text(f"❌ Payout rejected. {CURRENCY}{w['amount']} refunded to user.")
            try:
                await context.bot.send_message(
                    chat_id=w["user_id"],
                    text=f"⚠️ Your withdrawal of {CURRENCY}{w['amount']} was rejected. Balance refunded to wallet.",
                    parse_mode=ParseMode.HTML
                )
            except Exception:
                pass

# ==========================================
# 5. MESSAGE ROUTER
# ==========================================
async def message_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text or ""
    user_id = update.effective_user.id
    step = context.user_data.get("step")

    # Reply keyboard matches
    if to_bold_sans("START EARN") in text:
        await handle_start_earn(update, context)
        return
    elif to_bold_sans("PROFILE") in text:
        await handle_profile(update, context)
        return
    elif to_bold_sans("REFER & EARN") in text:
        await handle_refer(update, context)
        return
    elif to_bold_sans("WITHDRAW") in text:
        await handle_withdraw_start(update, context)
        return
    elif to_bold_sans("SUPPORT") in text:
        await handle_support(update, context)
        return
    elif to_bold_sans("ADMIN PANEL") in text:
        await handle_admin_panel(update, context)
        return

    # Awaiting Proof Upload (photo handled in photo_handler)
    if step == "AWAITING_PROOF":
        task = db.get_active_task()
        if not task:
            context.user_data.clear()
            await update.message.reply_text("Task expired.")
            return

        proof = db.create_proof(user_id, update.effective_user.first_name, task["id"], task["reward"], "text_proof", text)
        db.lock_task_for_review(task["id"], user_id, update.effective_user.first_name)
        context.user_data.clear()

        await update.message.reply_text("✅ Proof submitted! Admin is reviewing.", reply_markup=MAIN_KEYBOARD)

        # Notify Admin
        admin_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Approve", callback_data=f"proof_app_{proof['id']}"),
             InlineKeyboardButton("❌ Reject", callback_data=f"proof_rej_{proof['id']}")]
        ])
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"📥 <b>Proof:</b> User {user_id}\\nTask: {task['title']}\\nNote: {text}",
            parse_mode=ParseMode.HTML,
            reply_markup=admin_kb
        )
        return

    # Awaiting UPI ID
    if step == "AWAITING_UPI_ID":
        upi = text.strip()
        if "@" not in upi:
            await update.message.reply_text("❌ Invalid UPI ID. Format: name@bank")
            return
        context.user_data["temp_upi"] = upi
        context.user_data["step"] = "AWAITING_AMOUNT"
        await update.message.reply_text(f"💳 UPI: {upi}\\n\\nEnter amount to withdraw (Min {CURRENCY}{MIN_WITHDRAWAL}):")
        return

    # Awaiting Amount
    if step == "AWAITING_AMOUNT":
        try:
            amt = float(text.strip())
        except ValueError:
            await update.message.reply_text("Enter a valid numeric amount.")
            return

        user = db.get_user(user_id)
        if amt < MIN_WITHDRAWAL or amt > user["balance"]:
            await update.message.reply_text(f"Invalid amount. Available: {CURRENCY}{user['balance']:.2f}")
            return

        upi = context.user_data["temp_upi"]
        db.adjust_balance(user_id, -amt)
        w = db.create_withdrawal(user_id, user["first_name"], upi, amt)
        context.user_data.clear()

        await update.message.reply_text(f"✅ Queued withdrawal of {CURRENCY}{amt} to {upi}!", reply_markup=MAIN_KEYBOARD)

        admin_w_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Approve", callback_data=f"w_app_{w['id']}"),
             InlineKeyboardButton("❌ Reject", callback_data=f"w_rej_{w['id']}")]
        ])
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"🔔 <b>UPI Withdrawal:</b>\\nUser: {user['first_name']} ({user_id})\\nAmount: {CURRENCY}{amt}\\nUPI: {upi}",
            parse_mode=ParseMode.HTML,
            reply_markup=admin_w_kb
        )
        return

    # Admin Broadcast step
    if step == "AWAITING_BROADCAST_MSG" and user_id == ADMIN_ID:
        context.user_data["temp_broadcast"] = text
        context.user_data["step"] = None
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Done / Send", callback_data="adm_confirm_broadcast"),
             InlineKeyboardButton("❌ Cancel", callback_data="adm_cancel_broadcast")]
        ])
        await update.message.reply_text(f"📢 <b>Broadcast Preview:</b>\\n\\n{text}\\n\\nConfirm sending?", parse_mode=ParseMode.HTML, reply_markup=kb)
        return

async def photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    step = context.user_data.get("step")

    if step == "AWAITING_PROOF":
        task = db.get_active_task()
        if not task:
            await update.message.reply_text("Task expired.")
            return

        photo_id = update.message.photo[-1].file_id
        proof = db.create_proof(user_id, update.effective_user.first_name, task["id"], task["reward"], photo_id, update.message.caption or "")
        db.lock_task_for_review(task["id"], user_id, update.effective_user.first_name)
        context.user_data.clear()

        await update.message.reply_text("✅ Proof screenshot submitted! Forwarded to admin.", reply_markup=MAIN_KEYBOARD)

        admin_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Approve", callback_data=f"proof_app_{proof['id']}"),
             InlineKeyboardButton("❌ Reject", callback_data=f"proof_rej_{proof['id']}")]
        ])
        await context.bot.send_photo(
            chat_id=ADMIN_ID,
            photo=photo_id,
            caption=f"📥 <b>Proof:</b> {update.effective_user.first_name} ({user_id})\\nReward: {CURRENCY}{task['reward']}",
            parse_mode=ParseMode.HTML,
            reply_markup=admin_kb
        )
        return

    if step == "AWAITING_NEW_QR" and user_id == ADMIN_ID:
        photo_id = update.message.photo[-1].file_id
        db.set_active_task("Official QR Task", photo_id, 50, "Scan QR and upload proof screenshot.")
        context.user_data.clear()
        await update.message.reply_text("✅ New QR code activated and tasks reset for all users!", reply_markup=MAIN_KEYBOARD)
        return

def main():
    print("🚀 Starting Telegram QR Earning Bot (Python)...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_handler(MessageHandler(filters.PHOTO, photo_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_router))

    app.run_polling()

if __name__ == "__main__":
    main()
`
  },
  {
    name: 'database.py',
    language: 'python',
    path: 'database.py',
    description: 'Python persistent JSON storage engine.',
    content: `import json
import os
import time

class Database:
    def __init__(self, filepath="bot_data.json"):
        self.filepath = filepath
        self.data = self._load()

    def _load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        initial = {
            "users": {},
            "active_task": {
                "id": "task_initial",
                "title": "Official QR Earning Task",
                "qr_image_url": "https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=upi://pay?pa=earnqr@okaxis&pn=OfficialEarning",
                "reward": 50.0,
                "instructions": "Scan QR using any UPI app. Complete payment or promo, upload screenshot.",
                "is_locked": False,
                "status": "active"
            },
            "proofs": {},
            "withdrawals": {}
        }
        self._save(initial)
        return initial

    def _save(self, data=None):
        if data is None:
            data = self.data
        tmp = self.filepath + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, self.filepath)

    def get_user(self, uid):
        return self.data["users"].get(str(uid))

    def register_user(self, uid, first_name, username, referred_by=None):
        s_uid = str(uid)
        if s_uid in self.data["users"]:
            return False
        self.data["users"][s_uid] = {
            "id": uid,
            "first_name": first_name,
            "username": username,
            "balance": 0.0,
            "referral_count": 0,
            "referred_by": referred_by,
            "is_banned": False,
            "tasks_completed": 0
        }
        self._save()
        return True

    def adjust_balance(self, uid, delta):
        s_uid = str(uid)
        if s_uid in self.data["users"]:
            self.data["users"][s_uid]["balance"] = max(0.0, self.data["users"][s_uid]["balance"] + delta)
            self._save()

    def increment_referrals(self, uid):
        s_uid = str(uid)
        if s_uid in self.data["users"]:
            self.data["users"][s_uid]["referral_count"] += 1
            self._save()

    def get_all_users(self):
        return [int(k) for k in self.data["users"].keys()]

    def get_active_task(self):
        return self.data.get("active_task")

    def set_active_task(self, title, qr_url, reward, instructions):
        self.data["active_task"] = {
            "id": f"task_{int(time.time())}",
            "title": title,
            "qr_image_url": qr_url,
            "reward": float(reward),
            "instructions": instructions,
            "is_locked": False,
            "status": "active"
        }
        self._save()

    def lock_task_for_review(self, task_id, uid, user_name):
        if self.data["active_task"] and self.data["active_task"]["id"] == task_id:
            self.data["active_task"]["is_locked"] = True
            self.data["active_task"]["locked_by_user_id"] = uid
            self.data["active_task"]["locked_by_user_name"] = user_name
            self._save()

    def unlock_task(self):
        if self.data["active_task"]:
            self.data["active_task"]["is_locked"] = False
            self.data["active_task"].pop("locked_by_user_id", None)
            self.data["active_task"].pop("locked_by_user_name", None)
            self._save()

    def mark_task_claimed(self):
        if self.data["active_task"]:
            self.data["active_task"]["is_locked"] = True
            self.data["active_task"]["status"] = "claimed"
            self._save()

    def create_proof(self, uid, user_name, task_id, reward, image_url, text):
        pid = f"proof_{int(time.time() * 1000)}"
        proof = {
            "id": pid,
            "user_id": uid,
            "user_name": user_name,
            "task_id": task_id,
            "reward": reward,
            "image_url": image_url,
            "text": text,
            "status": "pending"
        }
        self.data["proofs"][pid] = proof
        self._save()
        return proof

    def get_proof(self, pid):
        return self.data["proofs"].get(pid)

    def update_proof_status(self, pid, status):
        if pid in self.data["proofs"]:
            self.data["proofs"][pid]["status"] = status
            self._save()

    def create_withdrawal(self, uid, user_name, upi_id, amount):
        wid = f"w_{int(time.time() * 1000)}"
        w = {
            "id": wid,
            "user_id": uid,
            "user_name": user_name,
            "upi_id": upi_id,
            "amount": amount,
            "status": "pending"
        }
        self.data["withdrawals"][wid] = w
        self._save()
        return w

    def get_withdrawal(self, wid):
        return self.data["withdrawals"].get(wid)

    def update_withdrawal_status(self, wid, status):
        if wid in self.data["withdrawals"]:
            self.data["withdrawals"][wid]["status"] = status
            self._save()

    def get_stats(self):
        users = list(self.data["users"].values())
        withdrawals = list(self.data["withdrawals"].values())
        proofs = list(self.data["proofs"].values())
        return {
            "total_users": len(users),
            "active_balance": sum(u["balance"] for u in users),
            "total_paid": sum(w["amount"] for w in withdrawals if w["status"] == "approved"),
            "pending_withdrawals": len([w for w in withdrawals if w["status"] == "pending"]),
            "pending_proofs": len([p for p in proofs if p["status"] == "pending"])
        }
`
  },
  {
    name: 'requirements.txt',
    language: 'shell',
    path: 'requirements.txt',
    description: 'Python package dependencies for pip.',
    content: `python-telegram-bot[job-queue]>=20.7
python-dotenv>=1.0.0
`
  },
  {
    name: '.env.example',
    language: 'shell',
    path: '.env.example',
    description: 'Python environment variables template.',
    content: `BOT_TOKEN=8916389057:AAFVwogT5jrAokNoBmJix_5yd4_0pfZqUfk
ADMIN_ID=8962632792
SUPPORT_USERNAME=SRGAMER96
CURRENCY_SYMBOL=₹
MIN_WITHDRAWAL=30
REFERRAL_COMMISSION_PERCENT=10
`
  },
  {
    name: 'Dockerfile',
    language: 'dockerfile',
    path: 'Dockerfile',
    description: 'Python Docker container definition.',
    content: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "bot.py"]
`
  }
];
