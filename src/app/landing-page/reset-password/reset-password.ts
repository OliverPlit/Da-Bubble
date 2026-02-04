import { Component } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

@Component({
  selector: 'app-reset-password',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  constructor(private router: Router, private auth: Auth) {}
email = '';
submitted = false;

async resetPassword() {

  if (!this.emailValid(this.email)) {
      this.submitted = true;
    return;
  }

  try {
    await sendPasswordResetEmail(this.auth, this.email.trim());
    this.submitted = false;
    alert('Passwort-Reset E-Mail wurde gesendet!');
    this.router.navigate(['/']);

  } catch (error) {
  }
}

emailValid(email: string) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}
 goBack() {
    localStorage.setItem('skipIntro', 'true');
    this.router.navigate(['/'])
}
}
