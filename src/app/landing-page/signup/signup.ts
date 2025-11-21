import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule , RouterModule],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  constructor(private router: Router, private firestore: Firestore) {}

  text = '';
  email = '';
  password = '';
  avatar = 'avatar1.png';
  acceptedPrivacy = false;

  submitted = false;
  nameError = false;
  emailError = false;
  passwordError = false;
  privacyError = false;

createUser() {
  const userData = {
    name: this.text,
    email: this.email,
    password: this.password, 
    avatar: this.avatar,              
    provider: 'password',
    isGuest: false,
    isOnline: true,
    isYou: true
  };

  const userRef = collection(this.firestore, 'users');
  return addDoc(userRef, userData);
}

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

async signUp() {
  this.submitted = true;
  this.nameError = this.text.trim() === '';
  this.emailError = !this.isValidEmail(this.email);
  this.passwordError = this.password.trim() === '';
  this.privacyError = !this.acceptedPrivacy;

  if (this.nameError || this.emailError || this.passwordError || this.privacyError) {
    return;
  }

  try {
    const userDocRef = await this.createUser();

    localStorage.setItem('pendingUserId', userDocRef.id);

    this.router.navigate(['/choose-avatar']);
  } catch (err) {
    console.error('❌ Fehler beim Erstellen des Users:', err);
  }
}

  goBack() {
    localStorage.setItem('skipIntro', 'true');
    this.router.navigate(['/']);
  }
}