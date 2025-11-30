import { Component, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  Auth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  email = '';
  password = '';
  submitted = signal(false);
  emailError = signal(false);
  loginError = signal(false);

  constructor(private router: Router, private auth: Auth, private firestore: Firestore) {}

  async login() {
    this.submitted.set(true);

    this.emailError.set(!this.email || !this.email.includes('@'));
    this.loginError.set(false);
    if (this.emailError() || !this.password) {
      this.loginError.set(true);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, this.email, this.password);

      localStorage.setItem('currentUser', JSON.stringify(userCredential.user));

      this.router.navigate(['/main']);
    } catch (err: any) {
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-email':
          this.emailError.set(true);
          break;

        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          this.loginError.set(true);
          this.emailError.set(false);
          break;

        default:
          this.loginError.set(true);
          this.emailError.set(true);
      }
    }
  }

async loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    const user = result.user;

    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userSnap = await getDoc(userRef);

    localStorage.setItem('currentUser', JSON.stringify(user));

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        avatar: 'avatar1.png',
      });

      this.router.navigate(['/choose-avatar']);
      return;
    }


    this.router.navigate(['/main']);

  } catch (error) {
    console.error('Google Login Error:', error);
    this.loginError.set(true);
  }
}

  guestLogin() {
    const guestUser = {
      uid: 'guest',
      name: 'Guest',
      avatar: 'avatar1.png',
    };

    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    this.router.navigate(['/main']);
  }
}
