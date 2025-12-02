import { Component, inject, HostListener } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { Profile } from './profile/profile';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuTrigger } from '@angular/material/menu';
import { Firestore, collection, query, where, getDocs, orderBy, limit, doc,getDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { FirebaseService } from '../../services/firebase';

interface SearchResult {
  type: 'channel' | 'direct' | 'message';
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  timestamp?: Date;
  content?: string;
}



@Component({
  selector: 'app-header',
  imports: [MatMenuModule, CommonModule,FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss', './header.responsive.scss'],
})
export class Header {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private cd = inject(ChangeDetectorRef);
  isMobile = false;
  mobileMenuOpen = false;
  userName = '';
  userAvatar = '';
   searchQuery = '';
  searchResults: SearchResult[] = [];
  showSearchResults = false;
  isSearching = false;


constructor(private firebase: FirebaseService) {}


  openDialog() {
    const ref = this.dialog.open(Profile, {
      panelClass: 'profile-dialog-panel',
      ...(this.isMobile ? {} : { position: { top: '120px', right: '20px' } }),
    });

    ref.afterClosed().subscribe((updatedName?: string) => {
      if (updatedName) {
        this.userName = updatedName;
        this.cd.detectChanges();
      }
    });
  }


  

  logout() {
    this.router.navigate(['']);
  }

  async ngOnInit() {
    this.checkWidth();
    await this.loadUser();
        this.updateName();

  }

  async loadUser() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;

    const userRef = doc(this.firestore, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data.name;
      this.userAvatar = data.avatar;

      this.cd.detectChanges();
            this.firebase.setName(this.userName);

    }
  }

   updateName() {
   this.firebase.currentName$.subscribe((name) => {
      if (name) {
        this.userName = name;
        this.cd.detectChanges();
      }
    });
  
    }

  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 400;
    if (!this.isMobile) {
      this.mobileMenuOpen = false;
    }
  }

  openMenu() {
    if (this.isMobile) {
      this.mobileMenuOpen = true;
    } else {
    }
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
   async onSearchInput() {
    const query = this.searchQuery.trim();

    // Leere Suche - Ergebnisse zurücksetzen
    if (!query) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    this.isSearching = true;
    this.showSearchResults = true;

    try {
      if (query.startsWith('@')) {
        const searchTerm = query.substring(1).toLowerCase();
        this.searchResults = await this.searchDirectMessages(searchTerm);
      }
      else if (query.startsWith('#')) {
        const searchTerm = query.substring(1).toLowerCase();
        this.searchResults = await this.searchChannels(searchTerm);
      }
      // Ohne Präfix = Alle Messages durchsuchen
      else {
        //this.searchResults = await this.searchAllMessages(query.toLowerCase());
      }
    } catch (error) {
      console.error('Fehler bei der Suche:', error);
      this.searchResults = [];
    } finally {
      this.isSearching = false;
      this.cd.detectChanges();
    }
  }

  async searchDirectMessages(searchTerm: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return results;

    const currentUid = JSON.parse(storedUser).uid;

    try {
      const usersRef = collection(this.firestore, 'directMessages');
      const usersSnapshot = await getDocs(usersRef);

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        const userName = userData['name']?.toLowerCase() || '';

        if (userName.includes(searchTerm) && doc.id !== currentUid) {
          results.push({
            type: 'direct',
            id: doc.id,
            title: userData['name'] || 'Unbekannt',
            avatar: userData['avatar'] || 'avatar-1.png',
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Durchsuchen der Direct Messages:', error);
    }

    return results.slice(0, 5); 
  }

  // Channels durchsuchen
  async searchChannels(searchTerm: string): Promise<SearchResult[]> {
        const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return []
    const uid = JSON.parse(storedUser).uid;
    const results: SearchResult[] = [];

    try {
          const userRef = doc(this.firestore, 'users', uid);

    const channelsRef = collection(userRef, 'memberships');
      const channelsSnapshot = await getDocs(channelsRef);

      channelsSnapshot.forEach((doc) => {
        const channelData = doc.data();
        const channelName = channelData['name']?.toLowerCase() || '';
        const channelDesc = channelData['description']?.toLowerCase() || '';

        if (channelName.includes(searchTerm) || channelDesc.includes(searchTerm)) {
          results.push({
            type: 'channel',
            id: doc.id,
            title: `# ${channelData['name']}`,
            subtitle: channelData['description'] || 'Keine Beschreibung',
            content: `${channelData['members']?.length || 0} Mitglieder`
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Durchsuchen der Channels:', error);
    }

    return results.slice(0, 10);
  }

  // Alle Messages durchsuchen (Channels + Direct Messages)
/*   async searchAllMessages(searchTerm: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // 1. Channel-Messages durchsuchen
      const channelsRef = collection(this.firestore, 'channels');
      const channelsSnapshot = await getDocs(channelsRef);

      for (const channelDoc of channelsSnapshot.docs) {
        const messagesRef = collection(this.firestore, 'channels', channelDoc.id, 'messages');
        const messagesSnapshot = await getDocs(query(messagesRef, orderBy('timestamp', 'desc'), limit(50)));

        messagesSnapshot.forEach((msgDoc) => {
          const msgData = msgDoc.data();
          const content = msgData['content']?.toLowerCase() || '';

          if (content.includes(searchTerm)) {
            results.push({
              type: 'message',
              id: msgDoc.id,
              title: `# ${channelDoc.data()['name']}`,
              subtitle: msgData['senderName'] || 'Unbekannt',
              content: this.truncateText(msgData['content'], 60),
              timestamp: msgData['timestamp']?.toDate()
            });
          }
        });
      }

      // 2. Direct Messages durchsuchen
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const currentUid = JSON.parse(storedUser).uid;
        const dmRef = collection(this.firestore, 'directMessages');
        const dmSnapshot = await getDocs(dmRef);

        for (const dmDoc of dmSnapshot.docs) {
          // Nur DMs wo der aktuelle User beteiligt ist
          const participants = dmDoc.id.split('_');
          if (!participants.includes(currentUid)) continue;

          const messagesRef = collection(this.firestore, 'directMessages', dmDoc.id, 'messages');
          const messagesSnapshot = await getDocs(query(messagesRef, orderBy('timestamp', 'desc'), limit(50)));

          messagesSnapshot.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            const content = msgData['content']?.toLowerCase() || '';

            if (content.includes(searchTerm)) {
              results.push({
                type: 'message',
                id: msgDoc.id,
                title: `@ ${msgData['senderName'] || 'Direct Message'}`,
                subtitle: 'Direct Message',
                content: this.truncateText(msgData['content'], 60),
                timestamp: msgData['timestamp']?.toDate()
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Durchsuchen aller Messages:', error);
    }

    // Nach Timestamp sortieren (neueste zuerst)
    return results
      .sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, 20); // Maximal 20 Ergebnisse
  } */

  // Hilfsfunktion: Text kürzen
  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Suchergebnis auswählen
  selectSearchResult(result: SearchResult) {
    this.showSearchResults = false;
    this.searchQuery = '';

    switch (result.type) {
      case 'channel':
        // Navigiere zu Channel
        this.router.navigate(['/main/channel', result.id]);
        break;

      case 'direct':
        // Navigiere zu Direct Message
        this.router.navigate(['/main/direct', result.id]);
        break;

      case 'message':
        // Optional: Navigiere zur spezifischen Message
        console.log('Navigiere zu Message:', result);
        break;
    }
  }

  // Suche schließen (z.B. bei Klick außerhalb)
  closeSearch() {
    this.showSearchResults = false;
  }
}

