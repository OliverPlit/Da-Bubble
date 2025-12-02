import { Component, Inject, signal, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ProfileCard } from '../../../shared/profile-card/profile-card';
import { AddMembers } from '../add-members/add-members';

type Member = {
  uid: string;
  name: string;
  avatar?: string;
  status?: string;
  isYou?: boolean;
};

type DialogData = {
  channelName?: string;
  members?: Member[];
  currentUserId?: string;
};

@Component({
  selector: 'app-edit-members',
  imports: [CommonModule],
  templateUrl: './edit-members.html',
  styleUrl: './edit-members.scss',
})
export class EditMembers {
  @Input() fullChannel: any = null;
  @Input() channel = '';
  @Input() channelId = '';
  @Input() members: Member[] = [];

  channelName!: string;
  currentUserId!: string;

  membersSignal = signal<Member[]>([]);
  orderedMembers = computed(() => {
    const you = this.currentUserId;
    return [...this.membersSignal()].sort((a, b) =>
      (b.uid === you ? 1 : 0) - (a.uid === you ? 1 : 0)
    );
  });

  constructor(
    private dialogRef: MatDialogRef<EditMembers>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData | null
  ) {
    this.channelName = data?.channelName ?? 'Entwicklerteam';
    this.currentUserId = data?.currentUserId ?? 'u_you';

    const initial = data?.members?.length ? data.members : [];
    this.membersSignal.set([...initial]);
  }

  private dialog = inject(MatDialog)

  close() {
    this.dialogRef.close();
  }

openProfile(member: any) {
    this.dialog.open(ProfileCard, {
    data: member,
      panelClass: 'profile-dialog-panel'
    });
  }

  openAddMembers(): void {
    this.dialogRef.afterClosed().subscribe(() => {
      this.dialog.open(AddMembers, {
        panelClass: 'add-members-dialog-panel',
        data: {
          channelId: this.channelId,
          channelName: this.channel,
          members: this.members
        }
      });
    });
    this.dialogRef.close();
  }

  isYou(u: Member) { return u.uid === this.currentUserId || /\(Du\)\s*$/.test(u.name); }

}
