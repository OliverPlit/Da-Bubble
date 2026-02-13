import {
  AfterViewInit, ChangeDetectorRef, Component, DestroyRef,
  ElementRef, HostListener, ViewChild, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AddEmojis } from '../../add-emojis/add-emojis';
import { AtMembers } from '../../at-members/at-members';
import type { User as AtMemberUser } from '../../at-members/at-members';

import { CurrentUserService, CurrentUser, AvatarUrlPipe } from '../../../services/current-user.service';
import type { ReactionUserDoc } from '../../../services/messages/messages.types';

import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { PresenceService } from '../../../services/presence.service';

import { ThreadStateService } from '../../../services/thread-state.service';
import type { ThreadContext } from '../../../services/thread-state.types';

import { DateUtilsService, DaySeparated, TimeOfPipe } from '../../../services/date-utils.service';
import { Unsubscribe, Firestore, doc, docData, or } from '@angular/fire/firestore';
import { ChannelStateService } from '../../../main/menu/channels/channel.service';
import { AnchorOverlayService } from '../../../services/anchor-overlay.service';
import { FirebaseService } from '../../../services/firebase';

import { ChannelThreadsStore } from '../../../services/messages/channel-threads.store';
import { DmThreadsStore } from '../../../services/messages/dm-threads.store';

import {
  RootMessage, Reply, Reaction,
  ReactionUser, ReactionPanelState, isEmojiId
} from './threads-messages.types';

@Component({
  selector: 'app-threads-messages',
  imports: [CommonModule, FormsModule, AvatarUrlPipe, TimeOfPipe],
  templateUrl: './threads-messages.html',
  styleUrl: './threads-messages.scss',
})
export class ThreadsMessages implements AfterViewInit {
  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>
  @ViewChild('composerTextarea') composerTextarea!: ElementRef<HTMLTextAreaElement>;

  private destroyRef = inject(DestroyRef);

  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private host = inject(ElementRef<HTMLElement>);
  private emojiSvc = inject(EmojiService);
  public presence = inject(PresenceService);
  private threadStateSvc = inject(ThreadStateService);
  private session = inject(CurrentUserService);
  private dateUtilsSvc = inject(DateUtilsService);
  private channelState = inject(ChannelStateService);
  private anchorOverlaySvc = inject(AnchorOverlayService);
  private firebaseSvc = inject(FirebaseService);
  private cdr = inject(ChangeDetectorRef);

  private channelThreadsStore = inject(ChannelThreadsStore);
  private dmThreadsStore = inject(DmThreadsStore);

  private unsub: Unsubscribe | null = null;

  isSending = false;
  draft = '';
  editForId: string | null = null;
  showEditPanelForId: string | null = null;

  uid = '';
  name = '';
  avatar = '';

  root: RootMessage | null = null;
  replies: Reply[] = [];

  reactionPanel: ReactionPanelState = {
    show: false,
    x: 0,
    y: 0,
    emoji: '',
    title: '',
    subtitle: '',
    messageId: ''
  };

  private hideTimer: any = null;
  private editHideTimer: any = null;

  timeOf = (x: any) => this.dateUtilsSvc.timeOf(x);

  private toAtMember = (m: any): AtMemberUser => {
    const uid = (m?.uid ?? m?.id ?? '').toString();
    return {
      uid,
      name: (m?.name ?? m?.username ?? '').toString(),
      avatar: (m?.avatar ?? '').toString(),
      isYou: uid === this.uid
    };
  };

  private ensureSelf = (list: AtMemberUser[]): AtMemberUser[] =>
    (!this.uid || list.some(u => u.uid === this.uid))
      ? list
      : [...list, { uid: this.uid, name: this.name, avatar: this.avatar, isYou: true }];

