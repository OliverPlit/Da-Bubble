import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { directMessageContact } from './direct-messages.model';
import { FirebaseService } from '../../../services/firebase';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Firestore, getDoc, doc } from '@angular/fire/firestore';
import { DirectChatService } from '../../../services/direct-chat-service';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { PresenceService } from '../../../services/presence.service';
import { LayoutService } from '../../../services/layout.service';

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
  private layout = inject(LayoutService);

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
    const userDataPromise = this.initUserId();
    
    // Fetch from 'users' collection to get correct avatars
    this.directMessage$ = this.firebaseService.getCollection$('users').pipe(
      startWith([]), 
      map(users => {
        if (!this.currentUserId) return users;
        return users.filter(user => user.id !== this.currentUserId);
      }),
      shareReplay(1) 
    );
    
    await userDataPromise;
    
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

    // Set initial values from localStorage (important for guest user)
    this.userName = userData.name || 'Guest';
    this.userAvatar = userData.avatar || 'avatar1.png';

    try {
      // Fetch from 'users' collection (same as header/profile)
      const userRef = doc(this.firestore, 'users', this.currentUserId);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const data: any = snap.data();
        this.userName = data.name;
        this.userAvatar = data.avatar || 'avatar1.png';
        this.firebaseService.setName(this.userName);
      }
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Fehler beim Laden der User-Daten:', error);
      this.cdr.detectChanges();
    }
  }

  openChatDirectMessage(dm: directMessageContact) {
    this.selectedDmId = dm.id;
    this.isYouSelected = false;
    this.router.navigate(['/main/direct-message', dm.name]);
    
    // Auf Mobile: Zeige Content und verstecke Menu
    this.layout.showContent();
    
    // Chat im Hintergrund öffnen
    requestAnimationFrame(() => {
      this.directChatService.openChat(dm);
    });
  }

  openChatYou() { 
    this.selectedDmId = '';
    this.isYouSelected = true;
    this.router.navigate(['/main/direct-you']);
    
    // Auf Mobile: Zeige Content und verstecke Menu
    this.layout.showContent();
  }
}