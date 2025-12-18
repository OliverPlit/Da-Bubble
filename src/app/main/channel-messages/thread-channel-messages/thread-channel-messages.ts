import {
  Component, ElementRef, HostListener, inject, AfterViewInit,
  ViewChild, Input, OnInit, OnDestroy,
  input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../add-emojis/add-emojis';
import { AtMembers } from '../at-members/at-members';
import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { MessagesStoreService, MessageDoc, ReactionUserDoc } from '../../../services/messages-store.service';
import { Unsubscribe } from '@angular/fire/firestore';
import { CurrentUserService, CurrentUser, AvatarUrlPipe } from '../../../services/current-user.service';
import { Subscription } from 'rxjs';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { OnChanges, SimpleChanges } from '@angular/core';

type Message = {
  messageId: string;
  username: string;
  avatar: string;
  isYou: boolean;
  createdAt: string | Date;
  text: string;
  reactions: Reaction[];
  repliesCount: number;
  lastReplyTime?: string | Date;
  timeSeparator?: string;
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
  selector: 'app-thread-channel-messages',
  imports: [CommonModule, FormsModule, AvatarUrlPipe],
  templateUrl: './thread-channel-messages.html',
  styleUrl: './thread-channel-messages.scss',
})
export class ThreadChannelMessages implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;
  @Input() uid!: string;
  @Input() channelId!: string;
  @Input() channelName = '';

  private dialog = inject(MatDialog);
  private hideTimer: any = null;
  private editHideTimer: any = null;
  private host = inject(ElementRef<HTMLElement>);
  private emojiSvc = inject(EmojiService);

  private messageStoreSvc = inject(MessagesStoreService);
  private unsub: Unsubscribe | null = null;
  private stateSub: Subscription | null = null;

  private session = inject(CurrentUserService);
  private channelState = inject(ChannelStateService);

  // channelName = 'Entwicklerteam';
  // uid = '';
  name = '';
  avatar = '';

  draft = '';
  editForId: string | null = null;

  reactionPanel: ReactionPanelState = {
    show: false,
    x: 0,
    y: 0,
    emoji: '',
    title: '',
    subtitle: '',
    messageId: ''
  };

  messagesView: Message[] = [];

  async ngOnInit() {
    await this.session.hydrateFromLocalStorage();
    const u = this.session.getCurrentUser();
    if (u) {
      this.uid = u.uid;
      this.name = u.name;
      this.avatar = u.avatar;
    }

    this.startListening();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['channelId'] || changes['ownerUid']) {
      this.restartListening();
    }
  }

  private restartListening() {
    this.unsub?.();
    this.startListening();
  }

  private startListening() {
    if (!this.uid || !this.channelId) return;
    this.unsub = this.messageStoreSvc.listenChannelMessages(
      this.uid,
      this.channelId,
      (docs) => {
        this.messages = docs.map(d => this.mapDocToMessage(d));
        this.rebuildMessagesView();
        queueMicrotask(() => this.scrollToBottom());
      }
    );
  }


  ngAfterViewInit() {
    this.rebuildMessagesView();
    queueMicrotask(() => this.scrollToBottom());
  }


  ngOnDestroy() { this.unsub?.(); }


  private mapDocToMessage(d: MessageDoc & { id: string }): Message {
    return {
      messageId: d.id,
      username: d.author.username,
      avatar: d.author.avatar,
      isYou: d.author.uid === this.uid,
      createdAt: (d.createdAt as any) ?? new Date(),
      text: d.text,
      reactions: (d.reactions ?? []).map(r => {
        const emojiId: EmojiId = isEmojiId(r.emojiId) ? r.emojiId : 'rocket'; // Fallback oder throw
        const reactionUsers: ReactionUser[] = (r.reactionUsers ?? []).map(u => ({
          userId: u.userId,
          username: u.username
        }));
        return {
          emojiId,
          emojiCount: Number(r.emojiCount ?? reactionUsers.length ?? 0),
          youReacted: reactionUsers.some(u => u.userId === this.uid),
          reactionUsers
        };
      }),
      repliesCount: d.repliesCount ?? 0,
      lastReplyTime: d.lastReplyTime ? (d.lastReplyTime as any) : undefined
    };
  }


  async sendMessage() {
    if (!this.draft.trim()) return;
    const u = this.session.getCurrentUser();
    if (!u) return; // optional: Guard

    await this.messageStoreSvc.sendChannelMessage(this.uid, this.channelId, {
      text: this.draft.trim(),
      author: { uid: u.uid, username: u.name, avatar: u.avatar },
    });

    this.draft = '';
  }


  async toggleReaction(m: any, emojiId: EmojiId) {
    if (!this.uid) return;
    const you = { userId: this.uid, username: this.name };
    await this.messageStoreSvc.toggleChannelReaction(this.uid, this.channelId, m.messageId, emojiId, you);
  }


  async toggleEmoji(m: Message, event: MouseEvent) {
    // currentTarget kann laut Typ-Defs null sein → absichern
    const btn = event.currentTarget as HTMLElement | null;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const dlgW = 350;   // tatsächliche Dialogbreite
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
      if (!emojiId) return;
      if (!this.emojiSvc.isValid(emojiId)) return;
      this.toggleReaction(m, emojiId as EmojiId);
    });
  }




  getEmojiSrc(id: EmojiId | string) { return this.emojiSvc.src(id); }


  private toDate(x: unknown): Date | null {
    if (!x) return null;

    // Firestore Timestamp (hat .toDate())
    if (typeof (x as any)?.toDate === 'function') {
      const d = (x as any).toDate();
      return isNaN(d.getTime()) ? null : d;
    }

    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;

    if (typeof x === 'string') {
      const date = new Date(x);
      if (!isNaN(date.getTime())) return date;

      // erlaubt "HH:MM"
      const m = /^(\d{1,2}):(\d{2})$/.exec(x.trim());
      if (m) {
        const d = new Date();
        d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return d;
      }
    }

    return null;
  }


  /*
  private toDate(x: unknown): Date | null {
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;

    if (typeof x === 'string') {
      const date = new Date(x);
      if (!isNaN(date.getTime())) return date;

      const m = /^(\d{1,2}):(\d{2})$/.exec(x.trim());
      if (m) {
        const date = new Date();
        date.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return date;
      }
    }

    return null;
  }
  */

  private getTimeSafe(date: string | Date | null | undefined): number {
    const d = this.toDate(date);
    return d ? d.getTime() : Number.POSITIVE_INFINITY;
  }

  private dayKey(date: Date | null): string | null {
    if (!date) return null;

    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');

    return `${y}-${m}-${d}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDayLabel(date: Date): string {
    const now = this.startOfDay(new Date());
    const today = this.startOfDay(date);
    const diffDays = Math.round((now.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) return 'heute';
    if (diffDays === 1) return 'gestern';

    const timeSeparator = new Intl.DateTimeFormat('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);

    return timeSeparator.charAt(0).toUpperCase() + timeSeparator.slice(1);
  }

  private compareByCreatedAtAsc = (a: Message, b: Message) =>
    this.getTimeSafe(a.createdAt) - this.getTimeSafe(b.createdAt);

  private rebuildMessagesView() {
    const sorted = [...this.messages].sort(this.compareByCreatedAtAsc);
    const out: Message[] = [];
    let lastKey: string | null = null;

    for (const m of sorted) {
      const d = this.toDate(m.createdAt);
      const key = this.dayKey(d);

      if (!d || !key) {
        out.push(m);
        continue;
      }

      if (key !== lastKey) {
        out.push({
          messageId: '',
          username: '',
          avatar: '',
          isYou: false,
          createdAt: d,
          text: '',
          reactions: [],
          repliesCount: 0,
          timeSeparator: this.formatDayLabel(d),
        });
        lastKey = key;
      }

      out.push({ ...m, timeSeparator: undefined });
    }

    this.messagesView = out;
  }

  timeOf(x: string | Date | undefined | null): string {
    const date = this.toDate(x);

    if (!date) return '';

    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  }

  /*
  getEmojiSrc(emojiId: EmojiId | string) {
    return this.emojiSvc.src(emojiId);
  }
  */

  membersPreview = [
    { name: 'Noah Braun' },
    { name: 'Sofia Müller' },
    { name: 'Frederik Beck' },
    { name: 'Elise Roth' },
    { name: 'Elias Neumann' },
  ];

  messages: Message[] = [
    {
      messageId: 'm1',
      username: 'Noah Braun',
      avatar: 'icons/avatars/avatar3.png',
      isYou: false,
      createdAt: '2025-01-14T14:25:00+01:00',
      text: 'Welche Version ist aktuell von Angular?',
      reactions: [],
      repliesCount: 2,
      lastReplyTime: '2025-01-14T14:56:00+01:00'
    },
    {
      messageId: 'm2',
      username: 'Oliver Plit',
      avatar: 'icons/avatars/avatar6.png',
      isYou: true,
      createdAt: '2025-01-27T15:06:00+01:00',
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [
        {
          emojiId: 'rocket' as EmojiId,
          emojiCount: 2,
          youReacted: true,
          reactionUsers: [
            { userId: 'u_sofia', username: 'Sofia Müller' },
            { userId: 'u_oliver', username: 'Oliver Plit' },
          ]
        },
      ],
      repliesCount: 1,
      lastReplyTime: '2025-01-27T15:20:00+01:00'
    },
    {
      messageId: 'm3',
      username: 'Max Mustermann',
      avatar: 'icons/avatars/avatar3.png',
      isYou: false,
      createdAt: '2025-02-11T11:36:00+01:00',
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [
        {
          emojiId: 'nerd' as EmojiId,
          emojiCount: 2,
          youReacted: false,
          reactionUsers: [
            { userId: 'u_noah', username: 'Noah Braun' },
            { userId: 'u_sofia', username: 'Sofia Müller' },
          ]
        },
      ],
      repliesCount: 0
    },
    {
      messageId: 'm4',
      username: 'Emily Mustermann',
      avatar: 'icons/avatars/avatar5.png',
      isYou: false,
      createdAt: '2025-02-12T23:55:00+01:00',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [],
      repliesCount: 8,
      lastReplyTime: '2025-02-12T23:58:00+01:00'
    },
    {
      messageId: 'm5',
      username: 'Noah Braun',
      avatar: 'icons/avatars/avatar3.png',
      isYou: false,
      createdAt: '2025-12-07T11:38:00+01:00',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [],
      repliesCount: 53,
      lastReplyTime: '2025-12-07T04:17:00+01:00'
    },
  ];

  openAddEmojis(trigger: HTMLElement) {
    // const r = trigger.getBoundingClientRect();
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

  openAtMembers(trigger: HTMLElement) {
    // const r = trigger.getBoundingClientRect();
    const gap = 24;
    const dlgW = 350;
    const dlgH = 467;

    this.dialog.open(AtMembers, {
      width: dlgW + 'px',
      panelClass: 'at-members-dialog-panel',
      position: {
        bottom: `${dlgH + gap}px`,
        left: `${100 + dlgW}px`
      }
    });
  }

  /*
  sendMessage() {
    if (!this.draft.trim()) return;

    this.messages.push({
      messageId: crypto.randomUUID(),
      username: 'Oliver Plit',
      avatar: 'icons/avatars/avatar6.png',
      isYou: true,
      createdAt: new Date(),
      text: this.draft.trim(),
      reactions: [],
      repliesCount: 0,
    });
    this.draft = '';
    this.rebuildMessagesView();
    this.scrollToBottom();
  }
  */

  /*
  toggleReaction(m: Message, emojiId: EmojiId) {
    const you: ReactionUser = { userId: this.userId, username: this.username };
    const rx = m.reactions.find(r => r.emojiId === emojiId);

    if (rx) {
      const youIdx = rx.reactionUsers.findIndex(u => u.userId === this.userId);
      if (youIdx >= 0) {
        rx.reactionUsers.splice(youIdx, 1);
        rx.emojiCount = Math.max(0, rx.emojiCount - 1);
        rx.youReacted = rx.reactionUsers.some(u => u.userId === this.userId);
        if (rx.emojiCount === 0 || rx.reactionUsers.length === 0) {
          m.reactions = m.reactions.filter(r => r !== rx);
        } else {
          m.reactions = [...m.reactions];
        }
      } else {
        rx.reactionUsers.push(you);
        rx.emojiCount += 1;
        rx.youReacted = true;
        m.reactions = [...m.reactions];
      }
    } else {
      m.reactions = [
        ...m.reactions,
        { emojiId, emojiCount: 1, youReacted: true, reactionUsers: [you] },
      ];
    }
  }
  */

  /*
  toggleEmoji(m: Message, event: MouseEvent) {
    const btn = event.currentTarget as HTMLElement;
    const r = btn.getBoundingClientRect();

    const dlgW = 20;
    const gap = -10;

    const ref = this.dialog.open(AddEmojis, {
      width: dlgW + 'px',
      panelClass: 'add-emojis-dialog-panel',
      position: {
        top: `${Math.round(r.bottom + gap)}px`,
        left: `${Math.max(8, Math.round(r.left - dlgW + btn.offsetWidth))}px`,
      },
    });

    ref.afterClosed().subscribe((emojiId: string | null) => {
      if (!emojiId || !this.emojiSvc.isValid(emojiId)) return;
      this.toggleReaction(m, emojiId);
    });
  }
  */

  showReactionPanel(m: Message, reaction: Reaction, event: MouseEvent) {
    const element = event.currentTarget as HTMLElement;
    const messageElement = element.closest('.message') as HTMLElement;
    if (!messageElement) return;

    const reactionRect = element.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();

    const x = reactionRect.left - messageRect.left + 40;
    const y = reactionRect.top - messageRect.top - 110;

    const youReacted = reaction.reactionUsers.some(u => u.userId === this.uid);
    const reactedUsers = reaction.reactionUsers.map(u => u.username);

    let title = '';
    if (youReacted && reactedUsers.length > 0) {
      const otherUsers = reactedUsers.filter(name => name !== this.name);
      if (otherUsers.length > 0) {
        title = `${otherUsers.slice(0, 2).join(' und ')} und Du`;
      } else {
        title = 'Du';
      }
    } else if (reactedUsers.length > 0) {
      title = reactedUsers.slice(0, 2).join(' und ');
    } else {
      title = '';
    }

    const subtitle = reaction.reactionUsers?.length > 1 ? 'haben reagiert' : 'hat reagiert';

    this.reactionPanel = {
      show: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      emoji: this.emojiSvc.src(reaction.emojiId),
      title,
      subtitle,
      messageId: m.messageId
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

  toggleEditMessagePanel(m: Message, ev: MouseEvent) {
    ev.stopPropagation();
    this.clearEditMessagePanelHide();
    this.editForId = this.editForId === m.messageId ? null : m.messageId;
  }

  scheduleEditMessagePanelHide(m: Message) {
    if (this.editForId !== m.messageId) return;
    this.clearEditMessagePanelHide();
    this.editHideTimer = setTimeout(() => {
      this.editForId = null;
    });
  }

  cancelEditMessagePanelHide(_: Message) {
    this.clearEditMessagePanelHide();
  }

  private clearEditMessagePanelHide() {
    if (this.editHideTimer) {
      clearTimeout(this.editHideTimer);
      this.editHideTimer = null;
    }
  }

  editMessage(ev: MouseEvent) {
    ev.stopPropagation();
    this.editForId = null;
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
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}