  private getMembersFromState = (): AtMemberUser[] => {
    const ch = (this.channelState as any)?.selectedChannel?.()
      ?? (this.channelState as any)?.value
      ?? null;

    const base = (Array.isArray(ch?.members) ? ch.members : [])
      .map(this.toAtMember)
      .filter((u: AtMemberUser) => u.uid && u.name);

    return this.ensureSelf(base);
  };

  private async getMembersFromFirestore(channelId: string): Promise<AtMemberUser[]> {
    if (!this.uid || !channelId) return this.ensureSelf([]);
    const ref = doc(this.firestore, `users/${this.uid}/memberships/${channelId}`);
    const data: any = await firstValueFrom(docData(ref)).catch(() => null);
    const raw = Array.isArray(data?.members) ? data.members : [];
    return this.ensureSelf(raw.map(this.toAtMember).filter((u: AtMemberUser) => u.uid && u.name));
  }

  private getMembersFromContext(ctx: ThreadContext): AtMemberUser[] {
    const out: AtMemberUser[] = [];
    if (this.uid) out.push({ uid: this.uid, name: this.name, avatar: this.avatar, isYou: true });

    const a = ctx?.root?.author;
    if (a?.uid && a?.username && a.uid !== this.uid) {
      out.push({ uid: a.uid, name: a.username, avatar: a.avatar ?? '', isYou: false });
    }
    return out;
  }

  private async resolveMembersWithCtx(ctx: ThreadContext): Promise<AtMemberUser[]> {
    if (ctx.kind === 'channel') {
      const fromState = this.getMembersFromState();
      if (fromState.length) return fromState;

      const fromFs = await this.getMembersFromFirestore(ctx.channelId);
      if (fromFs.length) return fromFs;
    }

    return this.getMembersFromContext(ctx);
  }

  async ngAfterViewInit() {
    await this.session.hydrateFromLocalStorage();
    const u = this.session.getCurrentUser();
    if (u) {
      this.uid = u.uid;
      this.name = u.name;
      this.avatar = u.avatar;
    }

    this.firebaseSvc.currentName$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(name => {
        if (name && name !== this.name) {
          this.name = name;
          this.updateOwnMessagesProfile();
        }
      });

    this.firebaseSvc.currentAvatar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(avatar => {
        if (avatar && avatar !== this.avatar) {
          this.avatar = avatar;
          this.updateOwnMessagesProfile();
        }
      });

    this.threadStateSvc.ctx$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ctx => {
        this.resetThreadView();
        this.unsub?.();
        this.unsub = null;

        if (!ctx) return;

        const createdAt = ctx.root?.createdAt instanceof Date
          ? ctx.root.createdAt
          : new Date(ctx.root?.createdAt ?? Date.now());

        this.root = {
          messageId: ctx.messageId,
          username: ctx.root?.author?.username ?? '',
          avatar: ctx.root?.author?.avatar ?? '',
          isYou: (ctx.root?.author?.uid ?? '') === this.uid,
          createdAt,
          text: ctx.root?.text ?? '',
          reactions: this.mapReactions(ctx.root?.reactions ?? [], this.uid)
        };

        this.unsub = this.listenThreadReplies(ctx);

        queueMicrotask(() => this.scrollToBottom());
      });

