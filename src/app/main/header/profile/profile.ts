import { Component, inject, HostListener } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { EditProfile } from './edit-profile/edit-profile';
import { FirebaseService } from '../../../services/firebase';
import { CommonModule } from '@angular/common';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { PresenceService } from '../../../services/presence.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss', './profile.responsive.scss'],
})
export class Profile {
  dialogRef = inject(MatDialogRef<Profile>);
  private dialog = inject(MatDialog);
  private firestore = inject(Firestore);
  private cd = inject(ChangeDetectorRef);
  public presence = inject(PresenceService);

  mobileEdit = false;
  userName: string = '';
  userEmail: string = '';
  userAvatar = '';
  userUid = '';

  constructor(private firebaseService: FirebaseService) {}

  ngOnInit() {
    this.checkWidth();
    this.loadUserData();
    this.firebaseService.currentName$.subscribe((name) => {
      if (name) {
        this.userName = name;
        this.cd.detectChanges();
      }
    });
  }

  getStatus(uid: string): 'online' | 'offline' {
    const map = this.presence.userStatusMap();
    return map[uid] ?? 'offline';
  }

  async loadUserData() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;
    this.userUid = uid;

    const userRef = doc(this.firestore, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data.name;
      this.userAvatar = data.avatar;
      this.userEmail = data.email;
      this.firebaseService.setName(this.userName);

      this.cd.detectChanges();
    }
  }

  openDialog() {
    const ref = this.dialog.open(EditProfile, {
      panelClass: 'edit-profil-dialog-panel',
      position: { top: '120px', right: '20px' },
      data: {
        name: this.userName,
        uid: JSON.parse(localStorage.getItem('currentUser') || '{}').uid,
      },
    });
  }
  @HostListener('window:resize')
  checkWidth() {
    this.mobileEdit = window.innerWidth <= 550;
  }

  close() {
    this.dialogRef.close();
  }
}
