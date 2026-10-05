export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  balance: number;
  referralCount: number;
  referredBy?: number;
  referralEarnings?: number;
  isBanned: boolean;
  tasksCompleted: number;
  joinedAt: string;
  role: 'user' | 'admin';
}

export interface QRTask {
  id: string;
  title: string;
  qrImageUrl: string;
  reward: number;
  instructions: string;
  isLocked: boolean;
  lockedByUserId?: number;
  lockedByUserName?: string;
  status: 'active' | 'in_review' | 'claimed' | 'expired';
  createdAt: string;
}

export interface ProofSubmission {
  id: string;
  userId: number;
  userName: string;
  userUsername?: string;
  taskId: string;
  taskTitle: string;
  reward: number;
  proofImageUrl: string;
  proofText?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: number;
  userName: string;
  userUsername?: string;
  upiId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  transactionRef?: string;
}

export interface InlineButton {
  text: string;
  callbackData: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  senderRole: 'user' | 'bot' | 'admin';
  text: string;
  photoUrl?: string;
  inlineButtons?: InlineButton[][];
  replyKeyboard?: string[][];
  timestamp: string;
  isCommand?: boolean;
}

export interface BotConfig {
  botName: string;
  botUsername: string;
  adminId: number;
  botToken: string;
  supportUsername: string;
  currencySymbol: string;
  referralBonus: number;
  referralCommissionPercent: number;
  minWithdrawal: number;
  defaultTaskReward: number;
  welcomeBannerUrl?: string;
}

export type ViewTab = 'simulator' | 'miniapp' | 'admin_panel' | 'source_code' | 'deployment_guide' | 'live_settings';
export type ActivePersona = 'user_1' | 'user_2' | 'admin';
