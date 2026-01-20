import {
  Component, EventEmitter, ElementRef, HostListener, inject, AfterViewInit,
  ViewChild, Input, OnInit, OnDestroy, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../../../shared/add-emojis/add-emojis';
import { AtMembers } from '../../../shared/at-members/at-members';
import type { User as AtMemberUser } from '../../../shared/at-members/at-members';
import { Profile } from '../../header/profile/profile';
import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { PresenceService } from '../../../services/presence.service';
import { MessagesStoreService, MessageDoc, ReactionUserDoc } from '../../../services/messages-store.service';
import { Unsubscribe } from '@angular/fire/firestore';
import { CurrentUserService, CurrentUser, AvatarUrlPipe } from '../../../services/current-user.service';
import { OnChanges, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { directMessageContact } from '../direct-messages/direct-messages.model';
import { ProfileCard } from '../../../shared/profile-card/profile-card';
import { ChangeDetectorRef } from '@angular/core';
import { Firestore, getDoc, doc } from '@angular/fire/firestore';
import { FirebaseService } from '../../../services/firebase';
import { Observable } from 'rxjs';
import { LayoutService } from '../../../services/layout.service';
import { DateUtilsService, DaySeparated, TimeOfPipe } from '../../../services/date-utils.service';
import { firstValueFrom } from 'rxjs';

type Message = {
  messageId: string;
  uid: string;
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
  selector: 'app-chat-direct-you',
  imports: [CommonModule, FormsModule, AvatarUrlPipe, TimeOfPipe],
  templateUrl: './chat-direct-you.html',
  styleUrl: './chat-direct-you.scss',
})
export class ChatDirectYou implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') composerTextarea!: ElementRef<HTMLTextAreaElement>;

  @Input() uid!: string;
  @Input() channelId!: string;
  @Input() channelName = '';
  @Input() chatUser: directMessageContact | null = null;
  @Output() close = new EventEmitter<void>();

  private dialog = inject(MatDialog)
  private firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private hideTimer: any = null;
  private editHideTimer: any = null;
  private host = inject(ElementRef<HTMLElement>);
  private emojiSvc = inject(EmojiService);
  public presence = inject(PresenceService);
  private messageStoreSvc = inject(MessagesStoreService);
  private unsub: Unsubscribe | null = null;
  private stateSub: Subscription | null = null;
  private layout = inject(LayoutService);
  private currentUserService = inject(CurrentUserService);
  private dateUtilsSvc = inject(DateUtilsService);

  private toAtMember = (m: any): AtMemberUser => {
    const uid = (m?.uid ?? m?.id ?? '').toString();
    return {
      uid,
      name: (m?.name ?? m?.username ?? '').toString(),
      avatar: (m?.avatar ?? '').toString(),
      isYou: uid === this.uid,
    };
  };

  private ensureSelf = (list: AtMemberUser[]): AtMemberUser[] =>
    (!this.uid || list.some(u => u.uid === this.uid))
      ? list
      : [...list, { uid: this.uid, name: this.userName, avatar: this.userAvatar, isYou: true }];

  userName: string = '';
  userAvatar: string = '';
  isMobile = false;
  mobileMenuOpen = false;
  constructor(private firebaseService: FirebaseService) { }
  directMessage$: Observable<directMessageContact[]> | undefined;

  ready = false;
  draft = '';
  editForId: string | null = null;
  showEditPanelForId: string | null = null;

  reactionPanel: ReactionPanelState = {
    show: false,
    x: 0,
    y: 0,
    emoji: '',
    title: '',
    subtitle: '',
    messageId: '',
  };

  messages: Message[] = [];
  messagesView: Message[] = [];

  timeOf = (x: any) => this.dateUtilsSvc.timeOf(x);

  async ngOnInit() {
    this.directMessage$ = this.firebaseService.getCollection$('directMessages');

    /*
    await this.initUserId();
    this.firebaseService.currentName$.subscribe((name) => {
      if (name) {
        this.userName = name;
        this.cdr.detectChanges();
      }
    });
    */

    await this.currentUserService.hydrateFromLocalStorage();
    const u = this.currentUserService.getCurrentUser();
    if (u) {
      this.uid = u.uid;
      this.userName = u.name;
      this.userAvatar = u.avatar;
    }

    this.startListening();
    this.ready = true;
    this.cdr.detectChanges();
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

  async startListening() {
    if (!this.userName || !this.userAvatar) {
      const userRef = doc(this.firestore, 'directMessages', this.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data: any = snap.data();
        this.userName = this.userName || data?.name || '';
        this.userAvatar = this.userAvatar || data?.avatar || '';
      }
    }

    if (!this.uid) { this.ready = true; return; }

    this.unsub = this.messageStoreSvc.listenSelfDirectMessages(
      this.uid,
      (docs) => {
        this.messages = docs.map(d => this.mapDocToMessage(d));
        this.rebuildMessagesView();
        queueMicrotask(() => this.scrollToBottom());
      });
  }

  ngAfterViewInit() {
    this.rebuildMessagesView();
    queueMicrotask(() => this.scrollToBottom());
  }

  ngOnDestroy() { this.unsub?.(); }

  async initUserId() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const uid = JSON.parse(storedUser).uid;

    if (!uid) return;

    const userRef = doc(this.firestore, 'directMessages', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data.name;
      this.userAvatar = data.avatar;

      this.firebaseService.setName(this.userName);
      this.cdr.detectChanges();
    }

  }

  private mapDocToMessage(d: MessageDoc & { id: string }): Message {
    return {
      messageId: d.id,
      uid: d.author.uid,
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
    const text = this.draft.trim();
    if (!text || !this.uid) return;

    const u = this.currentUserService.getCurrentUser();
    if (!u) return;

    if (this.editForId) {
      await this.messageStoreSvc.updateSelfDirectMessage(this.uid, this.editForId, text);
      this.editForId = null;
      this.draft = '';
      return;
    }

    await this.messageStoreSvc.sendSelfDirectMessage(this.uid, {
      text,
      author: { uid: this.uid, username: this.userName, avatar: this.userAvatar }
    });
    this.draft = '';
  }

  async toggleReaction(m: any, emojiId: EmojiId) {
    if (!this.uid) return;
    const you = { userId: this.uid, username: this.userName };
    await this.messageStoreSvc.toggleSelfDirectMessageReaction(this.uid, m.messageId, emojiId, you);
  }

  async toggleEmoji(m: Message, event: MouseEvent) {
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
      if (!emojiId) return;
      if (!this.emojiSvc.isValid(emojiId)) return;
      this.toggleReaction(m, emojiId as EmojiId);
    });
  }

  getEmojiSrc(emojiId: EmojiId | string) {
    return this.emojiSvc.src(emojiId);
  }

  private rebuildMessagesView() {
    this.messagesView = this.dateUtilsSvc.withDaySeparators(this.messages, {
      getCreatedAt: m => m.createdAt,
      makeSeparator: (date, label) => ({
        messageId: '', uid: '', username: '', avatar: '',
        isYou: false, createdAt: date, text: '',
        reactions: [], repliesCount: 0, timeSeparator: label,
      })
    });
  }

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
        left: `${64 + dlgW}px`,
      },
    });
  }

  openAtMembers(trigger: HTMLElement) {
    const members = [
      { uid: this.uid, name: this.userName, avatar: this.userAvatar, isYou: true },
      ...(this.chatUser
        ? [{ uid: this.chatUser.id, name: this.chatUser.name, avatar: this.chatUser.avatar ?? '', isYou: false }]
        : [])
    ];

    // const r = trigger.getBoundingClientRect();
    const gap = 24;
    const dlgW = 350;
    const dlgH = 467;

    this.dialog.open(AtMembers, {
      width: dlgW + 'px',
      panelClass: 'at-members-dialog-panel',
      position: {
        bottom: `${dlgH + gap}px`,
        left: `${100 + dlgW}px`,
      },
      data: {
        currentUserId: this.uid,
        members
      }
    }).afterClosed().subscribe(mention => {
      if (!mention) return;
      this.draft = (this.draft || '').trimEnd() + (this.draft ? ' ' : '') + mention + ' ';
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

    const youReacted = reaction.reactionUsers.some((u) => u.userId === this.uid);
    const reactedUsers = reaction.reactionUsers.map((u) => u.username);

    let title = '';
    if (youReacted && reactedUsers.length > 0) {
      const otherUsers = reactedUsers.filter((name) => name !== this.userName);
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
      messageId: m.messageId,
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
    this.showEditPanelForId = this.showEditPanelForId === m.messageId ? null : m.messageId;
  }

  scheduleEditMessagePanelHide(m: Message) {
    if (this.showEditPanelForId !== m.messageId) return;
    this.clearEditMessagePanelHide();
    this.editHideTimer = setTimeout(() => {
      this.showEditPanelForId = null;
    });
  }

  cancelEditMessagePanelHide(_: Message) { this.clearEditMessagePanelHide(); }
  private clearEditMessagePanelHide() {
    if (this.editHideTimer) { clearTimeout(this.editHideTimer); this.editHideTimer = null; }
  }

  editMessage(m: Message, ev: MouseEvent) {
    ev.stopPropagation();
    if (!m.isYou) return;
    this.editForId = m.messageId;
    this.showEditPanelForId = null;
    this.draft = m.text;
    queueMicrotask(() => this.composerTextarea?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape') closeOnEsc() {
    this.editForId = null;
    // optional: this.draft = '';
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.showEditPanelForId = null; // nur Panel zu
      // editForId NICHT zurücksetzen, sonst verliert man den Edit-Modus
    }
  }

  private scrollToBottom() {
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  openEmojiPicker(m: Message, event: MouseEvent) {
    const btn = event.currentTarget as HTMLElement | null;
    const rect = btn?.getBoundingClientRect();
    const dlgW = 350, gap = 8;

    const ref = this.dialog.open(AddEmojis, {
      width: dlgW + 'px',
      panelClass: 'add-emojis-dialog-panel',
      ...(rect ? {
        position: {
          top: `${Math.round(rect.bottom + gap)}px`,
          left: `${Math.max(8, Math.round(rect.left - dlgW + (btn?.offsetWidth || 0)))}px`,
        }
      } : {})
    });

    ref.afterClosed().subscribe((emojiId: string | null) => {
      if (!emojiId || !this.emojiSvc.isValid(emojiId)) return;
      this.toggleReaction(m, emojiId as EmojiId);
    });
  }

  closeMessage() {
    this.close.emit();
  }

  openProfile(member: any) {
    this.dialog.open(ProfileCard, {
      data: member,
      panelClass: 'profile-dialog-panel'
    });
  }

  openProfileHeader() {
    const ref = this.dialog.open(Profile, {
      panelClass: 'profile-dialog-panel',
      ...(this.isMobile ? {} : { position: { top: '120px', right: '20px' } }),
    });

    ref.afterClosed().subscribe((updatedName?: string) => {
      if (updatedName) {
        this.userName = updatedName;
        this.cdr.detectChanges();
      }
    });
  }

  getStatus(uid: string): 'online' | 'offline' {
    const map = this.presence.userStatusMap();
    return map[uid] ?? 'offline';
  }

  get composerPlaceholder(): string {
    const messageRecipient =
      this.userName?.trim() ||
      this.chatUser?.name?.trim() ||
      null;

    if (!messageRecipient) return 'Nachricht an @…';

    return `Nachricht an @${messageRecipient}`;
  }
}