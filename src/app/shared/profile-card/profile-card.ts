import { Component, inject, Inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';


@Component({
  selector: 'app-profile-card',
  imports: [],
  templateUrl: './profile-card.html',
  styleUrl: './profile-card.scss',
})
export class ProfileCard {
  dialogRef = inject(MatDialogRef<ProfileCard>);
  private dialog = inject(MatDialog);
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}

  close() {
    this.dialogRef.close();
  }

}
