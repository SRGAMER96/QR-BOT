import { BotConfig, QRTask, TelegramUser, ProofSubmission, WithdrawalRequest, ChatMessage } from '../types/bot';
import { BOT_KEYBOARD_BUTTONS, toBoldSans } from '../utils/unicodeFonts';

export const INITIAL_CONFIG: BotConfig = {
  botName: 'QR KING',
  botUsername: 'QR_WORK_ON_BOT',
  adminId: 8962632792,
  botToken: '8916389057:AAFVwogT5jrAokNoBmJix_5yd4_0pfZqUfk',
  supportUsername: 'SRGAMER96',
  currencySymbol: '₹',
  referralBonus: 10,
  referralCommissionPercent: 10,
  minWithdrawal: 30,
  defaultTaskReward: 50,
  welcomeBannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'
};

export const INITIAL_USERS: Record<number, TelegramUser> = {
  5829104: {
    id: 5829104,
    firstName: 'Alex Vance',
    username: 'alex_vance',
    balance: 85.00,
    referralCount: 3,
    isBanned: false,
    tasksCompleted: 4,
    joinedAt: '2026-09-15T10:30:00Z',
    role: 'user'
  },
  9840212: {
    id: 9840212,
    firstName: 'Samira Roy',
    username: 'samiraroy',
    balance: 15.00,
    referralCount: 1,
    referredBy: 5829104,
    isBanned: false,
    tasksCompleted: 1,
    joinedAt: '2026-09-28T14:15:00Z',
    role: 'user'
  },
  8962632792: {
    id: 8962632792,
    firstName: 'Master Admin',
    username: 'SRGAMER96',
    balance: 5000.00,
    referralCount: 42,
    isBanned: false,
    tasksCompleted: 0,
    joinedAt: '2026-08-01T00:00:00Z',
    role: 'admin'
  }
};

export const INITIAL_ACTIVE_TASK: QRTask = {
  id: 'task_001',
  title: 'Instant ₹50 UPI Cashback Drop',
  qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=upi://pay?pa=payee.earnqr@okaxis&pn=OfficialEarning&am=10&cu=INR',
  reward: 50,
  instructions: '1. Scan the QR code using Google Pay, PhonePe, or Paytm.\n2. Complete the verified ₹10 test transfer or partner task.\n3. Take a full screenshot showing the 12-digit UTR number.\n4. Click Submit Proof below and upload your screenshot.',
  isLocked: false,
  status: 'active',
  createdAt: new Date().toISOString()
};

export const INITIAL_PROOFS: ProofSubmission[] = [
  {
    id: 'proof_101',
    userId: 5829104,
    userName: 'Alex Vance',
    userUsername: 'alex_vance',
    taskId: 'task_prev_09',
    taskTitle: 'Flash Promo QR #9',
    reward: 50,
    proofImageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80',
    proofText: 'Transaction UTR: 429182740192 completed on Google Pay',
    status: 'pending',
    submittedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  }
];

export const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [
  {
    id: 'w_901',
    userId: 5829104,
    userName: 'Alex Vance',
    userUsername: 'alex_vance',
    upiId: 'alexvance@okaxis',
    amount: 50,
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: 'w_902',
    userId: 9840212,
    userName: 'Samira Roy',
    userUsername: 'samiraroy',
    upiId: 'samira98@paytm',
    amount: 100,
    status: 'approved',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    transactionRef: 'UPI/20261002/98214184'
  }
];

