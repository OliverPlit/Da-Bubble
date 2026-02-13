import type { EmojiId } from "../../../services/emoji.service";

export type RootMessage = {
  messageId: string;
  username: string;
  avatar: string;
  isYou: boolean;
  createdAt: string | Date;
  text: string;
  reactions: Reaction[];
};

export type Reply = {
  threadMessageId: string;
  username: string;
  avatar: string;
  isYou: boolean;
  createdAt: string | Date;
  text: string;
  reactions: Reaction[];
};

export type Reaction = {
  emojiId: EmojiId;
  emojiCount: number;
  youReacted: boolean;
  reactionUsers: ReactionUser[];
};

export type ReactionUser = {
  userId: string;
  username: string;
};

export type ReactionPanelState = {
  show: boolean;
  x: number;
  y: number;
  emoji: string;
  title: string;
  subtitle: string;
  messageId: string;
};

export function isEmojiId(x: unknown): x is EmojiId {
  return x === 'rocket' || x === 'check' || x === 'nerd' || x === 'thumbs_up';
}