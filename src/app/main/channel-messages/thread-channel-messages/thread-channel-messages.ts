import {
  Component, ElementRef, HostListener, inject, AfterViewInit,
  ViewChild, Input, OnInit, OnDestroy, ChangeDetectorRef, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../../../shared/add-emojis/add-emojis';
import { AtMembers } from '../../../shared/at-members/at-members';
import type { User as AtMemberUser } from '../../../shared/at-members/at-members';
import { Firestore, doc, docData, getDoc } from '@angular/fire/firestore';
import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { PresenceService } from '../../../services/presence.service';
import { MessagesStoreService, MessageDoc, ReactionUserDoc } from '../../../services/messages-store.service';
import { Unsubscribe } from '@angular/fire/firestore';
import { CurrentUserService, CurrentUser, AvatarUrlPipe } from '../../../services/current-user.service';
import { Subscription } from 'rxjs';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { ThreadStateService } from '../../../services/thread-state.service';
import { LayoutService } from '../../../services/layout.service';
import { DateUtilsService, DaySeparated, TimeOfPipe } from '../../../services/date-utils.service';
import { firstValueFrom } from 'rxjs';
import { AnchorOverlayService } from '../../../services/anchor-overlay.service';
import { FirebaseService } from '../../../services/firebase';

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
  selector: 'app-thread-channel-messages',
  imports: [CommonModule, FormsModule, AvatarUrlPipe, TimeOfPipe],
  templateUrl: './thread-channel-messages.html',
  styleUrl: './thread-channel-messages.scss',
})
export class ThreadChannelMessages implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;
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
  private messageStoreSvc = inject(MessagesStoreService);
  private unsub: Unsubscribe | null = null;
  private channelSubscription: Subscription | null = null;
  private layout = inject(LayoutService);
  private currentUserService = inject(CurrentUserService);
  private channelState = inject(ChannelStateService);
  private threadStateSvc = inject(ThreadStateService);
  private dateUtilsSvc = inject(DateUtilsService);
  private cdr = inject(ChangeDetectorRef);
  private anchorOverlaySvc = inject(AnchorOverlayService);
  private firebaseSvc = inject(FirebaseService);
  private profileSubscription: Subscription | null = null;

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
      : [...list, { uid: this.uid, name: this.name, avatar: this.avatar, isYou: true }];

  private async getMembersFromState(): Promise<AtMemberUser[]> {
    try {
      const ch: any = await firstValueFrom(this.channelState.selectedChannel$);
      if (!ch || (this.channelId && ch.id !== this.channelId)) return [];
      const raw: any[] = Array.isArray(ch.members) ? ch.members : [];
      const mapped = raw.map((x: any) => this.toAtMember(x)) as AtMemberUser[];
      return this.ensureSelf(mapped.filter((u: AtMemberUser) => u.uid && u.name));
    } catch {
      return [];
    }
  }

  private async getMembersFromFirestore(): Promise<AtMemberUser[]> {
    if (!this.uid || !this.channelId) return [];
    const ref = doc(this.firestore, `users/${this.uid}/memberships/${this.channelId}`);
    const snap = await getDoc(ref);
    const data: any = snap.exists() ? snap.data() : null;
    const raw: any[] = Array.isArray(data?.members) ? data.members : [];
    const mapped = raw.map((x: any) => this.toAtMember(x)) as AtMemberUser[];
    return this.ensureSelf(mapped.filter((u: AtMemberUser) => u.uid && u.name));
  }

  private getMembersFromMessages(): AtMemberUser[] {
    const uniq = new Map<string, AtMemberUser>();
    for (const m of this.messages) {
      const u = this.toAtMember({ uid: m.uid, name: m.username, avatar: m.avatar });
      if (u.uid && u.name && !uniq.has(u.uid)) uniq.set(u.uid, u);
    }
    return this.ensureSelf([...uniq.values()]);
  }

  private async resolveMembers(): Promise<AtMemberUser[]> {
    const fromState = await this.getMembersFromState();
    if (fromState.length) return fromState;

    const fromFs = await this.getMembersFromFirestore();
    if (fromFs.length) return fromFs;

    return this.getMembersFromMessages();
  }

  name = '';
  avatar = '';

  isSending = false;
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

    await this.currentUserService.hydrateFromLocalStorage();
    const u = this.currentUserService.getCurrentUser();
    if (u) {
      this.uid = u.uid;
      this.name = u.name;
      this.avatar = u.avatar;
    }

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

    this.initializeSubscriptions();
  }

  private updateOwnMessagesProfile() {
    // Update all own messages with new name/avatar
    this.messages = this.messages.map(m => {
      if (m.uid === this.uid) {
        return { ...m, username: this.name, avatar: this.avatar };
      }
      return m;
    });
    this.rebuildMessagesView();
    this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reagiere auf channelId-Änderungen (Channel-Wechsel)
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      this.restartSubscriptions();
    }
  }

  private initializeSubscriptions() {
    if (!this.uid || !this.channelId) return;

    // Alte Subscriptions aufräumen falls vorhanden
    this.cleanupSubscriptions();

    // Channel-Updates abonnieren
    this.listenToChannelUpdates();

    // Messages laden
    this.startListening();
  }

  private restartSubscriptions() {
    this.initializeSubscriptions();
  }

  private cleanupSubscriptions() {
    this.unsub?.();
    this.unsub = null;
    this.channelSubscription?.unsubscribe();
    this.channelSubscription = null;

    // Messages zurücksetzen
    this.messages = [];
    this.messagesView = [];
  }

  private listenToChannelUpdates() {
    if (!this.uid || !this.channelId) return;

    const membershipRef = doc(
      this.firestore,
      `users/${this.uid}/memberships/${this.channelId}`
    );

    // 🔥 LIVE-SUBSCRIPTION: Automatische Updates bei Änderungen
    this.channelSubscription = docData(membershipRef).subscribe((channelData: any) => {
      if (channelData) {
        this.channelName = channelData.name || this.channelName;
        // Manuelle Change Detection triggern
        this.cdr.detectChanges();
      }
    });
  }

  private startListening() {
    if (!this.uid || !this.channelId) return;
    this.unsub = this.messageStoreSvc.listenChannelMessages(
      this.uid,
      this.channelId,
      (docs) => {
        this.messages = docs.map(d => this.mapDocToMessage(d));
        this.rebuildMessagesView();
        // Manuelle Change Detection triggern
        this.cdr.detectChanges();
        queueMicrotask(() => this.scrollToBottom());
      }
    );
  }

  ngAfterViewInit() {
    this.rebuildMessagesView();
    queueMicrotask(() => this.scrollToBottom());
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
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
        const emojiId: EmojiId = isEmojiId(r.emojiId) ? r.emojiId : 'rocket';
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
    const text = this.emojiSvc.normalizeShortcodes((this.draft ?? '').trim());
    if (!text || !this.uid || !this.channelId) return;

    if (this.isSending) return;
    this.isSending = true;

    try {
      const u = this.currentUserService.getCurrentUser();
      if (!u) return;

      if (this.editForId) {
        await this.messageStoreSvc.updateChannelMessage(
          this.uid, this.channelId, this.editForId, text
        );
        this.editForId = null;
        this.draft = '';
        this.cdr.detectChanges();
        return;
      }

      await this.messageStoreSvc.sendChannelMessage(this.uid, this.channelId, {
        text,
        author: { uid: u.uid, username: u.name, avatar: u.avatar },
      });

      this.draft = '';
      this.cdr.detectChanges();
    } finally {
      this.isSending = false;
      this.cdr.detectChanges();
    }
  }

  async toggleReaction(m: any, emojiId: EmojiId) {
    if (!this.uid) return;
    const you = { userId: this.uid, username: this.name };
    await this.messageStoreSvc.toggleChannelReaction(this.uid, this.channelId, m.messageId, emojiId, you);
  }

  async toggleEmojiFromReactions(m: Message, event: MouseEvent) {
    const origin = event.currentTarget as HTMLElement | null;
    if (!origin) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, origin, {
      width: 350,
      height: 420,
      preferredSide: 'bottom',
      align: 'end',
      offset: 8,
      dialogConfig: { panelClass: 'add-emojis-dialog-panel' }
    }).afterClosed().subscribe((emojiId: string | null) => {
      if (emojiId && this.emojiSvc.isValid(emojiId)) {
        this.toggleReaction(m, emojiId as EmojiId);
      }
    });
  }

  async toggleEmojiFromReactionBar(m: Message, event: MouseEvent) {
    const origin = event.currentTarget as HTMLElement | null;
    if (!origin) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AddEmojis, origin, {
      width: 350,
      height: 420,
      preferredSide: 'bottom',
      align: 'start',
      offset: 8,
      dialogConfig: { panelClass: 'add-emojis-dialog-panel' }
    }).afterClosed().subscribe((emojiId: string | null) => {
      if (emojiId && this.emojiSvc.isValid(emojiId)) {
        this.toggleReaction(m, emojiId as EmojiId);
      }
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
    const members = await this.resolveMembers();

    const origin = trigger as HTMLElement | null;
    if (!origin) return;

    this.anchorOverlaySvc.openAnchored(this.dialog, AtMembers, origin, {
      width: 400,
      height: 100,
      preferredSide: 'top',
      align: 'start',
      offset: 400,
      dialogConfig: {
        panelClass: 'at-members-dialog-panel',
        data: {
          channelId: this.channelId,
          currentUserId: this.uid,
          members
        }
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
      const otherUsers = reactedUsers.filter((name) => name !== this.name);
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
    this.cdr.detectChanges();
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

  openThread(m: Message) {
    if (!this.uid || !this.channelId) return;
    this.layout.openRight();
    this.threadStateSvc.open({
      uid: this.uid,
      channelId: this.channelId,
      channelName: this.channelName,
      messageId: m.messageId,
      root: {
        author: { uid: m.uid, username: m.username, avatar: m.avatar },
        createdAt: m.createdAt,
        text: m.text,
        reactions: m.reactions?.map(r => ({
          emojiId: r.emojiId,
          emojiCount: r.emojiCount,
          reactionUsers: r.reactionUsers.map(u => ({ userId: u.userId, username: u.username }))
        })) ?? [],
        isYou: m.isYou
      }
    });
  }

  toggleEditMessagePanel(m: Message, ev: MouseEvent) {
    ev.stopPropagation();
    this.clearEditMessagePanelHide();
    this.showEditPanelForId = this.showEditPanelForId === m.messageId ? null : m.messageId;
    this.cdr.detectChanges();
  }

  scheduleEditMessagePanelHide(m: Message) {
    if (this.showEditPanelForId !== m.messageId) return;
    this.clearEditMessagePanelHide();
    this.editHideTimer = setTimeout(() => {
      this.showEditPanelForId = null;
      this.cdr.detectChanges();
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
    this.cdr.detectChanges();
    queueMicrotask(() => this.composerTextarea?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape') closeOnEsc() {
    this.editForId = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.showEditPanelForId = null;
      this.cdr.detectChanges();
    }
  }

  private scrollToBottom() {
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}