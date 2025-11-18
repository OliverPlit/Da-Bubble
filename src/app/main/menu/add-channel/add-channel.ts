import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { AddPeople } from './add-people/add-people';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule, NgForm } from '@angular/forms';
import { FirebaseService } from '../../../services/firebase';





@Component({
  selector: 'app-add-channel',
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormsModule],
  templateUrl: './add-channel.html',
  styleUrl: './add-channel.scss',
})
export class AddChannel {
  private dialog = inject(MatDialog);
  constructor(private firebaseService: FirebaseService) { }
  dialogRef = inject(MatDialogRef<AddChannel>);

  close() {
    this.dialogRef.close();
  }

  save() {
    this.dialogRef.close('saved');

  }

  openDialogPeople(form: NgForm) {
    if (form.invalid) return;
    const name = form.value.channelName;
    const description = form.value.description;

    this.firebaseService.addDocument('channels', { name, description });



    this.dialog.open(AddPeople
      , {
        panelClass: 'add-people-dialog-panel',

      }
    )
    this.close();
  }
}

