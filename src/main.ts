import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

const firebaseConfig = {
  apiKey: "AIzaSyD--n2EoFIXLZrQLvMSYh1mlBy8OYOWvL8",
  authDomain: "dabubble-3de0e.firebaseapp.com",
  databaseURL: "https://dabubble-3de0e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dabubble-3de0e",
  storageBucket: "dabubble-3de0e.firebasestorage.app",
  messagingSenderId: "532410346605",
  appId: "1:532410346605:web:818520f8673c82b24a2364",
  measurementId: "G-XY54RZ6RBD"
};

bootstrapApplication(App, {
  providers: [
    provideFirebaseApp(() => initializeApp(firebaseConfig)),

    provideFirestore(() => getFirestore()),

    provideRouter(routes)
  ]
}).catch(err => console.error(err));
