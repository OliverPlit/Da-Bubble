import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Main } from "./main/main";
import { LandingPage } from "./landing-page/landing-page";
import { FirebaseApp } from '@angular/fire/app';
import { getFirestore } from '@angular/fire/firestore';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Main, LandingPage],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Da-Bubble');
    constructor(private app: FirebaseApp) {}

  ngOnInit() {
    try {
      const db = getFirestore(this.app);
      console.log('✅ Firebase erfolgreich verbunden!');
      console.log('Projekt-ID:', this.app.options.projectId);
    } catch (error) {
      console.error('❌ Fehler beim Verbinden mit Firebase:', error);
    }
  }
}
