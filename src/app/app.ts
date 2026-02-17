import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { getFirestore } from '@angular/fire/firestore';
import { PresenceService } from './services/presence.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Da-Bubble');
    constructor(private app: FirebaseApp, private presence: PresenceService) {}

  ngOnInit() {
    try {
      const db = getFirestore(this.app);
    } catch (error) {
      console.error('❌ Fehler beim Verbinden mit Firebase:', error);
    }
  }
}