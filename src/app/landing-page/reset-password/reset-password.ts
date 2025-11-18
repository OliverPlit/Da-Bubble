import { Component } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  constructor(private router: Router) {}
email = '';
submitted = false

resetPassword() {

}
 goBack() {
    localStorage.setItem('skipIntro', 'true');
    this.router.navigate(['/'])
}
}
