import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {

  constructor(private router: Router, private firestore: Firestore, private auth: Auth) { }

  text = '';
  email = '';
  password = '';
  acceptedPrivacy = false;

  submitted = false;
  nameError = false;
  emailError = false;
  passwordError = false;
  privacyError = false;

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async signUp() {
    this.submitted = true;

    this.nameError = this.text.trim() === '';
    this.emailError = !this.isValidEmail(this.email);
    this.passwordError = this.password.trim() === '' || this.password.length < 6;
    this.privacyError = !this.acceptedPrivacy;

    if (this.nameError || this.emailError || this.passwordError || this.privacyError) {
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        this.email,
        this.password
      );

      const uid = userCredential.user.uid;
      await setDoc(doc(this.firestore, 'users', uid), {
        name: this.text,
        email: this.email,
        avatar: 'avatar1.png',
        isYou: true
      });

      await setDoc(doc(this.firestore, 'directMessages', uid), {
        createdAt: new Date(),
        name: this.text,
        avatar: 1,
      });

      localStorage.setItem('currentUser', uid);

      this.router.navigate(['/choose-avatar']);

    } catch (err: any) {
      console.error('Fehler beim Auth-Signup:', err);

      if (err.code === 'auth/email-already-in-use') {
        this.emailError = true;
      }
    }
  }

  goBack() {
    localStorage.setItem('skipIntro', 'true');
    this.router.navigate(['/']);
  }
}