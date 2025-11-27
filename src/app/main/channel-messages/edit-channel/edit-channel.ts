import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../../../services/firebase';
import { Channel } from "../../../main/menu/channels/channel.model";
import { Observable } from 'rxjs';
import { collection, doc } from '@angular/fire/firestore';
import { getDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';





@Component({
  selector: 'app-edit-channel',
  imports: [CommonModule],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss',
})
export class EditChannel {
  dialogRef = inject(MatDialogRef<EditChannel>);
  showInputName = false;
  showInputDescription = false;
  closeName = true;
  closeDescription = true;
  firestore: Firestore = inject(Firestore);
  memberships: any[] = [];
  data = inject(MAT_DIALOG_DATA);
  channel: any;


  constructor(private channelService: FirebaseService, private cdr: ChangeDetectorRef) { }

  async ngOnInit() {
    this.loadData();
  }


  async loadData() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;

    const userRef = doc(this.firestore, 'users', uid);
    const membershipsRef = collection(userRef, 'memberships');

    const channelRef = doc(this.firestore, `users/${uid}/memberships/${this.data.channelId}`);
    const snap = await getDoc(channelRef);
    if (snap.exists()) {
      this.channel = snap.data();
      this.cdr.detectChanges();
    }
  }


  close() {
    this.dialogRef.close();
  }


  toggleEditName() {
    this.showInputName = true;
    this.closeName = false;
  }

  toggleEditDescription() {
    this.showInputDescription = true;
    this.closeDescription = false;

  }

  saveEditName() {
    this.showInputName = false;
    this.closeName = true;
  }

  saveEditDescription() {
    this.showInputDescription = false;
    this.closeDescription = true;

  }


}
