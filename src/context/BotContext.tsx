import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  BotConfig,
  ChatMessage,
  ProofSubmission,
  QRTask,
  TelegramUser,
  WithdrawalRequest,
  ActivePersona,
  ViewTab,
  InlineButton
} from '../types/bot';
import {
  INITIAL_CONFIG,
  INITIAL_USERS,
  INITIAL_ACTIVE_TASK,
  INITIAL_PROOFS,
  INITIAL_WITHDRAWALS,
  INITIAL_CHAT_MESSAGES
} from '../data/mockInitialState';
import { BOT_KEYBOARD_BUTTONS, toBoldSans } from '../utils/unicodeFonts';

interface BotContextType {
  config: BotConfig;
  updateConfig: (newConfig: Partial<BotConfig>) => void;
  users: Record<number, TelegramUser>;
  activePersona: ActivePersona;
  setActivePersona: (p: ActivePersona) => void;
  currentUser: TelegramUser;
  activeTask: QRTask | null;
  proofs: ProofSubmission[];
  withdrawals: WithdrawalRequest[];
  messages: ChatMessage[];
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;

  // Actions
  sendMessage: (text: string, photoUrl?: string) => void;
  handleCallbackQuery: (callbackData: string) => void;
  submitProof: (taskId: string, image: string, textNote?: string) => void;
  cancelTask: () => void;
  requestWithdrawal: (upiId: string, amount: number) => { success: boolean; error?: string };
  approveProof: (proofId: string) => void;
  rejectProof: (proofId: string, reason?: string) => void;
  approveWithdrawal: (withdrawalId: string) => void;
  rejectWithdrawal: (withdrawalId: string, reason?: string) => void;
  setNewQRTask: (title: string, qrImageUrl: string, reward: number, instructions: string) => void;
  deleteQRTask: () => void;
  broadcastMessage: (text: string) => { delivered: number; failed: number };
  toggleBanUser: (userId: number, forceStatus?: boolean) => void;
  deleteUser: (userId: number) => boolean;
  addBalanceToUser: (userId: number, amount: number) => { success: boolean; newBalance?: number };
  removeBalanceFromUser: (userId: number, amount: number) => { success: boolean; newBalance?: number };
  setReferralCommissionPercent: (pct: number) => void;
  getUserInfo: (userId: number) => TelegramUser | undefined;
  resetAllData: () => void;
}

const BotContext = createContext<BotContextType | null>(null);

const STORAGE_KEY = 'telegram_qr_earning_bot_state_v2';

