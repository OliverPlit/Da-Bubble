import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { EditProfile } from './edit-profile/edit-profile';
import { FirebaseService } from '../../../services/firebase';




@Component({
  selector: 'app-profile',
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
   dialogRef = inject(MatDialogRef<Profile>);
 private dialog = inject(MatDialog);

  constructor(private firebaseService: FirebaseService) { }

openDialog() {
this.dialog.open(EditProfile, {
  panelClass: 'edit-profil-dialog-panel',
    position: { top: '120px', right: '20px' }

});  
}



close() {
    this.dialogRef.close();
  }
}
