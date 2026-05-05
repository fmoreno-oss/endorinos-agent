export interface MessageData {
  whatsappMessageId: string;
  senderJid: string;
  senderName: string;
  content: string;
  messageType: string;
  sentAt: Date;
}

export interface MemberStats {
  displayName: string;
  messageCount: number;
  lastMessageAt: Date | null;
  daysSinceLastMessage: number | null;
}
