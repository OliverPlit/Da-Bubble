import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-choose-avatar',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './choose-avatar.html',
  styleUrl: './choose-avatar.scss',
})
export class ChooseAvatar {
  
  selectedAvatar: string = 'avatar1.png';

  constructor(private firestore: Firestore, private router: Router, private cd: ChangeDetectorRef) {}

selectAvatar(avatar: string) {
  this.selectedAvatar = avatar;
  this.cd.detectChanges(); 
}


  async saveAvatar() {
    const userId = localStorage.getItem('pendingUserId');
    if (!userId) return;

    const userRef = doc(this.firestore, `users/${userId}`);

    await updateDoc(userRef, {
      avatar: this.selectedAvatar
    });

    this.router.navigate(['/']);
  }

  goBack() {
    localStorage.setItem('skipIntro', 'true');
    this.router.navigate(['/signup']);
  }
}