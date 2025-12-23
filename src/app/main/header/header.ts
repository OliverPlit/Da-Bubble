import { Component, inject, HostListener } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { Profile } from './profile/profile';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuTrigger } from '@angular/material/menu';
import { Firestore, collection, query, where, getDocs, orderBy, limit, doc, getDoc } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { FirebaseService, HeaderView  } from '../../services/firebase';
import { ChannelStateService } from '../menu/channels/channel.service';
import { DirectChatService } from '../../services/direct-chat-service';
import { Subscription } from 'rxjs';

interface SearchResult {
  type: 'channel' | 'direct' | 'message';
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  timestamp?: Date;
  content?: string;
  channelData?: any;
  dmData?: any; 
}

@Component({
  selector: 'app-header',
  imports: [MatMenuModule, CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss', './header.responsive.scss'],
})
export class Header {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private cd = inject(ChangeDetectorRef);
  private channelState = inject(ChannelStateService); // 🔥 NEU
  private directChatService = inject(DirectChatService); // 🔥 NEU
  
  isMobile = false;
  isVisible = true;
  mobileMenuOpen = false;
  userName = '';
  userAvatar = '';
  searchQuery = '';
  searchResults: SearchResult[] = [];
  showSearchResults = false;
  isSearching = false;
currentView: HeaderView = 'default';
  private viewSubscription?: Subscription;

  constructor(private firebase: FirebaseService) {    this.checkWidth();
}

  get currentLogo(): string {
    // Nur auf Mobile (< 600px) UND wenn New Message/Add Channel offen ist
    if (this.isMobile && this.currentView !== 'default') {
      return '/icons/logo-menu-devspace.png'; // Mobile Logo für spezielle Views
    }
    return '/icons/logo-menu.png'; // Standard Logo
  }

  // Getter für Mobile Header Sichtbarkeit
  get showMobileHeader(): boolean {
    return this.isMobile && this.currentView !== 'default';
  }

  async ngOnInit() {
    await this.loadUser();
    this.updateName();

    // 🔥 Abonniere View-Änderungen
    this.viewSubscription = this.firebase.currentView$.subscribe(view => {
      this.currentView = view;
      this.cd.detectChanges();
    });
  }



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
    this.isMobile = window.innerWidth <= 600;
    if (!this.isMobile) {
      this.mobileMenuOpen = false;
    }

     this.isMobile = window.innerWidth <= 750;
    if (!this.isMobile) {
this.isVisible = !this.isMobile;     }
  }

  openMenu() {
    if (this.isMobile) {
      this.mobileMenuOpen = true;
    }
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  async onSearchInput() {
    const query = this.searchQuery.trim();

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
            dmData: { 
              id: doc.id,
              name: userData['name'] || 'Unbekannt',
              avatar: userData['avatar'] || 'avatar-1.png',
              email: userData['email'] || '',
              status: userData['status'] || 'offline'
            }
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Durchsuchen der Direct Messages:', error);
    }

    return results.slice(0, 5);
  }

  async searchChannels(searchTerm: string): Promise<SearchResult[]> {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return [];
    
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
            content: `${channelData['members']?.length || 0} Mitglieder`,
            channelData: {
              id: doc.id,
              ...channelData
            }
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Durchsuchen der Channels:', error);
    }

    return results.slice(0, 10);
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  selectSearchResult(result: SearchResult) {
    this.showSearchResults = false;
    this.searchQuery = '';

    switch (result.type) {
      case 'channel':
        if (result.channelData) {
          this.channelState.selectChannel(result.channelData);
          this.router.navigate(['/main/channels']);
        }
        break;

      case 'direct':
        if (result.dmData) {
          this.directChatService.openChat(result.dmData);
          this.router.navigate(['/main/direct-message', result.dmData.name]);
        }
        break;

      case 'message':
        console.log('Navigiere zu Message:', result);
        break;
    }
  }

  closeSearch() {
    this.showSearchResults = false;
  }
}