import { Component, inject, } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';
import { Firestore, doc, updateDoc, getDocs, collection, writeBatch, getDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { FirebaseService } from '../../../../services/firebase';
import { CommonModule } from '@angular/common';






@Component({
  selector: 'app-edit-profile',
  imports: [FormsModule, CommonModule],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.scss', 'edit-profile.responsive.scss'],
})
export class EditProfile {
  private firestore = inject(Firestore);
  data = inject(MAT_DIALOG_DATA);

userName = this.data.name;
userAvatar = this.data.avatar;
  nameInput: string = this.data.name;
  dialogRef = inject(MatDialogRef<EditProfile>);



  constructor(private cd: ChangeDetectorRef, private firebase: FirebaseService) { }

  selectAvatar(avatar: string) {
    this.userAvatar = avatar;
    this.cd.detectChanges();
  }



    isNameValid(): boolean {
    return !!this.nameInput && this.nameInput.trim().length >= 3;
  }

  close() {
    this.dialogRef.close();
  }

 async save(form: NgForm) {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const newName = this.nameInput.trim();
    
    if (!newName || newName.length < 3) return;

    const uid = this.data.uid;
    
    try {
      const userRef = doc(this.firestore, 'users', uid);
      await updateDoc(userRef, { name: newName, avatar: this.userAvatar });
      
      const dmRef = doc(this.firestore, 'directMessages', uid);
      const dmSnap = await getDoc(dmRef);
      if (dmSnap.exists()) {
        await updateDoc(dmRef, { name: newName, avatar: this.userAvatar });
      }
      
      await this.updateNameInAllChannelMemberships(uid, newName);

      this.firebase.setName(newName);
      this.firebase.setAvatar(this.userAvatar);
      this.cd.detectChanges();
      this.dialogRef.close({ name: newName, avatar: this.userAvatar });
      
    } catch (error) {
      console.error('❌ Fehler beim Speichern des Profils:', error);
    }
  }

  private async updateNameInAllChannelMemberships(uid: string, newName: string) {
    try {
      const usersCol = collection(this.firestore, 'users');
      const usersSnapshot = await getDocs(usersCol);
      
      const updatePromises: Promise<void>[] = [];
      let currentBatch = writeBatch(this.firestore);
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500;

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

            currentBatch.update(membershipRef, { members: updatedMembers });
            batchCount++;

            if (batchCount >= MAX_BATCH_SIZE) {
              updatePromises.push(currentBatch.commit());
              currentBatch = writeBatch(this.firestore);
              batchCount = 0;
            }
          }
        }
      }

      if (batchCount > 0) {
        updatePromises.push(currentBatch.commit());
      }

      await Promise.all(updatePromises);
      
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren der Memberships:', error);
      throw error;
    }
  }
}



