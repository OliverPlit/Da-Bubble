import type { EmojiId } from './emoji.service';

export type ThreadContext = ChannelThreadContext | DmThreadContext;

export type BaseThreadContext = {
    uid: string;
    messageId: string;
    root: ThreadRoot;
};

export type ThreadRoot = {
    author: { uid: string; username: string; avatar: string };
    createdAt: any;
    text: string;
    reactions: Reaction[];
    isYou?: boolean;
};

export type Reaction = {
    emojiId: EmojiId | string;
    emojiCount: number;
    youReacted?: boolean;
    reactionUsers: ReactionUser[];
};

export type ReactionUser = {
    userId: string;
    username: string;
};

export type ChannelThreadContext = BaseThreadContext & {
    kind: 'channel';
    channelId: string;
    channelName: string;
};

export type DmThreadContext = BaseThreadContext & {
    kind: 'directMessage';
    dmId: string;
    peerUid: string;
    dmName: string;
};