export const INITIAL_CHAT_MESSAGES: Record<number, ChatMessage[]> = {
  5829104: [
    {
      id: 'm_1',
      senderId: 5829104,
      senderName: 'Alex Vance',
      senderRole: 'user',
      text: '/start',
      timestamp: '10:30 AM',
      isCommand: true
    },
    {
      id: 'm_2',
      senderId: 0,
      senderName: 'QR Cash Official Bot',
      senderRole: 'bot',
      text: `🌟 <b>${toBoldSans('WELCOME TO QR EARN OFFICIAL')}</b> 🌟\n\n` +
        `Hello <b>Alex Vance</b>! 👋\n` +
        `Earn real instant cash by scanning verified QR codes and uploading proofs.\n\n` +
        `💎 <b>${toBoldSans('How It Works:')}</b>\n` +
        `1️⃣ Tap <b>${BOT_KEYBOARD_BUTTONS.START_EARN}</b> to view the active QR task.\n` +
        `2️⃣ Scan, complete payment or action according to instructions.\n` +
        `3️⃣ Click <b>📤 ${toBoldSans('Submit Proof')}</b> and upload screenshot.\n` +
        `4️⃣ Fast approval & instant balance credited to your wallet!\n\n` +
        `💰 <b>Minimum Withdrawal:</b> ₹30 via UPI\n` +
        `👥 <b>Referral Bonus:</b> 10% Commission on every task completed by your referrals!\n\n` +
        `<i>Select an option from the stylized keyboard below to get started:</i>`,
      timestamp: '10:30 AM',
      replyKeyboard: [
        [BOT_KEYBOARD_BUTTONS.START_EARN, BOT_KEYBOARD_BUTTONS.PROFILE],
        [BOT_KEYBOARD_BUTTONS.REFER_EARN, BOT_KEYBOARD_BUTTONS.WITHDRAW],
        [BOT_KEYBOARD_BUTTONS.SUPPORT, BOT_KEYBOARD_BUTTONS.ADMIN_PANEL]
      ]
    }
  ],
  9840212: [
    {
      id: 'm_s1',
      senderId: 9840212,
      senderName: 'Samira Roy',
      senderRole: 'user',
      text: '/start ref_5829104',
      timestamp: '02:15 PM',
      isCommand: true
    },
    {
      id: 'm_s2',
      senderId: 0,
      senderName: 'QR Cash Official Bot',
      senderRole: 'bot',
      text: `🌟 <b>${toBoldSans('WELCOME TO QR EARN OFFICIAL')}</b> 🌟\n\n` +
        `Hello <b>Samira Roy</b>! 👋\n` +
        `You were invited by <b>Alex Vance</b>! 🎉\n` +
        `Earn real cash with verified QR tasks and cashout to any UPI handle.`,
      timestamp: '02:15 PM',
      replyKeyboard: [
        [BOT_KEYBOARD_BUTTONS.START_EARN, BOT_KEYBOARD_BUTTONS.PROFILE],
        [BOT_KEYBOARD_BUTTONS.REFER_EARN, BOT_KEYBOARD_BUTTONS.WITHDRAW],
        [BOT_KEYBOARD_BUTTONS.SUPPORT, BOT_KEYBOARD_BUTTONS.ADMIN_PANEL]
      ]
    }
  ],
  8962632792: [
    {
      id: 'm_a1',
      senderId: 8962632792,
      senderName: 'Master Admin',
      senderRole: 'user',
      text: '/start',
      timestamp: '09:00 AM',
      isCommand: true
    },
    {
      id: 'm_a2',
      senderId: 0,
      senderName: 'QR Cash Official Bot',
      senderRole: 'bot',
      text: `🛠️ <b>${toBoldSans('MASTER ADMIN RECOGNIZED')}</b> (ID: <code>8962632792</code>)\n\n` +
        `Welcome @SRGAMER96! You have exclusive master administrative privileges.\n` +
        `Tap <b>${BOT_KEYBOARD_BUTTONS.ADMIN_PANEL}</b> on your keyboard to post new QR drops, approve proofs, manage withdrawals, and broadcast announcements.`,
      timestamp: '09:00 AM',
      replyKeyboard: [
        [BOT_KEYBOARD_BUTTONS.START_EARN, BOT_KEYBOARD_BUTTONS.PROFILE],
        [BOT_KEYBOARD_BUTTONS.REFER_EARN, BOT_KEYBOARD_BUTTONS.WITHDRAW],
        [BOT_KEYBOARD_BUTTONS.SUPPORT, BOT_KEYBOARD_BUTTONS.ADMIN_PANEL]
      ]
    }
  ]
};
