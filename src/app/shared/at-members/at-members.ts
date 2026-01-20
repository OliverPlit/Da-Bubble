import { Component, Inject, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CurrentUserService, CurrentUser, AvatarUrlPipe } from '../../services/current-user.service';
import { PresenceService } from '../../services/presence.service';
import { Firestore, doc, getDoc, docData } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChannelStateService } from '../../main/menu/channels/channel.service';
import { FirebaseService } from '../../services/firebase';

export type User = {
  uid: string;
  name: string;
  avatar: string;
  isYou: boolean;
  isOnline?: boolean;
};

type DialogData = {
  channelName?: string;
  members?: User[];
  currentUserId?: string;
  channelId?: string;
};

@Component({
  selector: 'app-at-members',
  imports: [CommonModule, AvatarUrlPipe],
  templateUrl: './at-members.html',
  styleUrl: './at-members.scss',
})
export class AtMembers implements OnInit, OnDestroy {
  private dialogRef = inject(MatDialogRef<AtMembers, string | null>);
  private currentUserService = inject(CurrentUserService);
  public presence = inject(PresenceService);
  private firestore = inject(Firestore);
  private cd = inject(ChangeDetectorRef);
  private channelState = inject(ChannelStateService);
  private firebaseService = inject(FirebaseService);

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData | null) { }

  channelName = '';
  currentUserId = '';
  userName = '';

  members = signal<User[]>([]);
  orderedMembers = computed(() => {
    const you = this.currentUserId;
    return [...this.members()].sort((a, b) => {
      const aYou = a.uid === you ? 1 : 0;
      const bYou = b.uid === you ? 1 : 0;
      return bYou - aYou;
    });
  });

  private membershipSubscription: Subscription | null = null;
  private nameSubscription: Subscription | null = null;

  async ngOnInit() {
    if (this.data?.channelName) this.channelName = this.data.channelName;
    if (this.data?.currentUserId) this.currentUserId = this.data.currentUserId;

    const initial = this.data?.members || [];
    this.members.set([...initial]);

    await this.initUserId();

    if (this.currentUserId && !this.members().some(m => m.uid === this.currentUserId)) {
      const storedUser = localStorage.getItem('currentUser');
      const me = storedUser ? JSON.parse(storedUser) : null;
      if (me) this.members.update(l => [...l, { uid: me.uid, name: me.name, avatar: me.avatar ?? '', isYou: true }]);
    }

    this.listenToMembershipChanges();

    this.nameSubscription = this.firebaseService.currentName$.subscribe((name) => {
      if (!name) return;
      this.userName = name;

      this.members.update((members) =>
        members.map((m) => (m.uid === this.currentUserId ? { ...m, name: `${name} (Du)` } : m))
      );

      this.cd.detectChanges();
    });
  }

  private listenToMembershipChanges() {
    if (!this.currentUserId || !this.data?.channelId) return;

    const membershipRef = doc(
      this.firestore,
      `users/${this.currentUserId}/memberships/${this.data.channelId}`
    );

    this.membershipSubscription = docData(membershipRef).subscribe((channelData: any) => {
      if (!channelData?.members) return;

      const updatedMembers = channelData.members.map((m: User) => {
        if (m.uid === this.currentUserId) {
          const currentName = this.firebaseService.currentNameValue || 'Du';
          return { ...m, name: `${currentName} (Du)` };
        }
        return m;
      });

      this.members.set(updatedMembers);
      this.cd.detectChanges();
    });
  }

  private async initUserId() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const { uid } = JSON.parse(storedUser) || {};
    if (!uid) return;

    this.currentUserId = this.currentUserId || uid;

    const userRef = doc(this.firestore, 'directMessages', this.currentUserId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data?.name || '';
      this.firebaseService.setName(this.userName);
      this.cd.detectChanges();
    }
  }

  ngOnDestroy() {
    this.membershipSubscription?.unsubscribe();
    this.nameSubscription?.unsubscribe();
  }

  choose(u: User) {
    this.dialogRef.close(`@${u.name}`);
  }

  close() {
    this.dialogRef.close(null);
  }

  getStatus(uid: string): 'online' | 'offline' {
    const map = this.presence.userStatusMap();
    return map[uid] ?? 'offline';
  }

  isYou(u: User) {
    return u.uid === this.currentUserId || /\(Du\)\s*$/.test(u.name);
  }
}