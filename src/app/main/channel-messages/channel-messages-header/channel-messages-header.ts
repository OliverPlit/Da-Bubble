import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditChannel } from '../edit-channel/edit-channel';
import { EditMembers } from '../edit-members/edit-members';
import { AddMembers } from '../add-members/add-members';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ChannelStateService } from '../../menu/channels/channel.service'


type Member = { id: string; name: string; avatar?: string; isYou?: boolean };

@Component({
  selector: 'app-channel-messages-header',
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './channel-messages-header.html',
  styleUrl: './channel-messages-header.scss',
})
export class ChannelMessagesHeader {
  @Input() fullChannel: any = null;
  @Input() channel = '';
  @Input() channelId = '';
  @Input() description = '';
  @Input() createdBy = '';
  selectedChannel: any = null;

constructor(private channelState: ChannelStateService ){}
  @Input() members: Member[] = [];

  private firestore = inject(Firestore);

  private dialog = inject(MatDialog);


  ngOnInit() {
    console.log('Header Init: Vollständiges Channel-Objekt:', this.fullChannel);
    this.channelState.selectedChannel$.subscribe(channel => {
      if (channel) {
        this.fullChannel = channel;
        this.channel = channel.name || '';
        this.channelId = channel.id || '';
        this.description = channel.description || '';
        this.createdBy = channel.createdBy || '';
        this.members = channel.members || [];
      }
    });
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
    debugger
  }

  get memberCount() {
    return this.members.length;
  }


  openEditChannel(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 872;

    console.log('=== DEBUG openEditChannel ===');
    console.log('fullChannel:', this.fullChannel);
    console.log('channelId:', this.channelId);
    console.log('channel name:', this.channel);
    console.log('members:', this.members);
    console.log('des:', this.description);


    const channelData = {
      id: this.fullChannel?.id || this.channelId,
      name: this.fullChannel?.name || this.channel,
      members: this.fullChannel?.members || this.members,
      description: this.fullChannel?.description || this.description,
      createdBy: this.fullChannel?.createdBy || this.createdBy
    };

    console.log('Übergebe an Dialog:', channelData);


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

    this.dialog.open(EditMembers, {
      width: dlgW + 'px',
      panelClass: 'edit-members-dialog-panel',
      position: {
        top: `${r.bottom + gap}px`,
        left: `${460 + dlgW}px`
      },
      data: {
        channelId: this.channelId,
        members: this.members
      }
    });
  }

  openAddMembers(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 514;

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
        members: this.members
      }
    });
  }
}