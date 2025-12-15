import { Component, Inject, signal, computed, inject, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ProfileCard } from '../../../shared/profile-card/profile-card';
import { AddMembers } from '../add-members/add-members';
import { Firestore, doc, getDoc, docData } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { FirebaseService } from "../../../services/firebase";

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
  channelId?: string;
};

@Component({
  selector: 'app-edit-members',
  imports: [CommonModule],
  templateUrl: './edit-members.html',
  styleUrl: './edit-members.scss',
})
export class EditMembers implements OnDestroy {
  fullChannel: any = null;
  @Input() channel = '';
  @Input() channelId = '';
  @Input() members: Member[] = [];
  
  private cd = inject(ChangeDetectorRef);
  firestore = inject(Firestore);
  private channelState = inject(ChannelStateService);
  private firebaseService = inject(FirebaseService);

  channelName!: string;
  currentUserId!: string;
  userName = '';

  membersSignal = signal<Member[]>([]);
  orderedMembers = computed(() => {
    const you = this.currentUserId;
    return [...this.membersSignal()].sort((a, b) => {
      const aYou = a.uid === you ? 1 : 0;
      const bYou = b.uid === you ? 1 : 0;
      return bYou - aYou;
    });
  });

  private membershipSubscription: Subscription | null = null;
  private nameSubscription: Subscription | null = null;

  constructor(
    private dialogRef: MatDialogRef<EditMembers>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData | null,
    private dialog: MatDialog
  ) {}

  async ngOnInit() {
    if (this.data?.channelName) this.channelName = this.data.channelName;
    if (this.data?.currentUserId) this.currentUserId = this.data.currentUserId;

    const initial = this.data?.members || [];
    this.membersSignal.set([...initial]);

    await this.initUserId();

    this.listenToMembershipChanges();

    this.nameSubscription = this.firebaseService.currentName$.subscribe(name => {
      if (!name) return;
      this.userName = name;

      this.membersSignal.update(members =>
        members.map(m =>
          m.uid === this.currentUserId ? { ...m, name: `${name} (Du)` } : m
        )
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

      const updatedMembers = channelData.members.map((m: Member) => {
        if (m.uid === this.currentUserId) {
          const currentName = this.firebaseService.currentNameValue || 'Du';
          return { ...m, name: `${currentName} (Du)` };
        }
        return m;
      });

      this.membersSignal.set(updatedMembers);
      this.cd.detectChanges();
    });
  }

  async initUserId() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const userData = JSON.parse(storedUser);
    this.currentUserId = userData.uid;

    const userRef = doc(this.firestore, 'directMessages', this.currentUserId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data.name;
      this.firebaseService.setName(this.userName); 
      this.cd.detectChanges();
    }
  }

  ngOnDestroy() {
    this.membershipSubscription?.unsubscribe();
    this.nameSubscription?.unsubscribe();
  }

  close() {
    this.dialogRef.close();
  }

  openProfile(member: Member) {
    this.dialog.open(ProfileCard, {
      data: member,
      panelClass: 'profile-dialog-panel'
    });
  }

  openAddMembers() {
    const id = this.data?.channelId || this.channelId;
    const name = this.channelName;
    const members = this.membersSignal();
    this.dialogRef.close(); 

    this.dialog.open(AddMembers, {
      panelClass: 'add-members-dialog-panel',
      data: {
        channelId: id,
        channelName: name,
        existingMembers: members,
      },
    });
  }

  isYou(u: Member) { 
    return u.uid === this.currentUserId || /\(Du\)\s*$/.test(u.name); 
  }
}
