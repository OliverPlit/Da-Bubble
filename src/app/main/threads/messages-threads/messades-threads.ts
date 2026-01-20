import { Component, ElementRef, HostListener, inject, AfterViewInit, ViewChild, Input, OnDestroy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../../../shared/add-emojis/add-emojis';
import { AtMembers } from '../../../shared/at-members/at-members';
import type { User as AtMemberUser } from '../../../shared/at-members/at-members';
import { CurrentUserService, CurrentUser, AvatarUrlPipe } from '../../../services/current-user.service';
import { MessagesStoreService, MessageDoc, ReactionUserDoc } from '../../../services/messages-store.service';
import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { PresenceService } from '../../../services/presence.service';
import { ThreadStateService } from '../../../services/thread-state.service';
import { DateUtilsService, DaySeparated, TimeOfPipe } from '../../../services/date-utils.service';
import { Unsubscribe, Firestore, doc, docData } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { ChannelStateService } from '../../menu/channels/channel.service';

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
  imports: [CommonModule, FormsModule, AvatarUrlPipe, TimeOfPipe],
  templateUrl: './messades-threads.html',
  styleUrls: ['./messades-threads.scss'],
})
export class MessadesThreads implements AfterViewInit, OnDestroy {
  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>

  @Input() uid!: string;
  @Input() channelId!: string;
  @Input() channelName = '';

  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private hideTimer: any = null;
  private editHideTimer: any = null;
  private host = inject(ElementRef<HTMLElement>);
  private emojiSvc = inject(EmojiService);
  private messageStoreSvc = inject(MessagesStoreService);
  private threadStateSvc = inject(ThreadStateService);
  private session = inject(CurrentUserService);
  private dateUtilsSvc = inject(DateUtilsService);
  private unsub: Unsubscribe | null = null;
  private channelState = inject(ChannelStateService);

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

    this.threadStateSvc.ctx$.subscribe(ctx => {
      this.replies = [];
      this.unsub?.();
      this.unsub = null;
      if (!ctx) return;

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

      this.unsub = this.messageStoreSvc.listenThreadMessages(
        ctx.uid, ctx.channelId, ctx.messageId,
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

  getEmojiSrc(emojiId: EmojiId | string) {
    return this.emojiSvc.src(emojiId);
  }

  openAddEmojis(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 24;
    const dlgW = 350;
    const dlgH = 467;

    this.dialog.open(AddEmojis, {
      width: dlgW + 'px',
      panelClass: 'add-emojis-dialog-panel',
      position: {
        bottom: `${dlgH + gap}px`,
        left: `${64 + dlgW}px`
      }
    });
  }

  async openAtMembers(trigger: HTMLElement) {
    const ctx = this.threadStateSvc.value;
    if (!ctx) return;
    const members = await this.resolveMembersWithCtx(ctx);

    // const r = trigger.getBoundingClientRect();
    const gap = 24;
    const dlgW = 350;
    const dlgH = 467;

    this.dialog.open(AtMembers, {
      width: dlgW + 'px',
      panelClass: 'at-members-dialog-panel',
      position: {
        bottom: `${-160 + dlgH + gap}px`,
        right: `${-240 + dlgW}px`
      },
      data: {
        channelId: ctx.channelId,
        currentUserId: ctx.uid,
        members
      }
    }).afterClosed().subscribe(mention => {
      if (!mention) return;
      this.draft = (this.draft || '').trimEnd() + (this.draft ? ' ' : '') + mention + ' ';
    });
  }

  sendMessage() {
    const ctx = this.threadStateSvc.value;
    const text = this.draft.trim();
    if (!ctx || !text) return;

    if (this.editForId) {
      this.messageStoreSvc.updateThreadMessage(ctx.uid, ctx.channelId, ctx.messageId, this.editForId, text).then(() => {
        this.editForId = null;
        this.draft = '';
      })
      return;
    }

    const author = ctx.root?.author!;
    this.messageStoreSvc.sendThreadReply(ctx.uid, ctx.channelId, ctx.messageId, { text, author });
    this.draft = '';
  }

  async toggleReaction(reply: Reply, emojiId: EmojiId) {
    const ctx = this.threadStateSvc.value;
    if (!ctx || !this.uid) return;

    const you = { userId: this.uid, username: this.name };
    await this.messageStoreSvc.toggleThreadReaction(
      ctx.uid,
      ctx.channelId,
      ctx.messageId,
      reply.threadMessageId,
      emojiId,
      you
    );
  }

  async toggleEmoji(reply: Reply, event: MouseEvent) {
    const btn = event.currentTarget as HTMLElement | null;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const dlgW = 350;
    const gap = 8;

    const dialogRef = this.dialog.open(AddEmojis, {
      width: dlgW + 'px',
      panelClass: 'add-emojis-dialog-panel',
      position: {
        top: `${Math.round(rect.bottom + gap)}px`,
        left: `${Math.max(8, Math.round(rect.left - dlgW + btn.offsetWidth))}px`,
      },
    });

    dialogRef.afterClosed().subscribe((emojiId: string | null) => {
      if (!emojiId || !this.emojiSvc.isValid(emojiId)) return;
      this.toggleReaction(reply, emojiId as EmojiId);
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

  async toggleReplyReaction(replyId: string, emojiId: string) {
    const ctx = this.threadStateSvc.value;
    if (!ctx) return;
    const you: ReactionUserDoc = { userId: ctx.uid, username: ctx.root?.author?.username ?? '' };
    await this.messageStoreSvc.toggleThreadReaction(ctx.uid, ctx.channelId, ctx.messageId, replyId, emojiId, you);
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

}
