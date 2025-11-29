import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditChannel } from '../edit-channel/edit-channel';
import { EditMembers } from '../edit-members/edit-members';
import { AddMembers } from '../add-members/add-members';

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
  @Input() members: Member[] = [];

  private dialog = inject(MatDialog);

  renderMembers(): Member[] {
  if (!this.members || this.members.length === 0) return [];
  
  return [...this.members]
    .map(m => ({
      ...m,
      avatar: m.avatar || '', // fallback leerer String, kein null
      name: m.name || 'Unbekannt'
    }))
    .sort((a, b) => (a.isYou === b.isYou ? 0 : a.isYou ? -1 : 1));
    debugger
}

  get memberCount() {
    return this.members.length;
  }


  openEditChannel(trigger: HTMLElement, channel: any) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 872;

    this.dialog.open(EditChannel, {
      width: dlgW + 'px',
      panelClass: 'edit-channel-dialog-panel',
      position: {
        top: `${r.bottom + gap}px`,
        left: `${-420 + dlgW}px`
      },
        data: { channel }  

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
      }
    });
  }
}