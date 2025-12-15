import { Component, Input, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditChannel } from '../edit-channel/edit-channel';
import { EditMembers } from '../edit-members/edit-members';
import { AddMembers } from '../add-members/add-members';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { Subscription } from 'rxjs';

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

  private channelSubscription: Subscription | null = null;
  private stateSubscription: Subscription | null = null;
  private currentUserId: string = '';

  ngOnInit() {
    // User ID laden
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserId = storedUser ? JSON.parse(storedUser).uid : '';

    // 🔥 LIVE-UPDATES: Channel-Daten direkt von Firestore abonnieren
    this.listenToChannelUpdates();

    // Channel-State auch abonnieren (für andere Updates)
    this.stateSubscription = this.channelState.selectedChannel$.subscribe(channel => {
      if (channel && channel.id === this.channelId) {
        this.updateChannelData(channel);
      }
    });
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

    // Members mit korrekten IDs und isYou-Flag aktualisieren
    this.members = (channel.members || []).map((m: any) => ({
      id: m.uid || m.id,
      uid: m.uid || m.id,
      name: m.name,
      avatar: m.avatar,
      isYou: (m.uid || m.id) === this.currentUserId
    }));
  }

  ngOnDestroy() {
    this.channelSubscription?.unsubscribe();
    this.stateSubscription?.unsubscribe();
  }

  renderMembers(): Member[] {
    if (!this.members || this.members.length === 0) return [];

    return [...this.members]
      .map(m => ({
        ...m,
        avatar: m.avatar || '',
        name: m.name || 'Unbekannt'
      }))
      .sort((a, b) => (a.isYou === b.isYou ? 0 : a.isYou ? -1 : 1));
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
      width: dlgW + 'px',
      panelClass: 'edit-channel-dialog-panel',
      position: {
        top: `${r.bottom + gap}px`,
        left: `${-420 + dlgW}px`
      },
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
        left: `${460 + dlgW}px`
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