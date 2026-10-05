/**
 * Helper to transform standard ASCII text into mathematical bold sans-serif,
 * serif, and monospace Unicode characters commonly used by top Telegram earning bots.
 */

export function toBoldSans(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // A-Z (0x1D5D4 - 0x1D5ED)
    if (code >= 65 && code <= 90) {
      result += String.fromCodePoint(0x1d5d4 + (code - 65));
    }
    // a-z (0x1D5EE - 0x1D607)
    else if (code >= 97 && code <= 122) {
      result += String.fromCodePoint(0x1d5ee + (code - 97));
    }
    // 0-9 (0x1D7EC - 0x1D7F5)
    else if (code >= 48 && code <= 57) {
      result += String.fromCodePoint(0x1d7ec + (code - 48));
    } else {
      result += text[i];
    }
  }
  return result;
}

export function toBoldSerif(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      result += String.fromCodePoint(0x1d400 + (code - 65));
    } else if (code >= 97 && code <= 122) {
      result += String.fromCodePoint(0x1d41a + (code - 97));
    } else if (code >= 48 && code <= 57) {
      result += String.fromCodePoint(0x1d7ce + (code - 48));
    } else {
      result += text[i];
    }
  }
  return result;
}

export function toMonospace(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      result += String.fromCodePoint(0x1d670 + (code - 65));
    } else if (code >= 97 && code <= 122) {
      result += String.fromCodePoint(0x1d68a + (code - 97));
    } else if (code >= 48 && code <= 57) {
      result += String.fromCodePoint(0x1d7f6 + (code - 48));
    } else {
      result += text[i];
    }
  }
  return result;
}

// Stylized keyboard button labels requested in prompt
export const BOT_KEYBOARD_BUTTONS = {
  START_EARN: `🚀 ${toBoldSans('START EARN')}`,
  PROFILE: `👤 ${toBoldSans('PROFILE')}`,
  REFER_EARN: `👥 ${toBoldSans('REFER & EARN')}`,
  WITHDRAW: `💰 ${toBoldSans('WITHDRAW')}`,
  SUPPORT: `📞 ${toBoldSans('SUPPORT')}`,
  ADMIN_PANEL: `🛠️ ${toBoldSans('ADMIN PANEL')}`,
};

export const BOT_INLINE_BUTTONS = {
  SUBMIT_PROOF: `📤 ${toBoldSans('Submit Proof')}`,
  CANCEL_TASK: `❌ ${toBoldSans('Cancel Task')}`,
  APPROVE: `✅ ${toBoldSans('Approve')}`,
  REJECT: `❌ ${toBoldSans('Reject')}`,
  BROADCAST_DONE: `✅ ${toBoldSans('Done / Send')}`,
  BROADCAST_CANCEL: `❌ ${toBoldSans('Cancel')}`,
  SET_QR: `➕ ${toBoldSans('Set QR')}`,
  DELETE_QR: `🗑️ ${toBoldSans('Delete QR')}`,
  BROADCAST: `📢 ${toBoldSans('Broadcast')}`,
  BAN_USER: `🚫 ${toBoldSans('Ban User')}`,
  UNBAN_USER: `✅ ${toBoldSans('Unban User')}`,
  USER_INFO: `ℹ️ ${toBoldSans('User Info')}`,
  ADD_BALANCE: `➕ ${toBoldSans('Add Balance')}`,
  REM_BALANCE: `➖ ${toBoldSans('Remove Bal')}`,
  SET_REF_PCT: `📈 ${toBoldSans('Set Ref %')}`,
  STATISTICS: `📊 ${toBoldSans('Statistics')}`,
  WITHDRAWALS: `🔔 ${toBoldSans('Withdrawals')}`,
};
