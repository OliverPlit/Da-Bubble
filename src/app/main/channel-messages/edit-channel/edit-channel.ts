import { Component, inject, OnInit, Input, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import { Firestore, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { FirebaseService } from '../../../services/firebase';
import { PresenceService } from '../../../services/presence.service';
import { AddMembers } from '../add-members/add-members';
import { GlobalChannelService } from '../../../services/global-channel-service';





@Component({
  selector: 'app-edit-channel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatInputModule, FormsModule],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss',
})
export class EditChannel implements OnInit, AfterViewInit {
  dialogRef = inject(MatDialogRef<EditChannel>);
  data = inject(MAT_DIALOG_DATA);
  firestore = inject(Firestore);
  private elementRef = inject(ElementRef<HTMLElement>);

  channel: any;
  editedName = '';
  editedDescription = '';
   userName: string = '';
  userAvatar: string = '';
  showInputName = false;
  showInputDescription = false;
  closeName = true;
  closeDescription = true;

  private dialog = inject(MatDialog);
  public presence = inject(PresenceService);
  private globalChannelService = inject(GlobalChannelService);

  constructor(private cdr: ChangeDetectorRef, private channelState: ChannelStateService, private firebaseService: FirebaseService) {
    this.dialogRef.afterOpened().subscribe(() => {
      this.scrollDialogToTop();
    });
  }

 
ngOnInit() {
    this.channel = this.data.channel;
    this.editedName = this.channel.name || '';
    this.editedDescription = this.channel.description || '';
 this.firebaseService.currentName$.subscribe((name) => {
      if (name) {
        this.userName = name;
        this.cdr.detectChanges();
      }
    });

    this.firebaseService.currentAvatar$.subscribe((avatar) => {
      if (avatar) {
        this.userAvatar = avatar;
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewInit() {
    this.scrollDialogToTop();
  }

  private scrollDialogToTop() {
    const run = () => {
      const el = this.elementRef.nativeElement;
      const surface = el.closest('.mat-mdc-dialog-surface') as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 0;
        surface.scrollTo(0, 0);
      }
      // Alle scrollbaren Vorfahren auf 0 setzen (z. B. CDK-Overlay)
      let parent: HTMLElement | null = el.parentElement;
      while (parent && parent !== document.body) {
        if (parent.scrollHeight > parent.clientHeight) {
          parent.scrollTop = 0;
          parent.scrollTo(0, 0);
        }
        parent = parent.parentElement;
      }
    };
    run();
    setTimeout(run, 0);
    requestAnimationFrame(() => {
      run();
      setTimeout(run, 50);
      setTimeout(run, 150);
      setTimeout(run, 400);
    });
  }


  close() {
    this.dialogRef.close();
  }

  private async refreshChannelMembers() {
    const uid = this.getCurrentUserId();
    if (!uid || !this.channel?.id) return;
    const membershipRef = doc(this.firestore, `users/${uid}/memberships/${this.channel.id}`);
    const snap = await getDoc(membershipRef);
    if (snap.exists() && snap.data()?.['members']) {
      const data = snap.data() as any;
      this.channel = { ...this.channel, members: data.members };
    }
  }

  private getCurrentUserId(): string {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored).uid : '';
  }

  isYou(m: { uid?: string; id?: string }): boolean {
    const uid = m.uid || m.id;
    return !!uid && uid === this.getCurrentUserId();
  }

  orderedMembers(): any[] {
    const members = this.channel?.members || [];
    const currentUid = this.getCurrentUserId();
    return [...members].sort((a, b) => {
      const aUid = a.uid || a.id;
      const bUid = b.uid || b.id;
      if (aUid === currentUid) return -1;
      if (bUid === currentUid) return 1;
      return 0;
    });
  }

  openAddMembers() {
    const membersForDialog = (this.channel?.members || []).map((m: any) => ({
      uid: m.uid || m.id,
      name: m.name,
      avatar: m.avatar,
      isYou: this.isYou(m)
    }));

    this.dialog.open(AddMembers, {
      width: '514px',
      maxWidth: '100vw',
      panelClass: 'add-members-dialog-panel',
      data: {
        channelId: this.channel.id,
        channelName: this.channel.name,
        existingMembers: membersForDialog,
        channelState: this.channelState
      }
    }).afterClosed().subscribe(async () => {
      await this.refreshChannelMembers();
      this.cdr.detectChanges();
    });
  }


  toggleEditName() {
    this.showInputName = true;
    this.closeName = false;
        this.editedName = this.channel.name || '';

  }

  toggleEditDescription() {
    this.showInputDescription = true;
    this.closeDescription = false;
        this.editedDescription = this.channel.description || '';


  }

  async saveEditName() {
    if (!this.editedName.trim()) return;

    const channelId = this.channel.id;
    const newName = this.editedName.trim();

    try {
      await this.globalChannelService.updateGlobalChannel(channelId, {
        name: newName,
        description: this.channel.description ?? '',
        createdBy: this.channel.createdBy ?? '',
        members: this.channel.members ?? []
      });
      await this.globalChannelService.syncAllUserMemberships(channelId, this.channel.members ?? []);
      this.channel.name = newName;
      this.channelState.updateSelectedChannel({ ...this.channel, name: newName });
      this.channelState.invalidateChannelAndReloadIfSelected(channelId);
      this.showInputName = false;
      this.closeName = true;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Channel-Namens:', error);
      alert('Fehler beim Speichern des Namens');
    }
  }

  async saveEditDescription() {
    const channelId = this.channel.id;
    const newDescription = this.editedDescription.trim();

    try {
      await this.globalChannelService.updateGlobalChannel(channelId, {
        name: this.channel.name ?? '',
        description: newDescription,
        createdBy: this.channel.createdBy ?? '',
        members: this.channel.members ?? []
      });
      await this.globalChannelService.syncAllUserMemberships(channelId, this.channel.members ?? []);
      this.channel.description = newDescription;
      this.channelState.updateSelectedChannel({ ...this.channel, description: newDescription });
      this.channelState.invalidateChannelAndReloadIfSelected(channelId);
      this.showInputDescription = false;
      this.closeDescription = true;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Channel-Beschreibung:', error);
      alert('Fehler beim Speichern der Beschreibung');
    }
  }


  async updateAllMembersChannelData(channelId: string, updates: { name?: string, description?: string }) {
    const allMembers: any[] = this.channel.members || [];

    const updatePromises = allMembers.map(async (member) => {
      try {
        const memberChannelRef = doc(
          this.firestore,
          `users/${member.uid}/memberships/${channelId}`
        );
        const memberSnap = await getDoc(memberChannelRef);
        if (memberSnap.exists()) {
          await updateDoc(memberChannelRef, updates);
        }
      } catch (error) {
        console.error(`Fehler beim Update für Member ${member.uid}:`, error);
      }
    });

    await Promise.all(updatePromises);
  }

async leaveChannel() {
  try {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const uid = JSON.parse(storedUser).uid;
    const channelId = this.channel.id;

    const userRef = doc(this.firestore, 'users', uid);
    const membershipRef = doc(userRef, 'memberships', channelId);
    await deleteDoc(membershipRef);


    const allMembers: any[] = this.channel.members || [];

    for (const member of allMembers) {
      if (member.uid === uid) continue;

      const otherUserRef = doc(this.firestore, `users/${member.uid}/memberships/${channelId}`);
      const otherSnap = await getDoc(otherUserRef);

      if (otherSnap.exists()) {
        const data = otherSnap.data();

        const updatedMembers = (data['members'] || []).filter((m: any) => m.uid !== uid);

        await updateDoc(otherUserRef, {
          members: updatedMembers
        });
      }
    }


    // 3️⃣ Channel aus UI entfernen
    this.channelState.removeChannel(channelId);
    await this.channelState.loadFirstAvailableChannel();
    this.dialogRef.close({ action: 'left', channelId });

  } catch (error) {
    console.error('Fehler beim Verlassen des Channels:', error);
    alert('Fehler beim Verlassen des Channels');
  }
}


}
