import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { AddPeople } from './add-people/add-people';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';
import { FirebaseService } from '../../../services/firebase';
import { Firestore, collection, collectionData, doc, setDoc } from '@angular/fire/firestore';





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

  constructor(private firebaseService: FirebaseService) { }
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
  const membershipsRef = collection(userRef, 'memberships');
   const membershipDocRef = doc(membershipsRef); 
  const channelId = membershipDocRef.id; 

  await setDoc(membershipDocRef, {
    channelId,
    name,
    description,
    joinedAt: new Date(),
    members: []  
  });


  this.dialog.open(AddPeople, {
    panelClass: 'add-people-dialog-panel',
    data: { channelId}
  });

  this.close();
}
}

