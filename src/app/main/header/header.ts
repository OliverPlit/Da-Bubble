import { Component, inject, HostListener  } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { Profile } from './profile/profile';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatMenuTrigger } from '@angular/material/menu';




@Component({
  selector: 'app-header',
  imports: [MatMenuModule, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss', './header.responsive.scss'],
})
export class Header {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  isMobile = false;
  mobileMenuOpen = false

  openDialog() {
    this.dialog.open(Profile, {
      panelClass: 'profile-dialog-panel',
      position: { top: '120px', right: '20px' }

    });
  }

  logout() {
    this.router.navigate(['']);
  }


    ngOnInit() {
    this.checkWidth();
  }

  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 400; 
  }

  openMenu() {
    if (this.isMobile) {
      this.mobileMenuOpen = true;
    } else {
    }
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

}

