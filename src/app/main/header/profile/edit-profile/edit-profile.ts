import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';


@Component({
  selector: 'app-edit-profile',
  imports: [],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
})
export class EditProfile {

   dialogRef = inject(MatDialogRef<EditProfile>);


  close() {
    this.dialogRef.close();
  }
}

