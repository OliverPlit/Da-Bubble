import { Component, Inject, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

type User = {
  uid: string;
  name: string;
  avatar: string;
  isOnline?: boolean;
}

type DialogData = {
  channelName?: string;
  members?: User[];
  currentUserId?: string;
};

@Component({
  selector: 'app-at-members',
  imports: [CommonModule],
  templateUrl: './at-members.html',
  styleUrl: './at-members.scss',
})
export class AtMembers {
  private fallback: User[] = [
    { uid: 'u_you', name: 'Frederik Beck (Du)', avatar: 'icons/avatars/avatar3.png', isOnline: true },
    { uid: 'u_sofia', name: 'Sofia Müller', avatar: 'icons/avatars/avatar4.png', isOnline: true },
    { uid: 'u_noah', name: 'Noah Braun', avatar: 'icons/avatars/avatar2.png', isOnline: true },
  ];

  channelName!: string;
  currentUserId!: string;

  members = signal<User[]>([]);
  orderedMembers = computed(() => {
    const you = this.currentUserId;
    return [...this.members()].sort((a, b) =>
      (b.uid === you ? 1 : 0) - (a.uid === you ? 1 : 0)
    );
  });

  constructor(
    private dialogRef: MatDialogRef<AtMembers>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData | null
  ) {
    this.channelName = data?.channelName ?? 'Entwicklerteam';
    this.currentUserId = data?.currentUserId ?? 'u_you';

    const initial = (data?.members && data.members.length) ? data.members : this.fallback;
    this.members.set([...initial]);
  }

  private dialog = inject(MatDialog)

  close() {
    this.dialogRef.close();
  }

  isYou(u: User) { return u.uid === this.currentUserId || /\(Du\)\s*$/.test(u.name); }

}
