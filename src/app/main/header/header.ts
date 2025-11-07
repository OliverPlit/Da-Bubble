import { Component, inject } from '@angular/core';
import {MatMenuModule} from '@angular/material/menu';
import { Profile } from './profile/profile';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';  


@Component({
  selector: 'app-header',
  imports: [MatMenuModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
 private dialog = inject(MatDialog);
 private router = inject(Router);

openDialog() {
this.dialog.open(Profile, {
  panelClass: 'profile-dialog-panel',
    position: { top: '120px', right: '20px' }

});  
}

 logout() {
    this.router.navigate(['']); 
  }
}

