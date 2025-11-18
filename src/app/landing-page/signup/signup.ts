import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule , RouterModule],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  constructor(private router: Router) {}

  text = '';
  email = '';
  password = '';
  acceptedPrivacy = false;

  submitted = false;
  nameError = false;
  emailError = false;
  passwordError = false;
  privacyError = false;

  /** Email RegEx */
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  signUp() {
    this.submitted = true;
    this.nameError = this.text.trim() === '';
    this.emailError = !this.isValidEmail(this.email);
    this.passwordError = this.password.trim() === '';
    this.privacyError = !this.acceptedPrivacy;

    if (this.nameError || this.emailError || this.passwordError || this.privacyError) {
      return;
    }


    this.router.navigate(['/main']);
  }

  goBack() {
    localStorage.setItem('skipIntro', 'true');
    this.router.navigate(['/']);
  }
}