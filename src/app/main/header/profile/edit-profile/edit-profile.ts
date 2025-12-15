import { Component, inject, } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';
import { Firestore, doc, updateDoc, getDocs, collection, writeBatch } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { FirebaseService } from '../../../../services/firebase';






@Component({
  selector: 'app-edit-profile',
  imports: [FormsModule],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.scss', 'edit-profile.responsive.scss'],
})
export class EditProfile {
  private firestore = inject(Firestore);
  data = inject(MAT_DIALOG_DATA);
  nameInput: string = this.data.name;
  dialogRef = inject(MatDialogRef<EditProfile>);
  constructor(private cd: ChangeDetectorRef, private firebase: FirebaseService) { }


  close() {
    this.dialogRef.close();
  }

  async save(channelForm: NgForm) {
    const newName = this.nameInput.trim();
    if (!newName) return;

    const uid = this.data.uid;
    
    try {
      const userRef = doc(this.firestore, 'users', uid);
      await updateDoc(userRef, { name: newName });
      
      const dmRef = doc(this.firestore, 'directMessages', uid);
      await updateDoc(dmRef, { name: newName });
      
      await this.updateNameInAllChannelMemberships(uid, newName);

      this.firebase.setName(newName);
      
      this.cd.detectChanges();
      this.dialogRef.close(newName);
      
    } catch (error) {
      console.error('❌ Fehler beim Speichern des Namens:', error);
    }
  }

 private async updateNameInAllChannelMemberships(uid: string, newName: string) {
  try {
    const usersCol = collection(this.firestore, 'users');
    const usersSnapshot = await getDocs(usersCol);

    for (const userDoc of usersSnapshot.docs) {
      const membershipsCol = collection(
        this.firestore,
        `users/${userDoc.id}/memberships`
      );
      const membershipsSnapshot = await getDocs(membershipsCol);

      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data();
        const members = membershipData['members'] || [];

        const memberIndex = members.findIndex((m: any) => m.uid === uid);

        if (memberIndex !== -1) {
          const updatedMembers = [...members];
          const isCurrentUser = userDoc.id === uid;

          updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            name: isCurrentUser ? `${newName} (Du)` : newName
          };

          const membershipRef = doc(
            this.firestore,
            `users/${userDoc.id}/memberships/${membershipDoc.id}`
          );

          await updateDoc(membershipRef, { members: updatedMembers });
        }
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren der Memberships:', error);
  }
}

}

