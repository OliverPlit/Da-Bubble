import { Component, ElementRef, HostListener, inject, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../add-emojis/add-emojis';
import { AtMembers } from '../at-members/at-members';
import { EmojiService, EmojiId } from '../../../services/emoji.service';

type Message = {
  messageId: string;
  username: string;
  avatar: string;
  isYou: boolean;
  createdAt: string;
  text: string;
  reactions: Reaction[];
  repliesCount: number;
  lastReplyTime?: string,
  timeSeparator?: string;       // über createdAt abgleichen?
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

@Component({
  selector: 'app-thread-channel-messages',
  imports: [CommonModule, FormsModule],
  templateUrl: './thread-channel-messages.html',
  styleUrl: './thread-channel-messages.scss',
})
export class ThreadChannelMessages implements AfterViewInit {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;

  private dialog = inject(MatDialog);
  private hideTimer: any = null;
  private editHideTimer: any = null;
  private host = inject(ElementRef<HTMLElement>);
  private emojiSvc = inject(EmojiService);

  channelName = 'Entwicklerteam';
  userId = 'u_oliver';
  username = 'Oliver Plit';

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

  ngAfterViewInit() {
    queueMicrotask(() => this.scrollToBottom());
  }

  getEmojiSrc(emojiId: EmojiId | string) {
    return this.emojiSvc.src(emojiId);
  }

  membersPreview = [
    { name: 'Noah Braun' },
    { name: 'Sofia Müller' },
    { name: 'Frederik Beck' },
    { name: 'Elise Roth' },
    { name: 'Elias Neumann' },
  ];

  messages: Message[] = [
    {
      messageId: 'd1',
      username: '',
      avatar: '',
      isYou: false,
      createdAt: '',
      text: '',
      reactions: [],
      repliesCount: 0,
      timeSeparator: 'Dienstag, 14 Januar'
    },
    {
      messageId: 'm1',
      username: 'Noah Braun',
      avatar: 'icons/avatars/avatar3.png',
      isYou: false,
      createdAt: '14:25 Uhr',
      text: 'Welche Version ist aktuell von Angular?',
      reactions: [],
      repliesCount: 2,
      lastReplyTime: '14:56'
    },
    {
      messageId: 'd2',
      username: '',
      avatar: '',
      isYou: false,
      createdAt: '',
      text: '',
      reactions: [],
      repliesCount: 0,
      timeSeparator: 'Freitag, 27 Januar'
    },
    {
      messageId: 'm2',
      username: 'Oliver Plit',
      avatar: 'icons/avatars/avatar6.png',
      isYou: true,
      createdAt: '15:06 Uhr',
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [
        {
          emojiId: 'rocket',
          emojiCount: 2,
          youReacted: true,
          reactionUsers: [
            { userId: 'u_sofia', username: 'Sofia Müller' },
            { userId: 'u_oliver', username: 'Oliver Plit' },
          ]
        },
      ],
      repliesCount: 1,
      lastReplyTime: '15:20'
    },
    {
      messageId: 'd3',
      username: '',
      avatar: '',
      isYou: false,
      createdAt: '',
      text: '',
      reactions: [],
      repliesCount: 0,
      timeSeparator: 'Sonntag, 11 Februar'
    },
    {
      messageId: 'm3',
      username: 'Max Mustermann',
      avatar: 'icons/avatars/avatar3.png',
      isYou: false,
      createdAt: '11:36 Uhr',
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [
        {
          emojiId: 'nerd',
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
      messageId: 'd4',
      username: '',
      avatar: '',
      isYou: false,
      createdAt: '',
      text: '',
      reactions: [],
      repliesCount: 0,
      timeSeparator: 'Montag, 12 Februar'
    },
    {
      messageId: 'm4',
      username: 'Emily Mustermann',
      avatar: 'icons/avatars/avatar5.png',
      isYou: false,
      createdAt: '23:55 Uhr',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [],
      repliesCount: 8,
      lastReplyTime: '23:58'
    },
    {
      messageId: 'd5',
      username: '',
      avatar: '',
      isYou: false,
      createdAt: '',
      text: '',
      reactions: [],
      repliesCount: 0,
      timeSeparator: 'heute'
    },
    {
      messageId: 'm5',
      username: 'Noah Braun',
      avatar: 'icons/avatars/avatar3.png',
      isYou: false,
      createdAt: '21:05 Uhr',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [],
      repliesCount: 53,
      lastReplyTime: '4:17'
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

  sendMessage() {
    if (!this.draft.trim()) return;
    this.messages.push({
      messageId: crypto.randomUUID(),
      username: 'Oliver Plit',
      avatar: '',
      isYou: true,
      createdAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr',
      text: this.draft.trim(),
      reactions: [],
      repliesCount: 0,
    });
    this.draft = '';
    this.scrollToBottom();
  }

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

  showReactionPanel(m: Message, reaction: Reaction, event: MouseEvent) {
    const element = event.currentTarget as HTMLElement;
    const messageElement = element.closest('.message') as HTMLElement;
    if (!messageElement) return;

    const reactionRect = element.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();

    const x = reactionRect.left - messageRect.left + 40;
    const y = reactionRect.top - messageRect.top - 110;

    const youReacted = reaction.reactionUsers.some(u => u.userId === this.userId);
    const reactedUsers = reaction.reactionUsers.map(u => u.username);

    let title = '';
    if (youReacted && reactedUsers.length > 0) {
      const otherUsers = reactedUsers.filter(name => name !== this.username);
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