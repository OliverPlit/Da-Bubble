import { Component, inject, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { AddEmojis } from '../../../shared/add-emojis/add-emojis';
import { AtMembers } from '../../../shared/at-members/at-members';
import type { User as AtMemberUser } from '../../../shared/at-members/at-members';
import { EmojiService, EmojiId } from '../../../services/emoji.service';
import { MessagesStoreService } from '../../../services/messages-store.service';
import { CurrentUserService } from '../../../services/current-user.service';
import { setDoc, Firestore, doc, updateDoc, arrayUnion, collection, collectionData, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { LayoutService } from '../../../services/layout.service';
import { AnchorOverlayService } from '../../../services/anchor-overlay.service';

@Component({
  selector: 'app-new-message',
  imports: [FormsModule, CommonModule],
  templateUrl: './new-message.html',
  styleUrl: './new-message.scss',
})
export class NewMessage {
  @Input() uid!: string;
  @Output() close = new EventEmitter<void>();
  private dialog = inject(MatDialog)
  firestore: Firestore = inject(Firestore);
  private emojiSvc = inject(EmojiService);
  private messageStoreSvc = inject(MessagesStoreService);
  private currentUserService = inject(CurrentUserService);
  public layout = inject(LayoutService);
  private anchorOverlaySvc = inject(AnchorOverlayService);
  selectedPeople: { uid: string, name: string, avatar: string, email: string, type?: 'user' | 'channel' }[] = [];
  allPeople: { uid: string, name: string, avatar: string, email: string }[] = [];
  filteredPeople: { uid: string, name: string, avatar: string, email: string, type: 'user' | 'channel' }[] = [];
  selectedChannel: { uid: string, name: string }[] = [];
  allChannels: { uid: string, name: string }[] = [];
  filteredChannel: { uid: string, name: string }[] = [];
  inputName: string = "";
  name = '';
  avatar = '';
  isSending = false;
  draft = '';
  search = true;

  async ngOnInit() {
    await this.currentUserService.hydrateFromLocalStorage();
    const u = this.currentUserService.getCurrentUser();
    if (u) {
      this.uid = u.uid;
      this.name = u.name;
      this.avatar = u.avatar;
    }

    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    const dmRef = collection(this.firestore, 'directMessages');
    const userRef = doc(this.firestore, 'users', uid);
    const channelsRef = collection(userRef, 'memberships');

    // Lade Personen
    collectionData(dmRef, { idField: 'uid' })
      .pipe(
        map(users =>
          users.map(u => ({
            uid: u['uid'] as string,
            name: u['name'] as string,
            avatar: u['avatar'] as string,
            email: (u['email'] as string) ?? ''
          }))
        )
      )
      .subscribe(users => {
        this.allPeople = users;
        this.filteredPeople = [];
      });

    // Lade Channels
    collectionData(channelsRef, { idField: 'uid' })
      .pipe(
        map(channels =>
          channels.map(c => ({
            uid: c['uid'] as string,
            name: c['name'] as string
          }))
        )
      )
      .subscribe(channels => {
        this.allChannels = channels;
      });
  }

  filterPeople() {
    const value = this.inputName.toLowerCase().trim();
    const startsWithAt = value.startsWith('@');
    const startsWithHash = value.startsWith('#');

    if (value.length < 1) {
      this.filteredPeople = [];
      this.search = false;
      return;
    }

    const searchValue = (startsWithAt || startsWithHash)
      ? value.substring(1).toLowerCase()
      : value.toLowerCase();

    if (searchValue.length < 1) {
      this.filteredPeople = [];
      this.search = false;
      return;
    }

    let filteredUsers: any[] = [];
    let filteredChannels: any[] = [];

    // Wenn @ eingegeben wurde, nur Personen durchsuchen
    if (startsWithAt) {
      filteredUsers = this.allPeople
        .filter(u => u.name.toLowerCase().includes(searchValue))
        .filter(u => !this.selectedPeople.some(sp => sp.uid === u.uid))
        .map(u => ({ ...u, type: 'user' as const }));
    }
    // Wenn # eingegeben wurde, nur Channels durchsuchen
    else if (startsWithHash) {
      filteredChannels = this.allChannels
        .filter(c => c.name.toLowerCase().includes(searchValue))
        .filter(c => !this.selectedPeople.some(sp => sp.uid === c.uid))
        .map(c => ({
          uid: c.uid,
          name: c.name,
          avatar: '',
          email: '',
          type: 'channel' as const
        }));
    }
    this.filteredPeople = [...filteredChannels, ...filteredUsers];
    this.search = this.filteredPeople.length > 0;
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.filteredPeople.length > 0) {
      event.preventDefault();
      this.selectPerson(this.filteredPeople[0]);
    }
  }

  selectPerson(person: { uid: string, name: string, avatar: string, email: string, type?: 'user' | 'channel' }) {
    if (this.selectedPeople.some(p => p.uid === person.uid)) return;

    this.selectedPeople.push(person);

    // Entferne aus der entsprechenden Liste
    if (person.type === 'channel') {
      this.allChannels = this.allChannels.filter(c => c.uid !== person.uid);
    } else {
      this.allPeople = this.allPeople.filter(p => p.uid !== person.uid);
    }

    this.inputName = '';
    this.filteredPeople = [];
    this.search = false;
  }

  removePerson(person: { uid: string, name: string, avatar: string, email: string, type?: 'user' | 'channel' }) {
    this.selectedPeople = this.selectedPeople.filter(p => p.uid !== person.uid);

    // Füge zurück zur entsprechenden Liste
    if (person.type === 'channel') {
      this.allChannels.push({ uid: person.uid, name: person.name });
      this.allChannels.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      this.allPeople.push(person);
      this.allPeople.sort((a, b) => a.name.localeCompare(b.name));
    }

    this.filterPeople();
  }

  closeMessage() {
    this.close.emit();
  }

  goBack() {
    this.layout.showMenu();
    this.close.emit();
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
    const currentUid = JSON.parse(localStorage.getItem('currentUser') || '{}')?.uid || '';

    const self = this.allPeople.find(p => p.uid === currentUid);
    const members = [
      ...(self ? [{ uid: self.uid, name: self.name, avatar: self.avatar, isYou: true }] : []),
      ...this.allPeople
        .filter(p => p.uid !== currentUid)
        .map(p => ({ uid: p.uid, name: p.name, avatar: p.avatar, isYou: false })),
    ];

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
          currentUserId: currentUid,
          members
        }
      }
    }).afterClosed().subscribe(mention => {
      if (!mention) return;
      this.draft = (this.draft || '').trimEnd() + (this.draft ? ' ' : '') + mention + ' ';
    });
  }

  async sendMessage() {
    const text = this.emojiSvc.normalizeShortcodes((this.draft ?? '').trim());
    if (!text) return;

    if (this.isSending) return;
    this.isSending = true;

    try {
      if (!this.uid || !this.name) {
        console.warn('Kein CurrentUser geladen – Author-Daten fehlen.');
        return;
      }

      const channel = this.selectedPeople.find(p => p.type === 'channel');
      const users = this.selectedPeople.filter(p => (p.type ?? 'user') === 'user');

      const payload = {
        text,
        author: { uid: this.uid, username: this.name, avatar: this.avatar }
      };

      try {
        if (channel) {
          await this.messageStoreSvc
            .sendChannelMessage(this.uid, channel.uid, payload);
        } else if (users.length > 0) {
          await Promise.all(
            users.map(u =>
              this.messageStoreSvc
                .sendDirectMessageBetween(this.uid, u.uid, payload)
            )
          );
        } else {
          return;
        }

        this.draft = '';
        this.close.emit();
      } catch (err) {
        console.error('sendMessage failed', err);
      }
    } finally {
      this.isSending = false;
    }
  }

  get composerPlaceholder(): string {
    if (!this.selectedPeople?.length) return 'Starte eine neue Nachricht';

    const channel = this.selectedPeople.find(p => p.type === 'channel');
    if (channel) return `Nachricht an #${channel.name}`;

    const users = this.selectedPeople.filter(p => (p.type ?? 'user') === 'user');
    if (users.length === 1) return `Nachricht an @${users[0].name}`;
    if (users.length === 2) return `Nachricht an @${users[0].name} und @${users[1].name}`;
    if (users.length > 2) return `Nachricht an @${users[0].name}, @${users[1].name} (+${users.length - 2})`;

    return 'Starte eine neue Nachricht';
  }
}