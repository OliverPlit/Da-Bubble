import { Component, ElementRef, HostListener, inject, AfterViewInit, ViewChild, Input, OnDestroy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../../../shared/add-emojis/add-emojis';
import { AtMembers } from '../../../shared/at-members/at-members';
import type { User as AtMemberUser } from '../../../shared/at-members/at-members';
import { CurrentUserService, CurrentUser } from '../../../services/current-user.service';
// import { MessagesStoreService, MessageDoc, ReactionUserDoc } from '../../../services/messages-store.service';
import { MessageDoc, ReactionUserDoc } from '../../../services/messages/messages.types';
import { ChannelThreadsStore } from '../../../services/messages/channel-threads.store';
import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { PresenceService } from '../../../services/presence.service';
import { ThreadStateService } from '../../../services/thread-state.service';
import type { ChannelThreadContext } from '../../../services/thread-state.types';
import { DateUtilsService, DaySeparated } from '../../../services/date-utils.service';
import { Unsubscribe, Firestore, doc, docData, or } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { AnchorOverlayService } from '../../../services/anchor-overlay.service';
import { FirebaseService } from '../../../services/firebase';
import { ChangeDetectorRef } from '@angular/core';

type RootMessage = {
  messageId: string;
  username: string;
  avatar: string;
  isYou: boolean;
  createdAt: string | Date;
  text: string;
  reactions: Reaction[];
};

type Reply = {
  threadMessageId: string;
  username: string;
  avatar: string;
  isYou: boolean;
  createdAt: string | Date;
  text: string;
  reactions: Reaction[];
};

type Reaction = {
  emojiId: EmojiId;
  emojiCount: number;
  youReacted: boolean;
  reactionUsers: ReactionUser[];
};

type ReactionUser = {
  userId: string;
  username: string;
};

type ReactionPanelState = {
  show: boolean;
  x: number;
  y: number;
  emoji: string;
  title: string;
  subtitle: string;
  messageId: string;
};

function isEmojiId(x: unknown): x is EmojiId {
  return x === 'rocket' || x === 'check' || x === 'nerd' || x === 'thumbs_up';
}

@Component({
  selector: 'app-messades-threads',
  imports: [CommonModule, FormsModule],
  templateUrl: './messades-threads.html',
  styleUrls: ['./messades-threads.scss'],
})
export class MessadesThreads implements AfterViewInit, OnDestroy {
  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') composerTextarea!: ElementRef<HTMLTextAreaElement>;

  @Input() uid!: string;
  @Input() channelId!: string;
  @Input() channelName = '';

  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private hideTimer: any = null;
  private editHideTimer: any = null;
  private host = inject(ElementRef<HTMLElement>);
  private emojiSvc = inject(EmojiService);
  public presence = inject(PresenceService);
  // private messageStoreSvc = inject(MessagesStoreService);
  private channelThreadsStoreSvc = inject(ChannelThreadsStore);
  private threadStateSvc = inject(ThreadStateService);
  private session = inject(CurrentUserService);
  private dateUtilsSvc = inject(DateUtilsService);
  private unsub: Unsubscribe | null = null;
  private channelState = inject(ChannelStateService);
  private anchorOverlaySvc = inject(AnchorOverlayService);
  private firebaseSvc = inject(FirebaseService);
  private cdr = inject(ChangeDetectorRef);

  private toAtMember = (m: any): AtMemberUser => {
    const uid = m?.uid ?? m?.id ?? '';
    return {
      uid,
      name: m?.name ?? m?.username ?? '',
      avatar: m?.avatar ?? '',
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

  private async getMembersFromFirestore(): Promise<AtMemberUser[]> {
    if (!this.uid || !this.channelId) return this.ensureSelf([]);
    const ref = doc(this.firestore, `users/${this.uid}/memberships/${this.channelId}`);
    const data: any = await firstValueFrom(docData(ref)).catch(() => null);
    const raw = Array.isArray(data?.members) ? data.members : [];
    return this.ensureSelf(raw.map(this.toAtMember).filter((u: AtMemberUser) => u.uid && u.name));
  }

  private getMembersFromContext(ctx: any): AtMemberUser[] {
    const out: AtMemberUser[] = [];
    if (this.uid) out.push({ uid: this.uid, name: this.name, avatar: this.avatar, isYou: true });
    const a = ctx?.root?.author;
    if (a?.uid && a?.username && a.uid !== this.uid) {
      out.push({ uid: a.uid, name: a.username, avatar: a.avatar ?? '', isYou: false });
    }
    return out;
  }

  private async resolveMembersWithCtx(ctx: any): Promise<AtMemberUser[]> {
    const fromState = this.getMembersFromState();
    if (fromState.length) return fromState;
    const fromFs = await this.getMembersFromFirestore();
    if (fromFs.length) return fromFs;
    return this.getMembersFromContext(ctx);
  }

  isSending = false;
  draft = '';
  editForId: string | null = null;
  showEditPanelForId: string | null = null;
  root!: RootMessage;
  replies: Reply[] = [];

  name = '';
  avatar = '';

  reactionPanel: ReactionPanelState = {
    show: false,
    x: 0,
    y: 0,
    emoji: '',
    title: '',
    subtitle: '',
    messageId: ''
  };

  timeOf = (x: any) => this.dateUtilsSvc.timeOf(x);

  async ngAfterViewInit() {
    await this.session.hydrateFromLocalStorage();
    const u = this.session.getCurrentUser();
    if (u) {
      this.uid = u.uid;
      this.name = u.name;
      this.avatar = u.avatar;
    }

    // Fokus auf Antwort-Eingabefeld beim Öffnen des Threads (verzögert, damit View bereit ist)
    setTimeout(() => this.focusComposer(), 100);

    // Subscribe to profile changes
    this.firebaseSvc.currentName$.subscribe(name => {
      if (name && name !== this.name) {
        this.name = name;
        this.updateOwnMessagesProfile();
      }
    });

    this.firebaseSvc.currentAvatar$.subscribe(avatar => {
      if (avatar && avatar !== this.avatar) {
        this.avatar = avatar;
        this.updateOwnMessagesProfile();
      }
    });

    this.threadStateSvc.ctx$.subscribe(ctx => {
      this.replies = [];
      this.unsub?.();
      this.unsub = null;
      if (!ctx || ctx.kind !== 'channel') return;
      const chCtx = ctx as ChannelThreadContext;

      const createdAt = ctx.root?.createdAt instanceof Date
        ? ctx.root?.createdAt
        : new Date(ctx.root?.createdAt ?? Date.now());

      const rootReactions: Reaction[] = (ctx.root?.reactions ?? []).map((r: any) => {
        const users = (r.reactionUsers ?? []).map((u: any) => ({ userId: u.userId, username: u.username }));
        const emojiId: EmojiId = isEmojiId(r.emojiId) ? r.emojiId : 'rocket';
        return {
          emojiId,
          emojiCount: Number(r.emojiCount ?? users.length ?? 0),
          youReacted: users.some((u: any) => u.userId === this.uid),
          reactionUsers: users,
        };
      });

      this.root = {
        messageId: ctx.messageId,
        username: ctx.root?.author?.username ?? '',
        avatar: ctx.root?.author?.avatar ?? '',
        isYou: (ctx.root?.author?.uid ?? '') === ctx.uid,
        createdAt,
        text: ctx.root?.text ?? '',
        reactions: rootReactions,
      };

      this.cdr.detectChanges();
      setTimeout(() => this.focusComposer(), 100);

      this.unsub = this.channelThreadsStoreSvc.listenThreadMessages(
        chCtx.uid, chCtx.channelId, chCtx.messageId,
        (docs) => {
          this.replies = docs.map(d => {
            const users = (d.reactions ?? []).flatMap(r => r.reactionUsers ?? []);
            return {
              threadMessageId: d.id,
              username: d.author.username,
              avatar: d.author.avatar,
              isYou: d.author.uid === ctx.uid,
              createdAt: (d.createdAt as any) ?? new Date(),
              text: d.text,
              reactions: (d.reactions ?? []).map(r => {
                const ru = (r.reactionUsers ?? []).map(u => ({ userId: u.userId, username: u.username }));
                const emojiId: EmojiId = isEmojiId(r.emojiId) ? r.emojiId : 'rocket';
                return {
                  emojiId,
                  emojiCount: Number(r.emojiCount ?? ru.length ?? 0),
                  youReacted: ru.some(u => u.userId === ctx.uid),
                  reactionUsers: ru,
                };
              }),
            } as Reply;
          });
          queueMicrotask(() => this.scrollToBottom());
        }
      );
    });

    queueMicrotask(() => this.scrollToBottom());
  };

  ngOnDestroy() { this.unsub?.(); }

  /** Fokus auf das Antwort-Eingabefeld beim Öffnen des Threads. */
  private focusComposer() {
    this.composerTextarea?.nativeElement?.focus();
  }

  private updateOwnMessagesProfile() {
    if (this.root) {
      const rootIsMine = this.root.isYou;
      this.root = {
        ...this.root,
        username: rootIsMine ? this.name : this.root.username,
        avatar: rootIsMine ? this.avatar : this.root.avatar,
        reactions: this.normalizeThreadReactions(this.root.reactions),
      };
    }

    this.replies = this.replies.map(r => ({
      ...r,
      username: r.isYou ? this.name : r.username,
      avatar: r.isYou ? this.avatar : r.avatar,
      reactions: this.normalizeThreadReactions(r.reactions),
    }));

    this.cdr.detectChanges();
  }

  getEmojiSrc(emojiId: EmojiId | string) {
    return this.emojiSvc.src(emojiId);
  }

  openAddEmojis(trigger: HTMLElement) {
    const origin = trigger as HTMLElement | null;
    if (!origin) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, origin, {
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
    const origin = this.threadStateSvc.value;
    if (!origin || origin.kind !== 'channel') return;
    const chOrigin = origin as ChannelThreadContext;
    const members = await this.resolveMembersWithCtx(origin);

    this.anchorOverlaySvc.openAnchored(this.dialog, AtMembers, trigger, {
      width: 400,
      height: 100,
      preferredSide: 'top',
      align: 'start',
      offset: 400,
      dialogConfig: {
        panelClass: 'at-members-dialog-panel',
        data: {
          channelId: chOrigin.channelId,
          currentUserId: origin.uid,
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
    if (!ctx || ctx.kind !== 'channel' || !text) return;
    const chCtx = ctx as ChannelThreadContext;

    if (this.isSending) return;
    this.isSending = true;

    try {
      if (this.editForId) {
        await this.channelThreadsStoreSvc
          .updateThreadMessage(chCtx.uid, chCtx.channelId, chCtx.messageId, this.editForId, text)
          .then(() => {
            this.editForId = null;
            this.draft = '';
          });
        return;
      }

      const author = { uid: this.uid, username: this.name, avatar: this.avatar };
      await this.channelThreadsStoreSvc.sendThreadReply(chCtx.uid, chCtx.channelId, chCtx.messageId, { text, author });
      this.draft = '';
    } finally {
      this.isSending = false;
    }
  }

  async toggleReaction(reply: Reply, emojiId: EmojiId) {
    const ctx = this.threadStateSvc.value;
    if (!ctx || ctx.kind !== 'channel' || !this.uid) return;
    const chCtx = ctx as ChannelThreadContext;

    const you: ReactionUserDoc = { userId: this.uid, username: this.name };
    await this.channelThreadsStoreSvc.toggleThreadReaction(
      chCtx.uid,
      chCtx.channelId,
      chCtx.messageId,
      reply.threadMessageId,
      emojiId,
      you
    );
  }

  async toggleEmojiFromReactions(reply: Reply, event: MouseEvent) {
    const origin = event.currentTarget as HTMLElement | null;
    if (!origin) return;

    const isYou = reply.isYou;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, origin, {
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
    const origin = event.currentTarget as HTMLElement | null;
    if (!origin) return;

    const isYou = reply.isYou;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, origin, {
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
    const element = event.currentTarget as HTMLElement;
    const host = element.closest('.thread-root') as HTMLElement;
    if (!host) return;

    const reactionRect = element.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = reactionRect.left - hostRect.left + 40;
    const y = reactionRect.top - hostRect.top - 110;

    const names = r.reactionUsers.map(u => u.username);
    const youReacted = r.reactionUsers.some(u => u.userId === this.uid);
    const otherUsers = r.reactionUsers
      .filter(u => u.userId !== this.uid)
      .map(u => u.username);

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
    }, delay);
  }

  cancelReactionPanelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  toggleEditMessagePanel(reply: Reply, ev: MouseEvent) {
    ev.stopPropagation();
    this.clearEditMessagePanelHide();
    this.showEditPanelForId = this.showEditPanelForId === reply.threadMessageId ? null : reply.threadMessageId;
  }

  scheduleEditMessagePanelHide(reply: Reply) {
    if (this.showEditPanelForId !== reply.threadMessageId) return;
    this.clearEditMessagePanelHide();
    this.editHideTimer = setTimeout(() => { this.showEditPanelForId = null; });
  }

  cancelEditMessagePanelHide(_: Reply) { this.clearEditMessagePanelHide(); }
  private clearEditMessagePanelHide() {
    if (this.editHideTimer) { clearTimeout(this.editHideTimer); this.editHideTimer = null; }
  }

  editMessage(reply: Reply, ev: MouseEvent) {
    ev.stopPropagation();
    if (!reply.isYou) return;
    this.editForId = reply.threadMessageId;
    this.showEditPanelForId = null;
    this.draft = reply.text;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.editForId = null;
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEsc() {
    this.editForId = null;
  }

  private scrollToBottom() {
    const el = this.scrollArea?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private normalizeReactionUsers(users: ReactionUser[]): ReactionUser[] {
    if (!this.uid) return users;
    return users.map(u =>
      u.userId === this.uid
        ? { ...u, username: this.name }
        : u
    );
  }

  private normalizeThreadReactions(rx: Reaction[]): Reaction[] {
    return (rx ?? []).map(r => {
      const ru = this.normalizeReactionUsers(r.reactionUsers ?? []);
      return {
        ...r,
        reactionUsers: ru,
        youReacted: ru.some(u => u.userId === this.uid),
      };
    });
  }

}