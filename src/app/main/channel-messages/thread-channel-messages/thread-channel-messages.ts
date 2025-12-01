import { Component, ElementRef, HostListener, inject, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddEmojis } from '../add-emojis/add-emojis';
import { AtMembers } from '../at-members/at-members';
import { MatDialog } from '@angular/material/dialog';

type Message = {
  id: string;
  author: string;
  time: string;
  avatar?: string;
  text: string;
  reactions?: Reaction[];
  isYou?: boolean;
  timeSeparator?: string;
};

type ReactionUser = {
  uid: string;
  name: string;
};

type Reaction = {
  countAnsweres: number;
  isAnswered?: boolean;
  time: string,
  emoji: string;
  count: number;
  youReacted?: boolean;
  users: ReactionUser[];
};

type ReactionPanelState = {
  show: boolean;
  x: number;
  y: number;
  emoji: string;
  title: string;
  subtitle: string;
  messageId?: string;
};

@Component({
  selector: 'app-thread-channel-messages',
  imports: [CommonModule, FormsModule],
  templateUrl: './thread-channel-messages.html',
  styleUrl: './thread-channel-messages.scss',
})
export class ThreadChannelMessages implements AfterViewInit {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() {
    queueMicrotask(() => this.scrollToBottom());
  }

  private dialog = inject(MatDialog);
  private hideTimer: any = null;
  private editHideTimer: any = null;
  private host = inject(ElementRef<HTMLElement>);

  editForId: string | null = null;

  channelName = 'Entwicklerteam';

  currentUserId = 'u_oliver';
  currentUserName = 'Oliver Plit';

  reactionPanel: ReactionPanelState = {
    show: false,
    x: 0,
    y: 0,
    emoji: '',
    title: '',
    subtitle: '',
    messageId: ''
  };

  membersPreview = [
    { name: 'Noah Braun' },
    { name: 'Sofia Müller' },
    { name: 'Frederik Beck' },
    { name: 'Elise Roth' },
    { name: 'Elias Neumann' },
  ];

  draft = '';

  messages: Message[] = [
    { id: 'd1', timeSeparator: 'Dienstag, 14 Januar', author: '', time: '', text: '' },
    {
      id: 'm1',
      author: 'Noah Braun',
      time: '14:25 Uhr',
      avatar: 'icons/avatars/avatar3.png',
      text: 'Welche Version ist aktuell von Angular?',
      reactions: [],
      isYou: false,
    },
    { id: 'd2', timeSeparator: 'Freitag, 27 Januar', author: '', time: '', text: '' },
    {
      id: 'm2',
      author: 'Oliver Plit',
      time: '15:06 Uhr',
      avatar: 'icons/avatars/avatar6.png',
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [
        {
          countAnsweres: 1,
          isAnswered: true,
          time: '15:00',
          emoji: 'icons/emojis/emoji_rocket.png',
          count: 2,
          youReacted: true,
          users: [
            { uid: 'u_sofia', name: 'Sofia Müller' },
            { uid: 'u_oliver', name: 'Oliver Plit' },
          ]
        },
        // { countAnsweres: 0, isAnswered: false, time: '15:00', emoji: 'icons/emojis/emoji_nerd face.png', count: 1, youReacted: false },
        // { countAnsweres: 0, isAnswered: false, time: '15:00', emoji: 'icons/emojis/emoji_person raising both hands in celebration.png', count: 1, youReacted: false },
      ],
      isYou: true,
    },
    { id: 'd3', timeSeparator: 'Sonntag, 11 Februar', author: '', time: '', text: '' },
    {
      id: 'm3',
      author: 'Max Mustermann',
      time: '11:36 Uhr',
      avatar: 'icons/avatars/avatar3.png',
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [
        {
          countAnsweres: 5,
          isAnswered: true,
          time: '15:00',
          emoji: 'icons/emojis/emoji_nerd face.png',
          count: 2,
          youReacted: false,
          users: [
            { uid: 'u_noah', name: 'Noah Braun' },
            { uid: 'u_sofia', name: 'Sofia Müller' },
          ]
        },
        // { countAnsweres: 0, isAnswered: false, time: '15:00', emoji: 'icons/emojis/emoji_nerd face.png', count: 1, youReacted: false },
        // { countAnsweres: 0, isAnswered: false, time: '15:00', emoji: 'icons/emojis/emoji_person raising both hands in celebration.png', count: 1, youReacted: false },
      ],
      isYou: false,
    },
    { id: 'd4', timeSeparator: 'Montag, 12 Februar', author: '', time: '', text: '' },
    {
      id: 'm4',
      author: 'Emily Mustermann',
      time: '23:55 Uhr',
      avatar: 'icons/avatars/avatar5.png',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [],
      isYou: false,
    },
    { id: 'd5', timeSeparator: 'heute', author: '', time: '', text: '' },
    {
      id: 'm5',
      author: 'Noah Braun',
      time: '21:05 Uhr',
      avatar: 'icons/avatars/avatar3.png',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio ' +
        'efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis ' +
        'erat, eu faucibus lacus iaculis ac.',
      reactions: [],
      isYou: false,
    },
  ];

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

  openAtMembers(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
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
      id: crypto.randomUUID(),
      author: 'Oliver Plit',
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr',
      text: this.draft.trim(),
      isYou: true,
      reactions: [],
    });
    this.draft = '';
  }

  showReactionPanel(m: Message, reaction: Reaction, event: MouseEvent) {
    const element = event.currentTarget as HTMLElement;

    const messageElement = element.closest('.message') as HTMLElement;
    if (!messageElement) return;

    const reactionRect = element.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();

    const x = reactionRect.left - messageRect.left + 40;
    const y = reactionRect.top - messageRect.top - 110;

    const youReacted = reaction.users.some(u => u.uid === this.currentUserId);
    const names = reaction.users.map(u => u.name);

    let title = '';
    if (youReacted && names.length > 0) {
      const otherUsers = names.filter(name => name !== this.currentUserName);
      if (otherUsers.length > 0) {
        title = `${otherUsers.slice(0, 2).join(' und ')} und Du`;
      } else {
        title = 'Du';
      }
    } else if (names.length > 0) {
      title = names.slice(0, 2).join(' und ');
    } else {
      title = '';
    }

    const subtitle = reaction.users?.length > 1 ? 'haben reagiert' : 'hat reagiert';

    this.reactionPanel = {
      show: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      emoji: reaction.emoji,
      title,
      subtitle,
      messageId: m.id
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
    this.editForId = this.editForId === m.id ? null : m.id;
  }

  scheduleEditMessagePanelHide(m: Message) {
    if (this.editForId !== m.id) return;
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