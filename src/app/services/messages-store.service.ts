import { Injectable, inject, NgZone } from '@angular/core';
import {
    Firestore, collection, doc, addDoc, serverTimestamp,
    query, orderBy, onSnapshot, runTransaction, writeBatch, getDoc, updateDoc, increment
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
    private firestore = inject(Firestore);
    private zone = inject(NgZone);

    // Collection: users/{uid}/messages/channels/{channelId}
    private channelMsgsCol(uid: string, channelId: string) {
        return collection(this.firestore, `users/${uid}/messages/channels/${channelId}`);
    }

    // Doc: users/{uid}/messages/channels/{channelId}/{messageId}
    private channelMsgDoc(uid: string, channelId: string, messageId: string) {
        return doc(this.firestore, `users/${uid}/messages/channels/${channelId}/${messageId}`);
    }

    // Collection: users/${uid}/messages/channels/${channelId}/${messageId}/threads
    private threadMsgsCol(uid: string, channelId: string, messageId: string) {
        return collection(this.firestore, `users/${uid}/messages/channels/${channelId}/${messageId}/threads`);
    }

    // Doc: users/${uid}/messages/channels/${channelId}/${messageId}/threads/${threadMessageId}
    private threadMsgDoc(uid: string, channelId: string, messageId: string, threadMessageId: string) {
        return doc(this.firestore, `users/${uid}/messages/channels/${channelId}/${messageId}/threads/${threadMessageId}`);
    }

    // Collection: users/{uid}/messages/directMessages/{dmId}
    private dmMsgsCol(uid: string, dmId: string) {
        return collection(this.firestore, `users/${uid}/messages/directMessages/${dmId}`);
    }

    // Doc: users/{uid}/messages/directMessages/{dmId}/{messageId}
    private dmMsgDoc(uid: string, dmId: string, messageId: string) {
        return doc(this.firestore, `users/${uid}/messages/directMessages/${dmId}/${messageId}`);
    }



    /*
    private async getChannelMemberUids(ownerUid: string, channelId: string): Promise<string[]> {
        const membershipRef = doc(this.firestore, `users/${ownerUid}/memberships/${channelId}`);
        const snap = await getDoc(membershipRef);
        const members = (snap.exists() ? (snap.data() as any)?.members : []) || [];
        const uids = members
            .map((m: any) => m?.uid || m?.id)
            .filter((x: string) => !!x);

        if (!uids.includes(ownerUid)) uids.push(ownerUid);

        return Array.from(new Set(uids));
    }
    */


    private membershipDoc(uid: string, channelId: string) {
        return doc(this.firestore, `users/${uid}/memberships/${channelId}`);
    }

    private async getMemberUids(uid: string, channelId: string): Promise<string[]> {
        const snap = await getDoc(this.membershipDoc(uid, channelId));

        if (!snap.exists()) return [uid];

        const data: any = snap.data();
        const memberUids: string[] = (data.members ?? [])
            .map((m: any) => m.uid || m.id)
            .filter((x: string) => !!x);

        if (!memberUids.includes(uid)) memberUids.push(uid);

        return Array.from(new Set(memberUids));
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

    listenThreadMessages(
        uid: string,
        channelId: string,
        messageId: string,
        cb: (msgs: (MessageDoc & { id: string })[]) => void
    ): Unsubscribe {
        const qy = query(this.threadMsgsCol(uid, channelId, messageId), orderBy('createdAt', 'asc'));
        return onSnapshot(qy, snap => {
            this.zone.run(() => {
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
        const memberUids = await this.getMemberUids(uid, channelId);

        const id = doc(this.channelMsgsCol(uid, channelId)).id;

        const payload: MessageDoc = {
            text: params.text,
            createdAt: serverTimestamp(),
            author: params.author,
            reactions: [],
            repliesCount: 0,
            lastReplyTime: null
        };

        const MAX = 500;
        let batch = writeBatch(this.firestore);
        let count = 0;

        for (const uid of memberUids) {
            const ref = this.channelMsgDoc(uid, channelId, id);
            batch.set(ref, payload, { merge: false });
            if (++count >= MAX) { await batch.commit(); batch = writeBatch(this.firestore); count = 0; }
        }
        if (count) await batch.commit();

        return id;

        /*
        await addDoc(this.channelMsgsCol(uid, channelId), {
            text: params.text,
            createdAt: serverTimestamp(),
            author: params.author,
            reactions: [],
            repliesCount: 0,
            lastReplyTime: null
        } satisfies MessageDoc);
        */
    }

    async updateChannelMessage(uid: string, channelId: string, messageId: string, text: string) {
        const memberUids = await this.getMemberUids(uid, channelId);

        const MAX = 500;
        let batch = writeBatch(this.firestore);
        let count = 0;

        for (const uid of memberUids) {
            const ref = this.channelMsgDoc(uid, channelId, messageId);
            batch.update(ref, { text: text });
            if (++count >= MAX) { await batch.commit(); batch = writeBatch(this.firestore); count = 0; }
        }
        if (count) await batch.commit();


        /*
        const ref = this.channelMsgDoc(uid, channelId, messageId);
        await updateDoc(ref, {
            text,
            // optional, wenn du "bearbeitet" anzeigen willst:
            // editedAt: serverTimestamp(),
            // edited: true,
        });
        */
    }

    async toggleChannelReaction(uid: string, channelId: string, messageId: string, emojiId: string, you: ReactionUserDoc) {
        const memberUids = await this.getMemberUids(uid, channelId);

        let nextReactions: ReactionDoc[] = [];

        await runTransaction(this.firestore, async tx => {
            const ownerRef = this.channelMsgDoc(uid, channelId, messageId);
            const snap = await tx.get(ownerRef);
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

            nextReactions = data.reactions;

            tx.update(ownerRef, { reactions: nextReactions });
        });

        const MAX = 500;
        let batch = writeBatch(this.firestore);
        let count = 0;

        for (const uid of memberUids) {
            const ref = this.channelMsgDoc(uid, channelId, messageId);
            batch.set(ref, { reactions: nextReactions }, { merge: true });
            if (++count >= MAX) { await batch.commit(); batch = writeBatch(this.firestore); count = 0; }
        }
        if (count) await batch.commit();

        /*
        // const ref = this.channelMsgDoc(uid, channelId, messageId);
        await runTransaction(this.firestore, async tx => {
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
        */
    }



    async sendThreadReply(
        uid: string,
        channelId: string,
        messageId: string,
        params: { text: string; author: { uid: string; username: string; avatar: string } }
    ) {
        const memberUids = await this.getMemberUids(uid, channelId);
        if (!memberUids.length) return;

        const threadMessageId = doc(this.threadMsgsCol(uid, channelId, messageId)).id;

        const payload: MessageDoc = {
            text: params.text,
            createdAt: serverTimestamp(),
            author: params.author,
            reactions: [],
            repliesCount: 0,
            lastReplyTime: null
        };

        {
            const MAX = 500;
            let batch = writeBatch(this.firestore);
            let count = 0;

            for (const uid of memberUids) {
                const threadRef = this.threadMsgDoc(uid, channelId, messageId, threadMessageId);
                batch.set(threadRef, payload, { merge: false });

                if (++count >= MAX) { await batch.commit(); batch = writeBatch(this.firestore); count = 0; }
            }

            if (count) await batch.commit();
        }

        {
            const MAX = 500;
            let batch = writeBatch(this.firestore);
            let count = 0;

            for (const uid of memberUids) {
                const messageRef = this.channelMsgDoc(uid, channelId, messageId);
                batch.set(messageRef, {
                    repliesCount: increment(1),
                    lastReplyTime: serverTimestamp()
                } as any, { merge: true });

                if (++count >= MAX) { await batch.commit(); batch = writeBatch(this.firestore); count = 0; }
            }

            if (count) await batch.commit();
        }


        /*
        await addDoc(this.threadMsgsCol(uid, channelId, messageId), {
            text: params.text,
            createdAt: serverTimestamp(),
            author: params.author,
            reactions: [],
            repliesCount: 0,
            lastReplyTime: null
        } satisfies MessageDoc);

        const rootRef = this.channelMsgDoc(uid, channelId, messageId);
        await runTransaction(this.firestore, async tx => {
            const snap = await tx.get(rootRef);
            if (!snap.exists()) return;
            const data = snap.data() as MessageDoc;
            const nextCount = Math.max(0, Number(data.repliesCount ?? 0) + 1);
            tx.update(rootRef, {
                repliesCount: nextCount,
                lastReplyTime: serverTimestamp()
            });
        });
        */
    }

    /*
    async sendThreadReplyForAll(
        memberUids: string[],
        channelId: string,
        messageId: string,
        params: { text: string; author: { uid: string; username: string; avatar: string } }
    ) {
        if (!memberUids.length) return;

        const threadMessageRef = doc(this.threadMsgsCol(memberUids[0], channelId, messageId));
        const threadMessageId = threadMessageRef.id;

        {
            const batch = writeBatch(this.firestore);
            for (const uid of memberUids) {
                const ref = this.threadMsgDoc(uid, channelId, messageId, threadMessageId);
                batch.set(ref, {
                    text: params.text,
                    createdAt: serverTimestamp(),
                    author: params.author,
                    reactions: [],
                    repliesCount: 0,
                    lastReplyTime: null
                } satisfies MessageDoc, { merge: false });
            }
            await batch.commit();
        }

        {
            const updates = memberUids.map(uid =>
                runTransaction(this.firestore, async tx => {
                    const rootRef = this.channelMsgDoc(uid, channelId, messageId);
                    const snap = await tx.get(rootRef);
                    if (!snap.exists()) return;
                    const data = snap.data() as MessageDoc;
                    const nextCount = Math.max(0, Number(data.repliesCount ?? 0) + 1);
                    tx.update(rootRef, {
                        repliesCount: nextCount,
                        lastReplyTime: serverTimestamp()
                    });
                })
            );
            await Promise.all(updates);
        }
    }
    */

    async updateThreadMessage(uid: string, channelId: string, messageId: string, newText: string) {
        const ref = this.channelMsgDoc(uid, channelId, messageId);
        await runTransaction(this.firestore, async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as MessageDoc;
            tx.update(ref, { text: newText });
        });
    }


    async toggleThreadReaction(
        uid: string,
        channelId: string,
        messageId: string,
        threadMessageId: string,
        emojiId: string,
        you: ReactionUserDoc
    ) {
        const ref = this.threadMsgDoc(uid, channelId, messageId, threadMessageId);
        await runTransaction(this.firestore, async tx => {
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

    async toggleThreadReactionForAll(
        memberUids: string[],
        channelId: string,
        messageId: string,
        threadMessageId: string,
        emojiId: string,
        you: ReactionUserDoc
    ) {
        await Promise.all(memberUids.map(uid =>
            this.toggleThreadReaction(uid, channelId, messageId, threadMessageId, emojiId, you)
        ));
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



    async toggleDirectReaction(
        uid: string,
        dmId: string,
        messageId: string,
        emojiId: string,
        you: ReactionUserDoc
    ) {
        const ref = this.dmMsgDoc(uid, dmId, messageId);
        await runTransaction(this.firestore, async tx => {
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