export const BotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BotConfig>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_config`);
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });

  const [users, setUsers] = useState<Record<number, TelegramUser>>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_users`);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [activePersona, setActivePersona] = useState<ActivePersona>('user_1');
  const [currentTab, setCurrentTab] = useState<ViewTab>('simulator');

  const [activeTask, setActiveTask] = useState<QRTask | null>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_task`);
    return saved ? JSON.parse(saved) : INITIAL_ACTIVE_TASK;
  });

  const [proofs, setProofs] = useState<ProofSubmission[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_proofs`);
    return saved ? JSON.parse(saved) : INITIAL_PROOFS;
  });

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_withdrawals`);
    return saved ? JSON.parse(saved) : INITIAL_WITHDRAWALS;
  });

  const [chatHistory, setChatHistory] = useState<Record<number, ChatMessage[]>>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_chats`);
    return saved ? JSON.parse(saved) : INITIAL_CHAT_MESSAGES;
  });

  const [userSteps, setUserSteps] = useState<Record<number, { step: string; payload?: any }>>({});

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_config`, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_task`, JSON.stringify(activeTask));
  }, [activeTask]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_proofs`, JSON.stringify(proofs));
  }, [proofs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_withdrawals`, JSON.stringify(withdrawals));
  }, [withdrawals]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_chats`, JSON.stringify(chatHistory));
  }, [chatHistory]);

  const personaIdMap: Record<ActivePersona, number> = {
    user_1: 5829104,
    user_2: 9840212,
    admin: 8962632792
  };

  const currentUserId = personaIdMap[activePersona];
  const currentUser = users[currentUserId] || INITIAL_USERS[5829104];
  const currentMessages = chatHistory[currentUserId] || [];

  const updateConfig = (newConfig: Partial<BotConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const appendMessage = (userId: number, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => ({
      ...prev,
      [userId]: [...(prev[userId] || []), newMsg]
    }));
  };

  const getStandardReplyKeyboard = (isAdmin: boolean) => {
    if (isAdmin) {
      return [
        [BOT_KEYBOARD_BUTTONS.START_EARN, BOT_KEYBOARD_BUTTONS.PROFILE],
        [BOT_KEYBOARD_BUTTONS.REFER_EARN, BOT_KEYBOARD_BUTTONS.WITHDRAW],
        [BOT_KEYBOARD_BUTTONS.SUPPORT, BOT_KEYBOARD_BUTTONS.ADMIN_PANEL]
      ];
    }
    return [
      [BOT_KEYBOARD_BUTTONS.START_EARN, BOT_KEYBOARD_BUTTONS.PROFILE],
      [BOT_KEYBOARD_BUTTONS.REFER_EARN, BOT_KEYBOARD_BUTTONS.WITHDRAW],
      [BOT_KEYBOARD_BUTTONS.SUPPORT]
    ];
  };

  const botReply = (userId: number, text: string, options?: {
    photoUrl?: string;
    inlineButtons?: InlineButton[][];
    replyKeyboard?: string[][];
  }) => {
    appendMessage(userId, {
      senderId: 0,
      senderName: config.botName,
      senderRole: 'bot',
      text,
      photoUrl: options?.photoUrl,
      inlineButtons: options?.inlineButtons,
      replyKeyboard: options?.replyKeyboard || getStandardReplyKeyboard(userId === config.adminId)
    });
  };

  const deleteQRTask = () => {
    setActiveTask(null);
    botReply(
      config.adminId,
      `🗑️ <b>${toBoldSans('Active QR Deleted!')}</b>\n\nThe current QR drop has been removed. Users clicking 'Start Earn' will be told no task is currently active until a new one is set.`
    );
  };

  const setReferralCommissionPercent = (pct: number) => {
    updateConfig({ referralCommissionPercent: pct });
    botReply(
      config.adminId,
      `✅ <b>Referral Commission Updated!</b>\n\nNew Rate: <b>${pct}%</b>\nReferrers will now receive ${pct}% commission whenever their referred users complete a task.`
    );
  };

  const addBalanceToUser = (targetId: number, amount: number) => {
    if (!users[targetId] || amount <= 0) return { success: false };

    let updatedBal = 0;
    setUsers(prev => {
      const u = prev[targetId];
      if (!u) return prev;
      updatedBal = u.balance + amount;
      return {
        ...prev,
        [targetId]: { ...u, balance: updatedBal }
      };
    });

    botReply(
      config.adminId,
      `✅ <b>Credited Balance!</b> Added ${config.currencySymbol}${amount.toFixed(2)} to User <code>${targetId}</code>.`
    );

    botReply(
      targetId,
      `🎉 <b>BALANCE CREDITED!</b>\n\nThe administrator added <b>${config.currencySymbol}${amount.toFixed(2)}</b> to your wallet!`
    );

    return { success: true, newBalance: updatedBal };
  };

  const removeBalanceFromUser = (targetId: number, amount: number) => {
    if (!users[targetId] || amount <= 0) return { success: false };

    let updatedBal = 0;
    setUsers(prev => {
      const u = prev[targetId];
      if (!u) return prev;
      updatedBal = Math.max(0, u.balance - amount);
      return {
        ...prev,
        [targetId]: { ...u, balance: updatedBal }
      };
    });

    botReply(
      config.adminId,
      `✅ <b>Debited Balance!</b> Deducted ${config.currencySymbol}${amount.toFixed(2)} from User <code>${targetId}</code>.`
    );

    botReply(
      targetId,
      `⚠️ <b>BALANCE ADJUSTMENT</b>\n\nThe administrator deducted <b>${config.currencySymbol}${amount.toFixed(2)}</b> from your wallet.`
    );

    return { success: true, newBalance: updatedBal };
  };

  const getUserInfo = (userId: number) => {
    return users[userId];
  };

  const toggleBanUser = (targetId: number, forceStatus?: boolean) => {
    setUsers(prev => {
      const u = prev[targetId];
      if (!u) return prev;
      const newStatus = forceStatus !== undefined ? forceStatus : !u.isBanned;
      return {
        ...prev,
        [targetId]: { ...u, isBanned: newStatus }
      };
    });

    fetch('/api/bot/users/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetId, isBanned: forceStatus })
    }).catch(() => {});
  };

  const deleteUser = (targetId: number): boolean => {
    if (targetId === config.adminId) return false;
    if (!users[targetId]) return false;

    setUsers(prev => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });

    botReply(
      config.adminId,
      `🗑️ <b>User Deleted!</b> User <code>${targetId}</code> has been completely removed from subscriber management.`
    );

    fetch('/api/bot/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetId })
    }).catch(() => {});

    return true;
  };

  // Dispatch interactive admin menu
  const sendAdminPanelMenu = (adminUserId: number) => {
    const adminButtons: InlineButton[][] = [
      [
        { text: `📢 ${toBoldSans('Broadcast')}`, callbackData: 'adm_broadcast' },
        { text: `➕ ${toBoldSans('Set QR')}`, callbackData: 'adm_set_qr' },
        { text: `🗑️ ${toBoldSans('Delete QR')}`, callbackData: 'adm_delete_qr' }
      ],
      [
        { text: `🚫 ${toBoldSans('Ban User')}`, callbackData: 'adm_ban_user' },
        { text: `✅ ${toBoldSans('Unban User')}`, callbackData: 'adm_unban_user' },
        { text: `🗑️ ${toBoldSans('Delete User')}`, callbackData: 'adm_del_user' }
      ],
      [
        { text: `ℹ️ ${toBoldSans('User Info')}`, callbackData: 'adm_user_info' },
        { text: `➕ ${toBoldSans('Add Balance')}`, callbackData: 'adm_add_balance' },
        { text: `➖ ${toBoldSans('Remove Bal')}`, callbackData: 'adm_rem_balance' }
      ],
      [
        { text: `📈 ${toBoldSans('Set Ref %')}`, callbackData: 'adm_set_ref_pct' },
        { text: `📊 ${toBoldSans('Statistics')}`, callbackData: 'adm_stats' },
        { text: `🔔 ${toBoldSans('Withdrawals')}`, callbackData: 'adm_withdrawals' }
      ]
    ];

    botReply(
      adminUserId,
      `🛠️ <b>${toBoldSans('MASTER ADMIN COMMAND CENTER')}</b>\n\n` +
      `Welcome Master Admin @${config.supportUsername}!\n\n` +
      `⚙️ <b>Current Settings:</b>\n` +
      `• Min Withdrawal: <b>${config.currencySymbol}${config.minWithdrawal}</b>\n` +
      `• Referral Commission: <b>${config.referralCommissionPercent}%</b>\n` +
      `• Active QR Status: <b>${activeTask ? 'Online (Active)' : 'None (Deleted)'}</b>\n\n` +
      `<i>Tap any administration action below:</i>`,
      { inlineButtons: adminButtons }
    );
  };

  // Handle incoming message
  const sendMessage = (text: string, photoUrl?: string) => {
    const userId = currentUser.id;

    if (currentUser.isBanned && userId !== config.adminId) {
      appendMessage(userId, {
        senderId: userId,
        senderName: currentUser.firstName,
        senderRole: 'user',
        text
      });
      botReply(userId, '🚫 <b>Your account has been suspended by administration.</b> Contact @SRGAMER96 for appeals.');
      return;
    }

    appendMessage(userId, {
      senderId: userId,
      senderName: currentUser.firstName,
      senderRole: userId === config.adminId ? 'admin' : 'user',
      text,
      photoUrl,
      isCommand: text.startsWith('/')
    });

    const stepInfo = userSteps[userId];

    // 1. Prevent screenshot submission after cancellation
    if (photoUrl && stepInfo?.payload?.isCancelled) {
      botReply(
        userId,
        `🚫 <b>Action Blocked: Task Cancelled</b>\n\n` +
        `You cancelled this task session. Submitting screenshots for cancelled tasks is strictly blocked to prevent invalid claims.\n\n` +
        `To submit proof for a task, please tap <b>🚀 ${toBoldSans('START EARN')}</b>, follow the QR instructions, and tap <b>📤 ${toBoldSans('Submit Proof')}</b> first!`,
        { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
      );
      return;
    }

    if (photoUrl && (!stepInfo || stepInfo.step !== 'AWAITING_PROOF') && userId !== config.adminId) {
      botReply(
        userId,
        `⚠️ <b>No Active Proof Request</b>\n\n` +
        `Screenshots sent without an active task submission cannot be processed or verified.\n\n` +
        `Please tap <b>🚀 ${toBoldSans('START EARN')}</b>, follow the instructions, and tap <b>📤 ${toBoldSans('Submit Proof')}</b> before uploading your screenshot.`,
        { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
      );
      return;
    }

    if (stepInfo) {
      if (stepInfo.step === 'AWAITING_PROOF') {
        if (stepInfo.payload?.isCancelled) {
          setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
          botReply(
            userId,
            `🚫 <b>Submission Blocked: Task Cancelled</b>\n\nThis task session was cancelled. Screenshots cannot be submitted for cancelled tasks.\n\nTap <b>🚀 ${toBoldSans('START EARN')}</b> to start fresh.`,
            { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
          );
          return;
        }

        submitProof(activeTask?.id || 'task_active', photoUrl || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80', text);
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        return;
      }

      if (stepInfo.step === 'AWAITING_NEW_QR_IMAGE' && userId === config.adminId) {
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        const photoToUse = photoUrl || (text.startsWith('http') ? text : 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=earnqr@okaxis&pn=OfficialEarning&am=10&cu=INR');
        const defaultReward = 50;

        setNewQRTask(
          'Official QR Task Drop',
          photoToUse,
          defaultReward,
          'Scan QR with any UPI app, complete payment or task, and upload screenshot proof.'
        );

        botReply(
          userId,
          `✅ <b>${toBoldSans('QR Code Photo Added & Activated!')}</b>\n\n` +
          `💰 Reward: <b>${config.currencySymbol}${defaultReward}</b>\n` +
          `🚀 The QR code has been <b>automatically added to Start Earn</b> for all members!\n\n` +
          `All user task locks have been reset so members can start earning immediately.`,
          {
            photoUrl: photoToUse,
            inlineButtons: [
              [{ text: '« Back to Admin', callbackData: 'adm_back' }]
            ]
          }
        );
        return;
      }

      if (stepInfo.step === 'AWAITING_UPI_ID') {
        const upi = text.trim();
        if (!upi.includes('@')) {
          botReply(userId, '❌ <b>Invalid UPI format!</b> Please enter a valid UPI address (e.g. <code>username@okaxis</code>):');
          return;
        }
        setUserSteps(prev => ({
          ...prev,
          [userId]: { step: 'AWAITING_WITHDRAW_AMOUNT', payload: { upiId: upi } }
        }));
        botReply(userId, `💳 UPI registered: <code>${upi}</code>\n\nEnter the withdrawal amount (Min: ${config.currencySymbol}${config.minWithdrawal}, Available: ${config.currencySymbol}${currentUser.balance.toFixed(2)}):`);
        return;
      }

      if (stepInfo.step === 'AWAITING_WITHDRAW_AMOUNT') {
        const amount = parseFloat(text.trim());
        const upiId = stepInfo.payload?.upiId || 'user@upi';
        requestWithdrawal(upiId, amount);
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        return;
      }

      if (stepInfo.step === 'AWAITING_BROADCAST_TEXT' && userId === config.adminId) {
        setUserSteps(prev => ({
          ...prev,
          [userId]: { step: 'CONFIRM_BROADCAST', payload: { broadcastText: text } }
        }));
        botReply(userId, `📢 <b>${toBoldSans('CONFIRM BROADCAST')}</b>\n\n<b>Preview:</b>\n${text}\n\nRecipient audience: <b>${Object.keys(users).length}</b> registered users.\n\n<i>Do you wish to dispatch this message?</i>`, {
          inlineButtons: [
            [{ text: `✅ ${toBoldSans('Done / Send')}`, callbackData: 'adm_broadcast_confirm' },
             { text: `❌ ${toBoldSans('Cancel')}`, callbackData: 'adm_broadcast_abort' }]
          ]
        });
        return;
      }

      // Ban ID
      if (stepInfo.step === 'AWAITING_BAN_ID' && userId === config.adminId) {
        const targetId = parseInt(text.trim(), 10);
        if (users[targetId]) {
          toggleBanUser(targetId, true);
          botReply(userId, `🚫 User <code>${targetId}</code> (${users[targetId].firstName}) is now <b>BANNED</b>.`);
        } else {
          botReply(userId, `❌ User ID <code>${targetId}</code> not found in database.`);
        }
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        return;
      }

      // Unban ID
      if (stepInfo.step === 'AWAITING_UNBAN_ID' && userId === config.adminId) {
        const targetId = parseInt(text.trim(), 10);
        if (users[targetId]) {
          toggleBanUser(targetId, false);
          botReply(userId, `✅ User <code>${targetId}</code> (${users[targetId].firstName}) is now <b>UNBANNED</b>.`);
        } else {
          botReply(userId, `❌ User ID <code>${targetId}</code> not found in database.`);
        }
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        return;
      }

      // Delete User ID
      if (stepInfo.step === 'AWAITING_DELETE_USER_ID' && userId === config.adminId) {
        const targetId = parseInt(text.trim(), 10);
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        if (targetId === config.adminId) {
          botReply(userId, '⚠️ Cannot delete Master Admin account!');
          return;
        }
        if (users[targetId]) {
          deleteUser(targetId);
        } else {
          botReply(userId, `❌ User ID <code>${targetId}</code> not found in database.`);
        }
        return;
      }

      // User Info ID
      if (stepInfo.step === 'AWAITING_USER_INFO_ID' && userId === config.adminId) {
        const targetId = parseInt(text.trim(), 10);
        const u = users[targetId];
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));

        if (!u) {
          botReply(userId, `❌ User ID <code>${targetId}</code> not found in database.`);
        } else {
          botReply(
            userId,
            `ℹ️ <b>${toBoldSans('USER ACCOUNT DOSSIER')}</b>\n\n` +
            `🆔 <b>Telegram ID:</b> <code>${u.id}</code>\n` +
            `👤 <b>Name:</b> ${u.firstName} ${u.username ? `(@${u.username})` : ''}\n` +
            `💰 <b>Wallet Balance:</b> <b>${config.currencySymbol}${u.balance.toFixed(2)}</b>\n` +
            `👥 <b>Direct Referrals:</b> ${u.referralCount} users\n` +
            `📈 <b>Referral Earnings:</b> ${config.currencySymbol}${(u.referralEarnings || 0).toFixed(2)}\n` +
            `🔗 <b>Referred By:</b> ${u.referredBy ? `<code>${u.referredBy}</code>` : 'None (Direct)'}\n` +
            `✅ <b>Tasks Completed:</b> ${u.tasksCompleted}\n` +
            `🚫 <b>Status:</b> ${u.isBanned ? '🚫 <b>BANNED</b>' : '🟢 <b>Active</b>'}\n` +
            `📅 <b>Registered:</b> ${new Date(u.joinedAt).toLocaleDateString()}`
          );
        }
        return;
      }

      // Add Balance Flow
      if (stepInfo.step === 'AWAITING_ADD_BAL_USER_ID' && userId === config.adminId) {
        const targetId = parseInt(text.trim(), 10);
        if (!users[targetId]) {
          botReply(userId, `❌ User <code>${text}</code> not found. Enter valid User ID:`);
          return;
        }
        setUserSteps(prev => ({
          ...prev,
          [userId]: { step: 'AWAITING_ADD_BAL_AMOUNT', payload: { targetId } }
        }));
        botReply(userId, `➕ <b>Step 2/2:</b> Enter amount (${config.currencySymbol}) to ADD to User <code>${targetId}</code>:`);
        return;
      }

      if (stepInfo.step === 'AWAITING_ADD_BAL_AMOUNT' && userId === config.adminId) {
        const amt = parseFloat(text.trim());
        const targetId = stepInfo.payload?.targetId;
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        if (targetId && !isNaN(amt) && amt > 0) {
          addBalanceToUser(targetId, amt);
        } else {
          botReply(userId, '❌ Invalid amount. Transaction cancelled.');
        }
        return;
      }

      // Remove Balance Flow
      if (stepInfo.step === 'AWAITING_REM_BAL_USER_ID' && userId === config.adminId) {
        const targetId = parseInt(text.trim(), 10);
        if (!users[targetId]) {
          botReply(userId, `❌ User <code>${text}</code> not found. Enter valid User ID:`);
          return;
        }
        setUserSteps(prev => ({
          ...prev,
          [userId]: { step: 'AWAITING_REM_BAL_AMOUNT', payload: { targetId } }
        }));
        botReply(userId, `➖ <b>Step 2/2:</b> Enter amount (${config.currencySymbol}) to DEDUCT from User <code>${targetId}</code>:`);
        return;
      }

      if (stepInfo.step === 'AWAITING_REM_BAL_AMOUNT' && userId === config.adminId) {
        const amt = parseFloat(text.trim());
        const targetId = stepInfo.payload?.targetId;
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        if (targetId && !isNaN(amt) && amt > 0) {
          removeBalanceFromUser(targetId, amt);
        } else {
          botReply(userId, '❌ Invalid amount. Transaction cancelled.');
        }
        return;
      }

      // Set Ref % Flow
      if (stepInfo.step === 'AWAITING_REF_PERCENT' && userId === config.adminId) {
        const pct = parseFloat(text.trim());
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
        if (!isNaN(pct) && pct >= 0 && pct <= 100) {
          setReferralCommissionPercent(pct);
        } else {
          botReply(userId, '❌ Invalid percentage. Enter a value between 0 and 100.');
        }
        return;
      }
    }

    // Commands
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      let referrerId: number | undefined;

      if (parts.length > 1 && parts[1].startsWith('ref_')) {
        const parsed = parseInt(parts[1].replace('ref_', ''), 10);
        if (parsed && parsed !== userId) {
          referrerId = parsed;
        }
      }

      if (referrerId && users[referrerId] && !currentUser.referredBy) {
        setUsers(prev => {
          const refUser = prev[referrerId!];
          if (!refUser) return prev;
          return {
            ...prev,
            [referrerId!]: {
              ...refUser,
              referralCount: refUser.referralCount + 1
            },
            [userId]: {
              ...prev[userId],
              referredBy: referrerId
            }
          };
        });

        botReply(referrerId, `🎉 <b>${toBoldSans('New Referral Joined!')}</b>\n\nUser <b>${currentUser.firstName}</b> registered via your link!\nYou will earn <b>${config.referralCommissionPercent}% Commission</b> whenever they complete tasks! 🚀`);
      }

      const welcomeGreeting =
        `🌟 <b>${toBoldSans('WELCOME TO QR WORK OFFICIAL')}</b> 🌟\n\n` +
        `Hello <b>${currentUser.firstName}</b>! 👋\n` +
        `Earn real cash by scanning verified QR tasks and uploading proofs.\n\n` +
        `💎 <b>${toBoldSans('How It Works:')}</b>\n` +
        `1️⃣ Tap <b>${BOT_KEYBOARD_BUTTONS.START_EARN}</b> to view the active QR drop.\n` +
        `2️⃣ Scan and complete the task instructions.\n` +
        `3️⃣ Tap <b>📤 ${toBoldSans('Submit Proof')}</b> to lock the task and upload your screenshot.\n` +
        `4️⃣ Fast review & instant cashout to any UPI handle!\n\n` +
        `💰 <b>Minimum Withdrawal:</b> ${config.currencySymbol}${config.minWithdrawal} via UPI\n` +
        `👥 <b>Referral Bonus:</b> <b>${config.referralCommissionPercent}% Lifetime Commission</b> on all referral earnings!\n\n` +
        `<i>Tap any stylized button below on your persistent keyboard:</i>`;

      botReply(userId, welcomeGreeting, {
        replyKeyboard: getStandardReplyKeyboard(userId === config.adminId)
      });
      return;
    }

    if (text.includes('START EARN') || text === '/earn') {
      if (!activeTask || activeTask.status === 'claimed' || activeTask.status === 'expired') {
        botReply(userId, `⚠️ <b>${toBoldSans('No Active QR Task Available')}</b>\n\nThe previous QR task has already been completed or claimed!\nPlease wait for the administrator to post a fresh QR code drop. 🔔`);
        return;
      }

      if (activeTask.isLocked) {
        if (activeTask.lockedByUserId === userId) {
          botReply(
            userId,
            `⏳ <b>${toBoldSans('Your Submission is in Review')}</b>\n\n` +
            `You have already submitted proof for this QR task.\n` +
            `The admin is reviewing your submission. You will be notified as soon as it is processed!`
          );
        } else {
          botReply(
            userId,
            `🔒 <b>${toBoldSans('QR Task Already Claimed')}</b>\n\n` +
            `Another member (<b>${activeTask.lockedByUserName || 'Member'}</b>) has already claimed and submitted proof for this QR task.\n` +
            `Each QR drop is single-use only! Please wait for the admin to post the next fresh QR code. ⏳`
          );
        }
        return;
      }

      const taskButtons: InlineButton[][] = [
        [
          { text: `📤 ${toBoldSans('Submit Proof')}`, callbackData: 'btn_submit_proof' },
          { text: `❌ ${toBoldSans('Cancel')}`, callbackData: 'btn_cancel_task' }
        ]
      ];

      const caption =
        `🔥 <b>${toBoldSans(activeTask.title)}</b>\n\n` +
        `💰 <b>Reward:</b> ${config.currencySymbol}${activeTask.reward}\n` +
        `📝 <b>Instructions:</b>\n${activeTask.instructions}\n\n` +
        `⚡ <i>Once completed, tap Submit Proof to secure your claim.</i>`;

      botReply(userId, caption, {
        photoUrl: activeTask.qrImageUrl,
        inlineButtons: taskButtons
      });
      return;
    }

    if (text.includes('PROFILE') || text === '/profile') {
      const profileText =
        `👤 <b>${toBoldSans('YOUR ACCOUNT PROFILE')}</b>\n\n` +
        `🆔 <b>Telegram ID:</b> <code>${currentUser.id}</code>\n` +
        `👤 <b>Name:</b> ${currentUser.firstName} ${currentUser.username ? `(@${currentUser.username})` : ''}\n` +
        `💰 <b>Current Balance:</b> <b>${config.currencySymbol}${currentUser.balance.toFixed(2)}</b>\n` +
        `👥 <b>Referral Count:</b> <b>${currentUser.referralCount}</b> members\n` +
        `📈 <b>Referral Earnings:</b> <b>${config.currencySymbol}${(currentUser.referralEarnings || 0).toFixed(2)}</b>\n` +
        `✅ <b>Completed Tasks:</b> <b>${currentUser.tasksCompleted}</b>\n` +
        `📅 <b>Member Since:</b> ${new Date(currentUser.joinedAt).toLocaleDateString()}\n\n` +
        `💳 <i>Cashout to any UPI handle once balance reaches ${config.currencySymbol}${config.minWithdrawal}.</i>`;

      botReply(userId, profileText);
      return;
    }

    if (text.includes('REFER & EARN') || text === '/refer') {
      const refLink = `https://t.me/${config.botUsername}?start=ref_${currentUser.id}`;
      const referText =
        `👥 <b>${toBoldSans('REFER & EARN COMMISSION')}</b>\n\n` +
        `Earn a lifetime <b>${config.referralCommissionPercent}% Commission</b> whenever your referrals complete tasks!\n\n` +
        `🔗 <b>Your Exclusive Referral Link:</b>\n` +
        `<code>${refLink}</code>\n\n` +
        `📊 <b>Your Total Referrals:</b> ${currentUser.referralCount} members\n` +
        `💰 <b>Total Referral Earnings:</b> ${config.currencySymbol}${(currentUser.referralEarnings || 0).toFixed(2)}\n\n` +
        `<i>Share the link with friends to maximize passive income!</i>`;

      botReply(userId, referText, {
        inlineButtons: [
          [{ text: `🚀 ${toBoldSans('Share Referral Link')}`, callbackData: 'share_referral' }]
        ]
      });
      return;
    }

    if (text.includes('WITHDRAW') || text === '/withdraw') {
      if (currentUser.balance < config.minWithdrawal) {
        botReply(
          userId,
          `⚠️ <b>${toBoldSans('Insufficient Balance')}</b>\n\n` +
          `Your Balance: <b>${config.currencySymbol}${currentUser.balance.toFixed(2)}</b>\n` +
          `Minimum Withdrawal: <b>${config.currencySymbol}${config.minWithdrawal.toFixed(2)}</b>\n\n` +
          `Complete more QR drops or invite members to reach the cashout threshold!`
        );
        return;
      }

      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_UPI_ID' } }));
      botReply(
        userId,
        `💰 <b>${toBoldSans('UPI WITHDRAWAL SYSTEM')}</b>\n\n` +
        `Available Balance: <b>${config.currencySymbol}${currentUser.balance.toFixed(2)}</b>\n` +
        `Minimum Withdrawal: <b>${config.currencySymbol}${config.minWithdrawal.toFixed(2)}</b>\n\n` +
        `Please type your valid <b>UPI ID</b> (e.g. <code>username@okaxis</code> or <code>number@paytm</code>):`,
        {
          inlineButtons: [
            [{ text: `❌ ${toBoldSans('Cancel Withdrawal')}`, callbackData: 'btn_cancel_withdraw' }]
          ]
        }
      );
      return;
    }

    if (text.includes('SUPPORT') || text === '/support') {
      botReply(
        userId,
        `📞 <b>${toBoldSans('OFFICIAL SUPPORT DESK')}</b>\n\n` +
        `Need help with task verification or instant payout?\n` +
        `Our support team is on standby 24/7.\n\n` +
        `👤 <b>Direct Contact:</b> @${config.supportUsername}\n` +
        `⚡ <i>Always include your Telegram ID (<code>${currentUser.id}</code>) when messaging support.</i>`,
        {
          inlineButtons: [
            [{ text: `💬 ${toBoldSans('Contact Support Team')}`, url: `https://t.me/${config.supportUsername}`, callbackData: 'open_support' }]
          ]
        }
      );
      return;
    }

    if (text.includes('ADMIN PANEL') || text === '/admin') {
      if (userId !== config.adminId) {
        botReply(userId, '⛔ <b>Access Denied:</b> This administrative section is reserved exclusively for Master Admin.', {
          replyKeyboard: getStandardReplyKeyboard(false)
        });
        return;
      }
      sendAdminPanelMenu(userId);
      return;
    }

    botReply(
      userId,
      `❓ <i>Message received: "${text}"</i>\n\nPlease select an action from your keyboard menu below:`,
      { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
    );
  };

  const handleCallbackQuery = (callbackData: string) => {
    const userId = currentUser.id;

    if (callbackData === 'btn_submit_proof') {
      if (!activeTask) {
        botReply(userId, '⚠️ Task is no longer active.');
        return;
      }
      if (activeTask.isLocked && activeTask.lockedByUserId !== userId) {
        botReply(userId, '🔒 Task already claimed by another user!');
        return;
      }

      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_PROOF', payload: { isCancelled: false } } }));
      botReply(
        userId,
        `📤 <b>${toBoldSans('SUBMIT TASK PROOF')}</b>\n\n` +
        `Please send your transaction proof now!\n` +
        `• Send a <b>Screenshot / Photo</b>\n` +
        `• Or type the <b>UTR / Reference Number</b> in the chat.\n\n` +
        `<i>Tap Cancel below if you wish to withdraw your attempt:</i>`,
        {
          inlineButtons: [
            [{ text: `❌ ${toBoldSans('Cancel')}`, callbackData: 'btn_cancel_task' }]
          ]
        }
      );
      return;
    }

    if (callbackData === 'btn_cancel_task') {
      cancelTask();
      return;
    }

    if (callbackData === 'btn_cancel_withdraw') {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
      botReply(userId, '✅ Withdrawal process canceled.', {
        replyKeyboard: getStandardReplyKeyboard(userId === config.adminId)
      });
      return;
    }

    // Admin Callbacks
    if (callbackData === 'adm_delete_qr' && userId === config.adminId) {
      deleteQRTask();
      return;
    }

    if (callbackData === 'adm_ban_user' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_BAN_ID' } }));
      botReply(userId, '🚫 <b>Enter numeric Telegram User ID to BAN:</b>', {
        inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]]
      });
      return;
    }

    if (callbackData === 'adm_unban_user' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_UNBAN_ID' } }));
      botReply(userId, '✅ <b>Enter numeric Telegram User ID to UNBAN:</b>', {
        inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]]
      });
      return;
    }

    if (callbackData === 'adm_del_user' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_DELETE_USER_ID' } }));
      botReply(userId, '🗑️ <b>Enter numeric Telegram User ID to DELETE from database:</b>\n\n<i>⚠️ This removes the user profile and data permanently.</i>', {
        inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]]
      });
      return;
    }

    if (callbackData === 'adm_user_info' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_USER_INFO_ID' } }));
      botReply(userId, 'ℹ️ <b>Enter Telegram User ID to view account details:</b>', {
        inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]]
      });
      return;
    }

    if (callbackData === 'adm_add_balance' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_ADD_BAL_USER_ID' } }));
      botReply(userId, '➕ <b>Step 1/2: Enter Telegram User ID to credit balance:</b>', {
        inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]]
      });
      return;
    }

    if (callbackData === 'adm_rem_balance' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_REM_BAL_USER_ID' } }));
      botReply(userId, '➖ <b>Step 1/2: Enter Telegram User ID to deduct balance:</b>', {
        inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]]
      });
      return;
    }

    if (callbackData === 'adm_set_ref_pct' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_REF_PERCENT' } }));
      botReply(
        userId,
        `📈 <b>SET REFERRAL COMMISSION PERCENTAGE</b>\n\nCurrent Rate: <b>${config.referralCommissionPercent}%</b>\n\nEnter new percentage (e.g. 10, 15, 20):`,
        { inlineButtons: [[{ text: '❌ Cancel', callbackData: 'adm_back' }]] }
      );
      return;
    }

    if (callbackData === 'adm_stats' && userId === config.adminId) {
      const userList = Object.values(users);
      const totalBalance = userList.reduce((acc, u) => acc + u.balance, 0);
      const totalPaid = withdrawals
        .filter(w => w.status === 'approved')
        .reduce((acc, w) => acc + w.amount, 0);
      const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length;
      const pendingProofsCount = proofs.filter(p => p.status === 'pending').length;

      botReply(
        userId,
        `📊 <b>${toBoldSans('REAL-TIME SYSTEM STATISTICS')}</b>\n\n` +
        `👥 <b>Total Users:</b> ${userList.length}\n` +
        `💰 <b>Total Active Balances:</b> ${config.currencySymbol}${totalBalance.toFixed(2)}\n` +
        `💸 <b>Total Payouts Approved:</b> ${config.currencySymbol}${totalPaid.toFixed(2)}\n` +
        `⏳ <b>Pending Withdrawals:</b> ${pendingWithdrawalsCount} requests\n` +
        `📥 <b>Pending Proofs:</b> ${pendingProofsCount} submissions\n` +
        `🎯 <b>Total Completed Tasks:</b> ${userList.reduce((acc, u) => acc + u.tasksCompleted, 0)}\n` +
        `📈 <b>Referral Commission:</b> ${config.referralCommissionPercent}%\n` +
        `💳 <b>Min Cashout:</b> ${config.currencySymbol}${config.minWithdrawal}\n\n` +
        `🟢 <b>Bot Engine:</b> Running Healthy 24/7`,
        {
          inlineButtons: [
            [{ text: '« Back to Admin', callbackData: 'adm_back' }]
          ]
        }
      );
      return;
    }

    if (callbackData === 'adm_set_qr' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_NEW_QR_IMAGE' } }));
      botReply(
        userId,
        `📸 <b>${toBoldSans('PROVIDE QR CODE PHOTO')}</b>\n\n` +
        `Please send or upload your <b>QR Code Photo</b> now! 📷\n\n` +
        `⚡ <b>Auto-Activation:</b> Once you provide the photo, the QR code and photo will be <b>automatically added to Start Earn</b> for all members immediately!\n\n` +
        `<i>(Tap the photo icon 🖼️ below or choose a preset):</i>`,
        {
          inlineButtons: [
            [{ text: '⚡ Quick Add ₹50 QR Photo', callbackData: 'adm_set_preset_50' }],
            [{ text: '⚡ Quick Add ₹100 QR Photo', callbackData: 'adm_set_preset_100' }],
            [{ text: '« Back to Admin', callbackData: 'adm_back' }]
          ]
        }
      );
      return;
    }

    if (callbackData === 'adm_set_preset_50' && userId === config.adminId) {
      setNewQRTask(
        'Flash UPI ₹50 Bonus Drop',
        'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=flashpay@okaxis&pn=OfficialEarning&am=10&cu=INR',
        50,
        'Scan QR code, transfer ₹10 test amount, and submit screenshot with UTR number.'
      );
      botReply(userId, `✅ <b>New QR Task Activated!</b> Reward: ${config.currencySymbol}50. All user locks reset.`);
      return;
    }

    if (callbackData === 'adm_set_preset_100' && userId === config.adminId) {
      setNewQRTask(
        'Mega Weekend ₹100 QR Task',
        'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=megapayout@okaxis&pn=OfficialEarning&am=25&cu=INR',
        100,
        'Scan QR code, complete the premium sponsor task, and upload completion screenshot.'
      );
      botReply(userId, `✅ <b>New Mega QR Task Activated!</b> Reward: ${config.currencySymbol}100. All user locks reset.`);
      return;
    }

    if (callbackData === 'adm_broadcast' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'AWAITING_BROADCAST_TEXT' } }));
      botReply(
        userId,
        `📢 <b>${toBoldSans('GLOBAL BROADCAST DISPATCH')}</b>\n\n` +
        `Please type the message you want to broadcast to all bot users:\n\n` +
        `<i>HTML formatting is supported. You will be prompted to confirm before dispatch.</i>`,
        {
          inlineButtons: [
            [{ text: `❌ ${toBoldSans('Cancel')}`, callbackData: 'adm_back' }]
          ]
        }
      );
      return;
    }

    if (callbackData === 'adm_broadcast_confirm' && userId === config.adminId) {
      const textToBroadcast = userSteps[userId]?.payload?.broadcastText;
      if (textToBroadcast) {
        broadcastMessage(textToBroadcast);
        setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
      }
      return;
    }

    if (callbackData === 'adm_broadcast_abort' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
      botReply(userId, 'Broadcast canceled.', {
        replyKeyboard: getStandardReplyKeyboard(true)
      });
      return;
    }

    if (callbackData === 'adm_withdrawals' && userId === config.adminId) {
      const pending = withdrawals.filter(w => w.status === 'pending');
      if (pending.length === 0) {
        botReply(userId, '✅ <b>No pending withdrawal requests found!</b>', {
          inlineButtons: [[{ text: '« Back to Admin', callbackData: 'adm_back' }]]
        });
        return;
      }

      botReply(userId, `🔔 <b>Pending Withdrawal Requests (${pending.length}):</b>`);
      pending.forEach(w => {
        botReply(
          userId,
          `💳 <b>Request ID:</b> <code>${w.id}</code>\n` +
          `👤 User: <b>${w.userName}</b> (<code>${w.userId}</code>)\n` +
          `💰 Amount: <b>${config.currencySymbol}${w.amount.toFixed(2)}</b>\n` +
          `🎯 Destination UPI: <code>${w.upiId}</code>\n` +
          `🕒 Date: ${new Date(w.createdAt).toLocaleTimeString()}`,
          {
            inlineButtons: [
              [
                { text: `✅ ${toBoldSans('Approve')}`, callbackData: `w_app_${w.id}` },
                { text: `❌ ${toBoldSans('Reject')}`, callbackData: `w_rej_${w.id}` }
              ]
            ]
          }
        );
      });
      return;
    }

    if (callbackData.startsWith('w_app_') && userId === config.adminId) {
      const wid = callbackData.replace('w_app_', '');
      approveWithdrawal(wid);
      return;
    }

    if (callbackData.startsWith('w_rej_') && userId === config.adminId) {
      const wid = callbackData.replace('w_rej_', '');
      rejectWithdrawal(wid, 'UPI account mismatch or invalid VPA');
      return;
    }

    if (callbackData.startsWith('proof_app_') && userId === config.adminId) {
      const pid = callbackData.replace('proof_app_', '');
      approveProof(pid);
      return;
    }

    if (callbackData.startsWith('proof_rej_') && userId === config.adminId) {
      const pid = callbackData.replace('proof_rej_', '');
      rejectProof(pid, 'Transaction reference unverified');
      return;
    }

    if (callbackData === 'adm_back' && userId === config.adminId) {
      setUserSteps(prev => ({ ...prev, [userId]: { step: 'IDLE' } }));
      sendAdminPanelMenu(userId);
      return;
    }
  };

  const submitProof = (taskId: string, image: string, textNote?: string) => {
    const userId = currentUser.id;
    if (!activeTask) return;

    const newProof: ProofSubmission = {
      id: 'proof_' + Date.now(),
      userId,
      userName: currentUser.firstName,
      userUsername: currentUser.username,
      taskId,
      taskTitle: activeTask.title,
      reward: activeTask.reward,
      proofImageUrl: image,
      proofText: textNote || 'Uploaded proof screenshot',
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    setProofs(prev => [newProof, ...prev]);

    setActiveTask(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isLocked: true,
        lockedByUserId: userId,
        lockedByUserName: currentUser.firstName,
        status: 'in_review'
      };
    });

    botReply(
      userId,
      `✅ <b>${toBoldSans('Proof Submitted Successfully!')}</b>\n\n` +
      `Your submission has been securely forwarded to the administrator for verification.\n` +
      `🔒 <b>Task Locked:</b> This task is now exclusively reserved for your submission.\n\n` +
      `You will receive an automated notification as soon as it is approved! 🚀`,
      { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
    );

    botReply(
      config.adminId,
      `📥 <b>${toBoldSans('NEW TASK PROOF SUBMITTED')}</b>\n\n` +
      `👤 Member: <b>${currentUser.firstName}</b> (@${currentUser.username || 'none'})\n` +
      `🆔 Telegram ID: <code>${userId}</code>\n` +
      `🎯 Task: <b>${activeTask.title}</b>\n` +
      `💰 Reward Amount: <b>${config.currencySymbol}${activeTask.reward}</b>\n` +
      `📝 Note: ${textNote || 'Photo attached'}\n\n` +
      `<i>Tap below to review:</i>`,
      {
        photoUrl: image,
        inlineButtons: [
          [
            { text: `✅ ${toBoldSans('Approve')}`, callbackData: `proof_app_${newProof.id}` },
            { text: `❌ ${toBoldSans('Reject')}`, callbackData: `proof_rej_${newProof.id}` }
          ]
        ]
      }
    );
  };

  const cancelTask = () => {
    const userId = currentUser.id;
    const stepInfo = userSteps[userId];
    const holdsLock = activeTask && activeTask.lockedByUserId === userId;

    // 1. Prevent repeated cancellations
    if (stepInfo?.step !== 'AWAITING_PROOF' && !holdsLock && stepInfo?.payload?.isCancelled) {
      botReply(
        userId,
        `⚠️ <b>Task is already cancelled!</b> You cannot cancel it again.\n\nTap <b>🚀 ${toBoldSans('START EARN')}</b> if you wish to start a new task.`,
        { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
      );
      return;
    }

    // 2. Remove inline buttons from previous messages to prevent repeated button clicks
    setChatHistory(prev => {
      const userMsgs = prev[userId] || [];
      const updated = userMsgs.map(m => (m.inlineButtons ? { ...m, inlineButtons: undefined } : m));
      return { ...prev, [userId]: updated };
    });

    // 3. Release lock if held
    if (activeTask && activeTask.lockedByUserId === userId) {
      setActiveTask(prev => {
        if (!prev) return null;
        return {
          ...prev,
          isLocked: false,
          lockedByUserId: undefined,
          lockedByUserName: undefined,
          status: 'active'
        };
      });
    }

    // 4. Mark user step as IDLE and isCancelled: true
    setUserSteps(prev => ({
      ...prev,
      [userId]: { step: 'IDLE', payload: { isCancelled: true, cancelledAt: Date.now() } }
    }));

    botReply(
      userId,
      `❌ <b>${toBoldSans('Task Session Cancelled')}</b>\n\n` +
      `• Further actions—such as submitting screenshots or UTR numbers—are now blocked for this cancelled session.\n` +
      `• You cannot repeatedly cancel this task.\n` +
      `• The QR code remains open if you wish to start a new attempt.\n\n` +
      `Tap <b>🚀 ${toBoldSans('START EARN')}</b> on your keyboard whenever you wish to start fresh!`,
      { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
    );
  };

  const requestWithdrawal = (upiId: string, amount: number) => {
    const userId = currentUser.id;

    if (isNaN(amount) || amount < config.minWithdrawal) {
      botReply(userId, `❌ Minimum cashout is ${config.currencySymbol}${config.minWithdrawal}.`);
      return { success: false, error: 'Amount below minimum' };
    }

    if (amount > currentUser.balance) {
      botReply(userId, `❌ Insufficient balance! You only have ${config.currencySymbol}${currentUser.balance.toFixed(2)}.`);
      return { success: false, error: 'Insufficient balance' };
    }

    setUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        balance: prev[userId].balance - amount
      }
    }));

    const newWithdrawal: WithdrawalRequest = {
      id: 'w_' + Date.now(),
      userId,
      userName: currentUser.firstName,
      userUsername: currentUser.username,
      upiId,
      amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setWithdrawals(prev => [newWithdrawal, ...prev]);

    botReply(
      userId,
      `✅ <b>${toBoldSans('Withdrawal Request Queued!')}</b>\n\n` +
      `💰 Amount: <b>${config.currencySymbol}${amount.toFixed(2)}</b>\n` +
      `💳 Destination UPI: <code>${upiId}</code>\n` +
      `📉 Remaining Balance: <b>${config.currencySymbol}${(currentUser.balance - amount).toFixed(2)}</b>\n\n` +
      `Our administration team will review and disburse your payment shortly.`,
      { replyKeyboard: getStandardReplyKeyboard(userId === config.adminId) }
    );

    botReply(
      config.adminId,
      `🔔 <b>${toBoldSans('NEW UPI WITHDRAWAL REQUEST')}</b>\n\n` +
      `👤 User: <b>${currentUser.firstName}</b> (@${currentUser.username || 'none'})\n` +
      `🆔 User ID: <code>${userId}</code>\n` +
      `💰 Cashout Amount: <b>${config.currencySymbol}${amount.toFixed(2)}</b>\n` +
      `💳 Target UPI: <code>${upiId}</code>\n` +
      `🕒 Date: ${new Date().toLocaleString()}\n\n` +
      `<i>Action Required:</i>`,
      {
        inlineButtons: [
          [
            { text: `✅ ${toBoldSans('Approve Payout')}`, callbackData: `w_app_${newWithdrawal.id}` },
            { text: `❌ ${toBoldSans('Reject & Refund')}`, callbackData: `w_rej_${newWithdrawal.id}` }
          ]
        ]
      }
    );

    return { success: true };
  };

  const approveProof = (proofId: string) => {
    const proof = proofs.find(p => p.id === proofId);
    if (!proof || proof.status !== 'pending') return;

    setProofs(prev => prev.map(p => p.id === proofId ? { ...p, status: 'approved', reviewedAt: new Date().toISOString() } : p));

    // Credit user balance
    setUsers(prev => {
      const u = prev[proof.userId];
      if (!u) return prev;
      return {
        ...prev,
        [proof.userId]: {
          ...u,
          balance: u.balance + proof.reward,
          tasksCompleted: u.tasksCompleted + 1
        }
      };
    });

    // The QR task is completed and consumed! Clear it so it will never show as available
    setActiveTask(null);
    fetch('/api/bot/qr/delete', { method: 'POST' }).catch(() => {});

    // Referrer Commission Percentage Calculation
    const user = users[proof.userId];
    let refMsg = '';
    if (user && user.referredBy && users[user.referredBy]) {
      const commission = (proof.reward * config.referralCommissionPercent) / 100;
      setUsers(prev => {
        const refUser = prev[user.referredBy!];
        if (!refUser) return prev;
        return {
          ...prev,
          [user.referredBy!]: {
            ...refUser,
            balance: refUser.balance + commission,
            referralEarnings: (refUser.referralEarnings || 0) + commission
          }
        };
      });

      botReply(
        user.referredBy,
        `🎉 <b>${toBoldSans('REFERRAL COMMISSION CREDITED!')}</b>\n\n` +
        `Your referral <b>${user.firstName}</b> completed a task (Reward: ${config.currencySymbol}${proof.reward})!\n` +
        `💰 Added <b>${config.referralCommissionPercent}% (${config.currencySymbol}${commission.toFixed(2)})</b> to your balance! 🚀`
      );

      refMsg = `\n👥 Credited ${config.referralCommissionPercent}% (${config.currencySymbol}${commission.toFixed(2)}) to Referrer ${user.referredBy}.`;
    }

    botReply(config.adminId, `✅ <b>Approved!</b> Added ${config.currencySymbol}${proof.reward} to User <code>${proof.userId}</code>.${refMsg}\n\n<i>🎯 QR task completed & closed from Start Earn.</i>`);

    botReply(
      proof.userId,
      `🎉 <b>${toBoldSans('TASK PROOF APPROVED!')}</b>\n\n` +
      `Your submission for <b>${proof.taskTitle}</b> has been approved!\n` +
      `💰 Reward Credited: <b>${config.currencySymbol}${proof.reward}</b>\n` +
      `Check your updated balance in 👤 ${toBoldSans('PROFILE')}!`
    );
  };

  const rejectProof = (proofId: string, reason?: string) => {
    const proof = proofs.find(p => p.id === proofId);
    if (!proof || proof.status !== 'pending') return;

    setProofs(prev => prev.map(p => p.id === proofId ? { ...p, status: 'rejected', rejectionReason: reason || 'Invalid proof', reviewedAt: new Date().toISOString() } : p));

    // Close the used QR code so it does NOT show as available anymore!
    setActiveTask(null);
    fetch('/api/bot/qr/delete', { method: 'POST' }).catch(() => {});

    botReply(config.adminId, `❌ <b>Proof Rejected!</b> The used QR task has been closed and will not show as available. Post a fresh QR anytime.`);

    botReply(
      proof.userId,
      `❌ <b>${toBoldSans('TASK PROOF REJECTED')}</b>\n\n` +
      `Your proof for <b>${proof.taskTitle}</b> could not be verified.\n` +
      `Reason: ${reason || 'Screenshot or UTR did not match records'}.\n\n` +
      `Please stay tuned for the next fresh QR drop!`
    );
  };

  const approveWithdrawal = (withdrawalId: string) => {
    const w = withdrawals.find(item => item.id === withdrawalId);
    if (!w || w.status !== 'pending') return;

    setWithdrawals(prev => prev.map(item => item.id === withdrawalId ? {
      ...item,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      transactionRef: 'UPI/' + Date.now()
    } : item));

    botReply(config.adminId, `✅ Payout of ${config.currencySymbol}${w.amount} to <code>${w.upiId}</code> marked <b>PAID</b>.`);

    botReply(
      w.userId,
      `🎉 <b>${toBoldSans('WITHDRAWAL COMPLETED!')}</b>\n\n` +
      `💰 Amount: <b>${config.currencySymbol}${w.amount.toFixed(2)}</b>\n` +
      `💳 Transferred to UPI: <code>${w.upiId}</code>\n` +
      `⚡ Status: <b>Successful</b>\n\n` +
      `Thank you for earning with QR WORK!`
    );
  };

  const rejectWithdrawal = (withdrawalId: string, reason?: string) => {
    const w = withdrawals.find(item => item.id === withdrawalId);
    if (!w || w.status !== 'pending') return;

    setWithdrawals(prev => prev.map(item => item.id === withdrawalId ? {
      ...item,
      status: 'rejected',
      rejectionReason: reason || 'UPI ID incorrect',
      reviewedAt: new Date().toISOString()
    } : item));

    setUsers(prev => {
      const u = prev[w.userId];
      if (!u) return prev;
      return {
        ...prev,
        [w.userId]: {
          ...u,
          balance: u.balance + w.amount
        }
      };
    });

    botReply(config.adminId, `❌ Payout rejected. ${config.currencySymbol}${w.amount} has been <b>refunded</b> to user balance.`);

    botReply(
      w.userId,
      `⚠️ <b>${toBoldSans('WITHDRAWAL REJECTED')}</b>\n\n` +
      `Your payout of <b>${config.currencySymbol}${w.amount.toFixed(2)}</b> to <code>${w.upiId}</code> was rejected.\n` +
      `Reason: ${reason || 'UPI address was unreachable'}.\n\n` +
      `💰 <b>Refund:</b> ${config.currencySymbol}${w.amount.toFixed(2)} has been credited back to your wallet balance.`
    );
  };

  const setNewQRTask = (title: string, qrImageUrl: string, reward: number, instructions: string) => {
    const newTask: QRTask = {
      id: 'task_' + Date.now(),
      title,
      qrImageUrl,
      reward,
      instructions,
      isLocked: false,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setActiveTask(newTask);

    botReply(
      config.adminId,
      `✅ <b>${toBoldSans('New QR Code Activated!')}</b>\n\n` +
      `🎯 Task: <b>${title}</b>\n` +
      `💰 Reward: <b>${config.currencySymbol}${reward}</b>\n` +
      `🔓 "Start Earn" availability has been reset for all users!`
    );
  };

  const broadcastMessage = (text: string) => {
    const allUserIds = Object.keys(users).map(Number);
    let delivered = 0;

    allUserIds.forEach(uid => {
      botReply(
        uid,
        `📢 <b>${toBoldSans('OFFICIAL ANNOUNCEMENT')}</b>\n\n${text}`
      );
      delivered++;
    });

    botReply(
      config.adminId,
      `✅ <b>Broadcast Complete!</b>\n\nDelivered to <b>${delivered}</b> registered users.`
    );

    return { delivered, failed: 0 };
  };

  const resetAllData = () => {
    localStorage.clear();
    setConfig(INITIAL_CONFIG);
    setUsers(INITIAL_USERS);
    setActiveTask(INITIAL_ACTIVE_TASK);
    setProofs(INITIAL_PROOFS);
    setWithdrawals(INITIAL_WITHDRAWALS);
    setChatHistory(INITIAL_CHAT_MESSAGES);
    setUserSteps({});
  };

  return (
    <BotContext.Provider
      value={{
        config,
        updateConfig,
        users,
        activePersona,
        setActivePersona,
        currentUser,
        activeTask,
        proofs,
        withdrawals,
        messages: currentMessages,
        currentTab,
        setCurrentTab,
        sendMessage,
        handleCallbackQuery,
        submitProof,
        cancelTask,
        requestWithdrawal,
        approveProof,
        rejectProof,
        approveWithdrawal,
        rejectWithdrawal,
        setNewQRTask,
        deleteQRTask,
        broadcastMessage,
        toggleBanUser,
        deleteUser,
        addBalanceToUser,
        removeBalanceFromUser,
        setReferralCommissionPercent,
        getUserInfo,
        resetAllData
      }}
    >
      {children}
    </BotContext.Provider>
  );
};

export const useBot = () => {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error('useBot must be used within BotProvider');
  return ctx;
};
