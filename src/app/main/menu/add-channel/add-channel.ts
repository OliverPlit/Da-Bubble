import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { AddPeople } from './add-people/add-people';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';
import { FirebaseService } from '../../../services/firebase';
import { Firestore, collection, collectionData, doc, setDoc, getDoc, getDocs, query } from '@angular/fire/firestore';
import { ChannelStateService } from '../../menu/channels/channel.service';





@Component({
  selector: 'app-add-channel',
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormsModule],
  templateUrl: './add-channel.html',
  styleUrl: './add-channel.scss',
})
export class AddChannel {
  private dialog = inject(MatDialog);
  firestore: Firestore = inject(Firestore);
  memberships: any[] = [];
channelNameExists = false;

  constructor(private channelState: ChannelStateService) { }
  dialogRef = inject(MatDialogRef<AddChannel>);

  close() {
    this.dialogRef.close();
  }

  save() {
    this.dialogRef.close('saved');

  }

  async openDialogPeople(form: NgForm) {
    if (form.invalid) return;

    const name = form.value.channelName;
    const description = form.value.description;

    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;
    const userRef = doc(this.firestore, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
const membershipsRef = collection(userRef, 'memberships');

const membershipsSnap = await getDocs(query(membershipsRef));
const channelExists = membershipsSnap.docs.some(doc =>
  doc.data()['name']?.toLowerCase() === name.toLowerCase()
);

if (channelExists) {
  this.channelNameExists = true;
  return;
}
    const membershipDocRef = doc(membershipsRef);
    const channelId = membershipDocRef.id;

    await setDoc(membershipDocRef, {
      channelId,
      name,
      description,
      joinedAt: new Date(),
      members: [],
      createdBy: userData['name']
    });

    this.channelState.selectChannel({
      id: channelId,
      name,
      description,
      members: [{
        uid: uid,
        name: `${userData['name']} (Du)`,
        avatar: userData['avatar'] || 'avatar-0.png',
        email: userData['email'] || '',
        isYou: true
      }]
    });
    this.dialog.open(AddPeople, {
      panelClass: 'add-people-dialog-panel',
      data: { channelId, channelState: this.channelState }
    });

    this.close();
  }
}


