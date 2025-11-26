import { Component, inject,  } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';






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


  close() {
    this.dialogRef.close();
  }

  async save(channelForm: NgForm) {
 const newName = this.nameInput.trim();
  if (!newName) return;


 const uid = this.data.uid;
  const userRef = doc(this.firestore, 'users', uid);

  await updateDoc(userRef, { name: newName });


    this.dialogRef.close(newName)
  }
}

