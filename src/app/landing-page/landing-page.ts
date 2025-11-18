import { Component } from '@angular/core';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';


@Component({
  selector: 'app-landing-page',
  imports: [RouterModule, CommonModule],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})



export class LandingPage {
showIntro = true;
  showHeaderText = true;

  constructor(private router: Router) {
    router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
this.showHeaderText = 
  !event.url.includes('/signup') &&
  !event.url.includes('/reset-password');
      });
  }

ngOnInit() {
    const skip = localStorage.getItem('skipIntro');

  if (skip === 'true') {
    this.showIntro = false;
    localStorage.removeItem('skipIntro');
  }
  setTimeout(() => {
    this.showIntro = false;
  }, 3400);
}
}
