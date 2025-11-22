import { Component, inject, HostListener } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { Profile } from './profile/profile';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatMenuTrigger } from '@angular/material/menu';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [MatMenuModule, CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss', './header.responsive.scss'],
})
export class Header {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private cd = inject(ChangeDetectorRef);
  isMobile = false;
  mobileMenuOpen = false;
  userName = '';
  userAvatar = '';

  openDialog() {
    this.dialog.open(Profile, {
      panelClass: 'profile-dialog-panel',
      ...(this.isMobile ? {} : { position: { top: '120px', right: '20px' } }),
    });
  }

  logout() {
    this.router.navigate(['']);
  }

  async ngOnInit() {
    this.checkWidth();
    await this.loadUser();
  }

  async loadUser() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;

    const userRef = doc(this.firestore, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data.name;
      this.userAvatar = data.avatar;

      this.cd.detectChanges();
    }
  }

  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 400;
    if (!this.isMobile) {
      this.mobileMenuOpen = false;
    }
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
