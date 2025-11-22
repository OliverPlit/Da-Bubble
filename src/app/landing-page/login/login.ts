import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';

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
  submitted = false;
  emailError = false;
  loginError = false;

  constructor(private router: Router, private auth: Auth) {}

  async login() {
    this.submitted = true;

    this.emailError = !this.email || !this.email.includes('@');
    this.loginError = false;

    if (this.emailError || !this.password) {
      this.loginError = true;
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
        case 'auth/invalid-credential':
          this.emailError = true;
          break;

        case 'auth/wrong-password':
          this.loginError = true;
          break;

        default:
          this.loginError = true;
          this.emailError = true;
      }
    }
  }

  guestLogin() {
  const guestUser = {
    uid: 'guest',       
    name: 'Guest',
    avatar: 'avatar1.png'
  };

  localStorage.setItem('currentUser', JSON.stringify(guestUser));
   this.router.navigate(['/main']);
}
}
