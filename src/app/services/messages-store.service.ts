import { Injectable, inject } from '@angular/core';
import {
    Firestore, collection, doc, addDoc, serverTimestamp,
    query, orderBy, onSnapshot, runTransaction
} from '@angular/fire/firestore';
import { Timestamp, Unsubscribe } from '@angular/fire/firestore';

export type MessageDoc = {
    text: string;
    createdAt: any;
    author: { uid: string; username: string; avatar: string };
    reactions: ReactionDoc[];
    repliesCount: number;
    lastReplyTime?: any | null;
};

export type ReactionDoc = {
    emojiId: string;
    emojiCount: number;
    reactionUsers: ReactionUserDoc[];
    youReacted?: boolean;
};

export type ReactionUserDoc = {
    userId: string;
    username: string;
};

@Injectable({ providedIn: 'root' })
export class MessagesStoreService {
    private fs = inject(Firestore);

    // Collection: users/{uid}/messages/channels/{channelId}
    private channelMsgsCol(uid: string, channelId: string) {
        return collection(this.fs, `users/${uid}/messages/channels/${channelId}`);
    }

    // Doc: users/{uid}/messages/channels/{channelId}/{messageId}
    private channelMsgDoc(uid: string, channelId: string, messageId: string) {
        return doc(this.fs, `users/${uid}/messages/channels/${channelId}/${messageId}`);
    }

    // Collection: users/{uid}/messages/directMessages/{dmId}
    private dmMsgsCol(uid: string, dmId: string) {
        return collection(this.fs, `users/${uid}/messages/directMessages/${dmId}`);
    }

    // Doc: users/{uid}/messages/directMessages/{dmId}/{messageId}
    private dmMsgDoc(uid: string, dmId: string, messageId: string) {
        return doc(this.fs, `users/${uid}/messages/directMessages/${dmId}/${messageId}`);
    }

    listenChannelMessages(
        uid: string,
        channelId: string,
        cb: (msgs: (MessageDoc & { id: string })[]) => void
    ): Unsubscribe {
        const qy = query(this.channelMsgsCol(uid, channelId), orderBy('createdAt', 'asc'));
        return onSnapshot(qy, snap => {
            const out = snap.docs.map(d => {
                const data = d.data() as MessageDoc;
                return {
                    ...data,
                    id: d.id,
                    createdAt: this.toDate(data.createdAt),
                    lastReplyTime: data.lastReplyTime ? this.toDate(data.lastReplyTime) : undefined
                };
            });
            cb(out);
        });
    }

    listenDirectMessages(
        uid: string,
        dmId: string,
        cb: (msgs: (MessageDoc & { id: string })[]) => void
    ): Unsubscribe {
        const qy = query(this.dmMsgsCol(uid, dmId), orderBy('createdAt', 'asc'));
        return onSnapshot(qy, snap => {
            const out = snap.docs.map(d => {
                const data = d.data() as MessageDoc;
                return {
                    ...data,
                    id: d.id,
                    createdAt: this.toDate(data.createdAt),
                    lastReplyTime: data.lastReplyTime ? this.toDate(data.lastReplyTime) : undefined
                };
            });
            cb(out);
        });
    }

    async sendChannelMessage(
        uid: string,
        channelId: string,
        params: { text: string; author: { uid: string; username: string; avatar: string } }
    ) {
        await addDoc(this.channelMsgsCol(uid, channelId), {
            text: params.text,
            createdAt: serverTimestamp(),
            author: params.author,
            reactions: [],
            repliesCount: 0,
            lastReplyTime: null
        } satisfies MessageDoc);
    }

    async sendDirectMessage(
        uid: string,
        dmId: string,
        params: { text: string; author: { uid: string; username: string; avatar: string } }
    ) {
        await addDoc(this.dmMsgsCol(uid, dmId), {
            text: params.text,
            createdAt: serverTimestamp(),
            author: params.author,
            reactions: [],
            repliesCount: 0,
            lastReplyTime: null
        } satisfies MessageDoc);
    }

    async toggleChannelReaction(
        uid: string,
        channelId: string,
        messageId: string,
        emojiId: string,
        you: ReactionUserDoc
    ) {
        const ref = this.channelMsgDoc(uid, channelId, messageId);
        await runTransaction(this.fs, async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as MessageDoc;
            data.reactions ||= [];

            const idx = data.reactions.findIndex(r => r.emojiId === emojiId);
            if (idx >= 0) {
                const rx = data.reactions[idx];
                const youIdx = rx.reactionUsers.findIndex(u => u.userId === you.userId);
                if (youIdx >= 0) {
                    rx.reactionUsers.splice(youIdx, 1);
                    rx.emojiCount = Math.max(0, rx.emojiCount - 1);
                    if (rx.emojiCount === 0 || rx.reactionUsers.length === 0) {
                        data.reactions.splice(idx, 1);
                    }
                } else {
                    rx.reactionUsers.push(you);
                    rx.emojiCount += 1;
                }
            } else {
                data.reactions.push({ emojiId, emojiCount: 1, reactionUsers: [you] });
            }
            tx.update(ref, { reactions: data.reactions });
        });
    }

    async toggleDirectReaction(
        uid: string,
        dmId: string,
        messageId: string,
        emojiId: string,
        you: ReactionUserDoc
    ) {
        const ref = this.dmMsgDoc(uid, dmId, messageId);
        await runTransaction(this.fs, async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as MessageDoc;
            data.reactions ||= [];

            const idx = data.reactions.findIndex(r => r.emojiId === emojiId);
            if (idx >= 0) {
                const rx = data.reactions[idx];
                const youIdx = rx.reactionUsers.findIndex(u => u.userId === you.userId);
                if (youIdx >= 0) {
                    rx.reactionUsers.splice(youIdx, 1);
                    rx.emojiCount = Math.max(0, rx.emojiCount - 1);
                    if (rx.emojiCount === 0 || rx.reactionUsers.length === 0) {
                        data.reactions.splice(idx, 1);
                    }
                } else {
                    rx.reactionUsers.push(you);
                    rx.emojiCount += 1;
                }
            } else {
                data.reactions.push({ emojiId, emojiCount: 1, reactionUsers: [you] });
            }
            tx.update(ref, { reactions: data.reactions });
        });
    }

    private toDate(x: any): Date {
        if (x instanceof Date) return x;
        if (x && typeof x.toDate === 'function') return (x as Timestamp).toDate();
        return new Date(x);
    }
}