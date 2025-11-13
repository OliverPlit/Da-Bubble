import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-add-people',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-people.html',
  styleUrl: './add-people.scss',
})
export class AddPeople {
  dialogRef = inject(MatDialogRef<AddPeople>)
  showExtraFields = false;
selectedOption: 'option1' | 'option2' | null = null;
  inputName = "";

  toggleExtraField(status: boolean) {
    this.showExtraFields = status;
  }


  closeDialog() {
    this.dialogRef.close();
  }

isFormValid() : boolean {
if (!this.selectedOption) return false;

if (this.selectedOption == 'option2') {
  return this.inputName.trim().length > 3 
}


return true;
}

create() {
  console.log('erstellt');
  
}

}