    queueMicrotask(() => this.scrollToBottom());
  }

  private resetThreadView() {
    this.replies = [];
    this.root = null;
    this.editForId = null;
    this.showEditPanelForId = null;
    this.draft = '';
    this.cdr.detectChanges();
  }

  private listenThreadReplies(ctx: ThreadContext): Unsubscribe {
    if (ctx.kind === 'channel') {
      return this.channelThreadsStore.listenThreadMessages(
        ctx.uid,
        ctx.channelId,
        ctx.messageId,
        (docs) => {
          this.replies = docs.map(d => ({
            threadMessageId: d.id,
            username: d.author.username,
            avatar: d.author.avatar,
            isYou: d.author.uid === this.uid,
            createdAt: (d.createdAt as any) ?? new Date(),
            text: d.text,
            reactions: this.mapReactions(d.reactions ?? [], this.uid),
          }));

          this.updateOwnMessagesProfile(false);
          queueMicrotask(() => this.scrollToBottom());
        }
      );
    }

    return this.dmThreadsStore.listenThreadMessages(
      ctx.uid,
      ctx.dmId,
      ctx.messageId,
      (docs) => {
        this.replies = docs.map(d => ({
          threadMessageId: d.id,
          username: d.author.username,
          avatar: d.author.avatar,
          isYou: d.author.uid === this.uid,
          createdAt: (d.createdAt as any) ?? new Date(),
          text: d.text,
          reactions: this.mapReactions(d.reactions ?? [], this.uid),
        }));

        this.updateOwnMessagesProfile(false);
        queueMicrotask(() => this.scrollToBottom());
      }
    );
  }

  ngOnDestroy() {
    this.unsub?.();
  }

  private mapReactions(raw: any[], ctxUid: string): Reaction[] {
    return (raw ?? []).map((r: any) => {
      const ru: ReactionUser[] = (r.reactionUsers ?? []).map((u: any) => ({
        userId: u.userId,
        username: u.username
      }));

      const emojiId: EmojiId = isEmojiId(r.emojiId) ? r.emojiId : 'rocket';
      const normalizedUsers = this.normalizeReactionUsers(ru);

      return {
        emojiId,
        emojiCount: Number(r.emojiCount ?? normalizedUsers.length ?? 0),
        youReacted: normalizedUsers.some(u => u.userId === ctxUid),
        reactionUsers: normalizedUsers,
      };
    });
  }

  private normalizeReactionUsers(users: ReactionUser[]): ReactionUser[] {
    if (!this.uid || !this.name) return users;
    return users.map(u => (u.userId === this.uid ? { ...u, username: this.name } : u));
  }

  private normalizeThreadReactions(rx: Reaction[]): Reaction[] {
    return (rx ?? []).map(r => {
      const ru = this.normalizeReactionUsers(r.reactionUsers ?? []);
      return { ...r, reactionUsers: ru, youReacted: ru.some(u => u.userId === this.uid) };
    });
  }

  private updateOwnMessagesProfile(triggerDetect = true) {
    if (this.root) {
      this.root = {
        ...this.root,
        username: this.root.isYou ? this.name : this.root.username,
        avatar: this.root.isYou ? this.avatar : this.root.avatar,
        reactions: this.normalizeThreadReactions(this.root.reactions),
      };
    }

    this.replies = this.replies.map(r => ({
      ...r,
      username: r.isYou ? this.name : r.username,
      avatar: r.isYou ? this.avatar : r.avatar,
      reactions: this.normalizeThreadReactions(r.reactions),
    }));

    if (triggerDetect) this.cdr.detectChanges();
  }

  getEmojiSrc(emojiId: EmojiId | string) {
    return this.emojiSvc.src(emojiId);
  }

  openAddEmojis(trigger: HTMLElement) {
    const ctx = trigger as HTMLElement | null;
    if (!ctx) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, ctx, {
      width: 350,
      height: 100,
      preferredSide: 'top',
      align: 'start',
      offset: 8,
      dialogConfig: { panelClass: 'add-emojis-dialog-panel' }
    }).afterClosed().subscribe((emojiId: string | null) => {
      if (!emojiId || !this.emojiSvc.isValid(emojiId)) return;
      this.draft = this.emojiSvc.appendById(this.draft, emojiId as EmojiId);
    });
  }

  async openAtMembers(trigger: HTMLElement) {
    const ctx = this.threadStateSvc.value;
    if (!ctx) return;

    const members = await this.resolveMembersWithCtx(ctx);

    this.anchorOverlaySvc.openAnchored(this.dialog, AtMembers, trigger, {
      width: 400,
      height: 100,
      preferredSide: 'top',
      align: 'start',
      offset: 400,
      dialogConfig: {
        panelClass: 'at-members-dialog-panel',
        data: {
          channelId: ctx.kind === 'channel' ? ctx.channelId : '',
          currentUserId: ctx.uid,
          members
        }
      }
    }).afterClosed().subscribe(mention => {
      if (!mention) return;
      this.draft = (this.draft || '').trimEnd() + (this.draft ? ' ' : '') + mention + ' ';
    });
  }

  async sendMessage() {
    const ctx = this.threadStateSvc.value;
    const text = this.emojiSvc.normalizeShortcodes((this.draft ?? '').trim());
    if (!ctx || !text) return;

    if (this.isSending) return;
    this.isSending = true;

    try {
      if (this.editForId) {
        if (ctx.kind === 'channel') {
          await this.channelThreadsStore.updateThreadMessage(
            ctx.uid, ctx.channelId, ctx.messageId, this.editForId, text
          );
        } else {
          await this.dmThreadsStore.updateThreadMessageBetween(
            ctx.uid, ctx.peerUid, ctx.dmId, ctx.messageId,
            this.editForId, text
          );
        }

        this.editForId = null;
        this.draft = '';
        this.cdr.detectChanges();
        return;
      }

      const author = { uid: this.uid, username: this.name, avatar: this.avatar };

      if (ctx.kind === 'channel') {
        await this.channelThreadsStore.sendThreadReply(
          ctx.uid, ctx.channelId, ctx.messageId, { text, author }
        );
      } else {

        await this.dmThreadsStore.sendThreadReplyBetween(
          ctx.uid,
          ctx.peerUid,
          ctx.dmId,
          ctx.messageId,
          { text, author }
        );
      }

      this.draft = '';
      this.cdr.detectChanges();
    } finally {
      this.isSending = false;
      this.cdr.detectChanges();
    }
  }

  async toggleReaction(reply: Reply, emojiId: EmojiId) {
    const ctx = this.threadStateSvc.value;
    if (!ctx || !this.uid) return;

    const you: ReactionUserDoc = { userId: this.uid, username: this.name };

    if (ctx.kind === 'channel') {
      await this.channelThreadsStore.toggleThreadReaction(
        ctx.uid, ctx.channelId, ctx.messageId, reply.threadMessageId, emojiId, you
      );
    } else {
      await this.dmThreadsStore.toggleThreadReactionBetween(
        ctx.uid,
        ctx.peerUid,
        ctx.dmId,
        ctx.messageId,
        reply.threadMessageId,
        emojiId,
        you
      );
    }
  }

  async toggleEmojiFromReactions(reply: Reply, event: MouseEvent) {
    const ctx = event.currentTarget as HTMLElement | null;
    if (!ctx) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, ctx, {
      width: 350,
      height: 420,
      preferredSide: 'bottom',
      align: 'end',
      offset: 8,
      dialogConfig: { panelClass: 'add-emojis-dialog-panel' }
    }).afterClosed().subscribe((emojiId: string | null) => {
      if (emojiId && this.emojiSvc.isValid(emojiId)) {
        this.toggleReaction(reply, emojiId as EmojiId);
      }
    });
  }

  async toggleEmojiFromReactionBar(reply: Reply, event: MouseEvent) {
    const ctx = event.currentTarget as HTMLElement | null;
    if (!ctx) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, ctx, {
      width: 350,
      height: 420,
      preferredSide: 'bottom',
      align: 'start',
      offset: 8,
      dialogConfig: { panelClass: 'add-emojis-dialog-panel' }
    }).afterClosed().subscribe((emojiId: string | null) => {
      if (emojiId && this.emojiSvc.isValid(emojiId)) {
        this.toggleReaction(reply, emojiId as EmojiId);
      }
    });
  }

  showReactionPanelRoot(r: Reaction, event: MouseEvent) {
    if (!this.root) return;

    const element = event.currentTarget as HTMLElement;
    const host = element.closest('.thread-root') as HTMLElement;
    if (!host) return;

    const reactionRect = element.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = reactionRect.left - hostRect.left + 40;
    const y = reactionRect.top - hostRect.top - 110;

    const names = r.reactionUsers.map(u => u.username);
    const youReacted = r.reactionUsers.some(u => u.userId === this.uid);
    const otherUsers = r.reactionUsers.filter(u => u.userId !== this.uid).map(u => u.username);

    let title = '';
    if (youReacted && names.length > 0) {
      title = otherUsers.length ? `${otherUsers.slice(0, 2).join(' und ')} und Du` : 'Du';
    } else if (names.length) {
      title = names.slice(0, 2).join(' und ');
    }

    const subtitle = r.reactionUsers.length > 1 ? 'haben reagiert' : 'hat reagiert';

    this.reactionPanel = {
      show: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      emoji: this.getEmojiSrc(r.emojiId),
      title,
      subtitle,
      messageId: this.root.messageId,
    };

    this.cdr.detectChanges();
  }

  showReactionPanel(reply: Reply, r: Reaction, event: MouseEvent) {
    const element = event.currentTarget as HTMLElement;
    const host = element.closest('.reply') as HTMLElement;
    if (!host) return;

    const reactionRect = element.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = reactionRect.left - hostRect.left + 40;
    const y = reactionRect.top - hostRect.top - 110;

    const names = r.reactionUsers.map(u => u.username);
    const youReacted = r.reactionUsers.some(u => u.userId === this.uid);

    let title = '';
    if (youReacted && names.length > 0) {
      const other = names.filter(n => n !== this.name);
      title = other.length ? `${other.slice(0, 2).join(' und ')} und Du` : 'Du';
    } else if (names.length) {
      title = names.slice(0, 2).join(' und ');
    }

    const subtitle = r.reactionUsers.length > 1 ? 'haben reagiert' : 'hat reagiert';

    this.reactionPanel = {
      show: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      emoji: this.getEmojiSrc(r.emojiId),
      title,
      subtitle,
      messageId: reply.threadMessageId,
    };

    this.cdr.detectChanges();
  }

  toggleEditMessagePanel(reply: Reply, ev: MouseEvent) {
    ev.stopPropagation();
    this.clearEditMessagePanelHide();
    this.showEditPanelForId = this.showEditPanelForId === reply.threadMessageId ? null : reply.threadMessageId;
    this.cdr.detectChanges();
  }

  scheduleEditMessagePanelHide(reply: Reply) {
    if (this.showEditPanelForId !== reply.threadMessageId) return;
    this.clearEditMessagePanelHide();
    this.editHideTimer = setTimeout(() => {
      this.showEditPanelForId = null;
      this.cdr.detectChanges();
    });
  }

  cancelEditMessagePanelHide(_: Reply) {
    this.clearEditMessagePanelHide();
  }

  private clearEditMessagePanelHide() {
    if (this.editHideTimer) {
      clearTimeout(this.editHideTimer);
      this.editHideTimer = null;
    }
  }

  editMessage(reply: Reply, ev: MouseEvent) {
    ev.stopPropagation();
    if (!reply.isYou) return;
    this.editForId = reply.threadMessageId;
    this.showEditPanelForId = null;
    this.draft = reply.text;
    this.cdr.detectChanges();
    queueMicrotask(() => this.composerTextarea?.nativeElement.focus());
  }

  clearReactionPanelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  scheduleReactionPanelHide(delay = 120) {
    this.clearReactionPanelHide();
    this.hideTimer = setTimeout(() => {
      this.reactionPanel.show = false;
      this.reactionPanel.messageId = '';
      this.cdr.detectChanges();
    }, delay);
  }

  cancelReactionPanelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.editForId = null;
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEsc() {
    this.editForId = null;
    this.cdr.detectChanges();
  }

  private scrollToBottom() {
    const el = this.scrollArea?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}