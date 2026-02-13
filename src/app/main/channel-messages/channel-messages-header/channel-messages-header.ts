import { Component, Input, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditChannel } from '../edit-channel/edit-channel';
import { EditMembers } from '../edit-members/edit-members';
import { AddMembers } from '../add-members/add-members';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { LayoutService } from '../../../services/layout.service';
import { Subscription } from 'rxjs';
import { FirebaseService } from '../../../services/firebase';

type Member = {
  id: string;
  name: string;
  avatar?: string;
  isYou?: boolean;
  uid?: string;
};

@Component({
  selector: 'app-channel-messages-header',
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './channel-messages-header.html',
  styleUrl: './channel-messages-header.scss',
})
export class ChannelMessagesHeader implements OnInit, OnDestroy {
  @Input() fullChannel: any = null;
  @Input() channel = '';
  @Input() channelId = '';
  @Input() description = '';
  @Input() createdBy = '';
  selectedChannel: any = null;

  @Input() members: Member[] = [];

  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private channelState = inject(ChannelStateService);
  layout = inject(LayoutService);

  private channelSubscription: Subscription | null = null;
  private stateSubscription: Subscription | null = null;
  private profileSubscription: Subscription | null = null;
  private currentUserId: string = '';
  private firebaseService = inject(FirebaseService);
  private cdr = inject(ChangeDetectorRef);

  goBack() {
    this.layout.showMenu();
  }

  ngOnInit() {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserId = storedUser ? JSON.parse(storedUser).uid : '';

    if (this.channelId && this.currentUserId) {
      this.listenToChannelUpdates();
    }

    this.stateSubscription = this.channelState.selectedChannel$.subscribe(channel => {
      if (channel && channel.id === this.channelId) {
        this.updateChannelData(channel);
      }
    });

    this.profileSubscription = new Subscription();

    this.profileSubscription.add(
      this.firebaseService.currentName$.subscribe((name) => {
        if (!name) return;
        this.patchSelfMember({ name });
        this.cdr.detectChanges();
      })
    );

    this.profileSubscription.add(
      this.firebaseService.currentAvatar$.subscribe((avatar) => {
        if (!avatar) return;
        this.patchSelfMember({ avatar });
        this.cdr.detectChanges();
      })
    );
  }

  private patchSelfMember(patch: Partial<Pick<Member, 'name' | 'avatar'>>) {
    if (!this.currentUserId) return;

    const idx = this.members.findIndex(m => (m.uid || m.id) === this.currentUserId);
    if (idx === -1) return;

    const next = [...this.members];
    next[idx] = { ...next[idx], ...patch, isYou: true };
    this.members = next;
  }

  renderMembers(): Member[] {
    return [...this.members]
      .map(m => ({
        ...m,
        avatar: m.avatar || '',
        name: m.name || 'Unbekannt'
      }))
      .sort((a, b) => (a.isYou === b.isYou ? 0 : a.isYou ? -1 : 1))
      .slice(0, 3);
  }
  private listenToChannelUpdates() {
    if (!this.currentUserId || !this.channelId) return;

    const membershipRef = doc(
      this.firestore,
      `users/${this.currentUserId}/memberships/${this.channelId}`
    );

    // 🔥 LIVE-SUBSCRIPTION: Automatische Updates bei Änderungen
    this.channelSubscription = docData(membershipRef).subscribe((channelData: any) => {
      if (channelData) {
        this.updateChannelData({ ...channelData, id: this.channelId });
      }
    });
  }

  private updateChannelData(channel: any) {
    this.channel = channel.name || this.channel;
    this.description = channel.description || this.description;
    this.createdBy = channel.createdBy || this.createdBy;

    const currentName = this.firebaseService.currentNameValue;
    const currentAvatar = this.firebaseService.currentAvatarValue;

    // Members mit korrekten IDs und isYou-Flag aktualisieren
    this.members = (channel.members || []).map((m: any) => {
      const uid = m.uid || m.id;
      const isYou = uid === this.currentUserId;

      return {
        id: uid,
        uid,
        name: isYou && currentName ? currentName : m.name,
        avatar: isYou && currentAvatar ? currentAvatar : m.avatar,
        isYou
      } as Member;
    });
  }

  ngOnDestroy() {
    this.channelSubscription?.unsubscribe();
    this.stateSubscription?.unsubscribe();
    this.profileSubscription?.unsubscribe();
  }



  get memberCount() {
    return this.members.length;
  }

  openEditChannel(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 872;

    const channelData = {
      id: this.fullChannel?.id || this.channelId,
      name: this.fullChannel?.name || this.channel,
      members: this.fullChannel?.members || this.members,
      description: this.fullChannel?.description || this.description,
      createdBy: this.fullChannel?.createdBy || this.createdBy
    };

    this.dialog.open(EditChannel, {
      width: this.layout.isMobile() ? '100%' : dlgW + 'px',
      maxWidth: this.layout.isMobile() ? '100vw' : 'none',
      panelClass: 'edit-channel-dialog-panel',
      ...(this.layout.isMobile() ? {} : {
        position: {
          top: `${r.bottom + gap}px`,
          left: `${-420 + dlgW}px`
        }
      }),
      data: { channel: channelData }
    });
  }

  openEditMembers(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 415;

    // Members mit uid-Feld für edit-members
    const membersForDialog = this.members.map(m => ({
      uid: m.uid || m.id,
      name: m.name,
      avatar: m.avatar,
      isYou: m.isYou
    }));

    this.dialog.open(EditMembers, {
      width: dlgW + 'px',
      panelClass: 'edit-members-dialog-panel',
      position: {
        top: `${r.bottom + gap}px`,
        left: `${r.right - dlgW}px`
      },
      data: {
        channelId: this.channelId,
        channelName: this.channel,
        members: membersForDialog,
        channelState: this.channelState
      }
    });
  }

  openAddMembers(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 514;

    // Members mit uid-Feld für add-members
    const membersForDialog = this.members.map(m => ({
      uid: m.uid || m.id,
      name: m.name,
      avatar: m.avatar,
      isYou: m.isYou
    }));

    this.dialog.open(AddMembers, {
      width: dlgW + 'px',
      panelClass: 'add-members-dialog-panel',
      position: {
        top: `${r.bottom + gap}px`,
        left: `${r.right - dlgW}px`
      },
      data: {
        channelId: this.channelId,
        channelName: this.channel,
        existingMembers: membersForDialog,
        channelState: this.channelState
      }
    });
  }
}