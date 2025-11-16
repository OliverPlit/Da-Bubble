import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditChannel } from '../edit-channel/edit-channel';
import { EditMembers } from '../edit-members/edit-members';
import { AddMembers } from '../add-members/add-members';

type Member = {
  id: string;
  name: string;
  avatar?: string;
  isYou?: boolean
};

@Component({
  selector: 'app-channel-messages-header',
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './channel-messages-header.html',
  styleUrl: './channel-messages-header.scss',
})
export class ChannelMessagesHeader {
  channelName = 'Entwicklerteam';

  members: Member[] = [
    { id: 'u_me', name: 'Oliver Plit', avatar: 'icons/avatars/avatar6.png', isYou: true },
    { id: 'u_nb', name: 'Noah Braun', avatar: 'icons/avatars/avatar3.png' },
    { id: 'u_sm', name: 'Sofia Müller', avatar: 'icons/avatars/avatar1.png' },
    { id: 'u_fb', name: 'Frederik Beck', avatar: 'icons/avatars/avatar2.png' },
  ];

  get membersRtl(): Member[] {
    return [...this.members].sort((a, b) => (b.isYou ? 1 : 0) - (a.isYou ? 1 : 0));
  }

  memberCount = this.members.length;

  private dialog = inject(MatDialog)

  openEditChannel(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 16;
    const dlgW = 872;

    this.dialog.open(EditChannel, {
      width: dlgW + 'px',
      panelClass: 'edit-channel-dialog-panel',
      position: {
        top: `${r.bottom + gap}px`,
        left: `${-420 + dlgW}px`
      }
    });
  }

  openEditMembers() {
    this.dialog.open(EditMembers, {
      panelClass: 'edit-members-dialog-panel'
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