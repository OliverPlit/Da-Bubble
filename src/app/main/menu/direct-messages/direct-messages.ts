import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { directMessageContact } from './direct-messages.model';
import { FirebaseService } from '../../../services/firebase';
import { Observable, combineLatest } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Firestore, getDoc, doc } from '@angular/fire/firestore';
import { DirectChatService } from '../../../services/direct-chat-service';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { PresenceService } from '../../../services/presence.service';

@Component({
  selector: 'app-direct-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './direct-messages.html',
  styleUrl: './direct-messages.scss',
})
export class DirectMessages {
  directMessage: directMessageContact[] = [];
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private directChatService = inject(DirectChatService);
  public presence = inject(PresenceService);

  userName: string = '';
  userAvatar: string = '';
  currentUserId: string = '';

  selectedDmId: string = '';
  isYouSelected: boolean = false;
  
  directMessage$: Observable<directMessageContact[]> | undefined;

  constructor(
    private firebaseService: FirebaseService,
    public router: Router
  ) { }

  async ngOnInit() {
    // User-Daten parallel laden
    const userDataPromise = this.initUserId();
    
    // Direct Messages Observable vorbereiten (startet sofort)
    this.directMessage$ = this.firebaseService.getCollection$('directMessages').pipe(
      startWith([]), // Sofort mit leerem Array starten
      map(users => {
        // Filter erst anwenden wenn currentUserId verfügbar
        if (!this.currentUserId) return users;
        return users.filter(user => user.id !== this.currentUserId);
      }),
      shareReplay(1) // Ergebnis cachen
    );
    
    // Auf User-Daten warten
    await userDataPromise;
    
    // Name-Updates abonnieren
    this.firebaseService.currentName$.subscribe((name) => {
      if (name) {
        this.userName = name;
        this.cdr.detectChanges();
      }
    });
  }

  getStatus(uid: string): 'online' | 'offline' {
    const map = this.presence.userStatusMap();
    return map[uid] ?? 'offline';
  }

  async initUserId() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    
    const userData = JSON.parse(storedUser);
    this.currentUserId = userData.uid;
    
    if (!this.currentUserId) return;

    try {
      const userRef = doc(this.firestore, 'directMessages', this.currentUserId);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const data: any = snap.data();
        this.userName = data.name;
        this.userAvatar = data.avatar || 'avatar-0.png';
        this.firebaseService.setName(this.userName);
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Fehler beim Laden der User-Daten:', error);
    }
  }

  openChatDirectMessage(dm: directMessageContact) {
    this.selectedDmId = dm.id;
    this.isYouSelected = false;
    
    // Sofort navigieren
    this.router.navigate(['/main/direct-message', dm.name]);
    
    // Chat im Hintergrund öffnen
    requestAnimationFrame(() => {
      this.directChatService.openChat(dm);
    });
  }

  openChatYou() { 
    this.selectedDmId = '';
    this.isYouSelected = true;
    this.router.navigate(['/main/direct-you']);
  }
}