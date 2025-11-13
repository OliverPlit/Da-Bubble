import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { AddPeople } from './add-people/add-people';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';




@Component({
  selector: 'app-add-channel',
  imports: [CommonModule, MatDialogModule, MatButtonModule,FormsModule],
  templateUrl: './add-channel.html',
  styleUrl: './add-channel.scss',
})
export class AddChannel {
  private dialog = inject(MatDialog);

  dialogRef = inject(MatDialogRef<AddChannel>);

  close() {
    this.dialogRef.close();
  }

  save() {
    this.dialogRef.close('saved');
  }

  openDialogPeople(from: NgForm) {
    this.dialog.open(AddPeople
      , {
        panelClass: 'add-people-dialog-panel',

      }
    )
    this.close();
  }
}

