import { Component, HostListener, ChangeDetectorRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { Channels } from '../menu/channels/channels';
import { DirectMessages } from '../menu/direct-messages/direct-messages';
import { CommonModule } from '@angular/common';
import { AddChannel } from '../menu/add-channel/add-channel';
import { Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs, orderBy, limit, doc, getDoc } from '@angular/fire/firestore';
import { FirebaseService } from '../../services/firebase';
import { ChannelStateService } from '../menu/channels/channel.service';
import { DirectChatService } from '../../services/direct-chat-service';
import { FormsModule } from '@angular/forms';


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
  selector: 'app-menu',
  standalone: true,
  imports: [MatButtonModule, MatSidenavModule, Channels, DirectMessages, CommonModule, FormsModule],
  templateUrl: './menu.html',
  styleUrls: ['./menu.scss', './menu.responsive.scss'],
})
export class Menu {
  showChannels = true;
  showMessages = false;
  isMenuOpen = false;
  isMobile = false;
  searchQuery = '';
  searchResults: SearchResult[] = [];
  showSearchResults = false;
  isSearching = false;

private channelState = inject(ChannelStateService);
  private directChatService = inject(DirectChatService); 
    private firestore = inject(Firestore);



  constructor(
    private dialog: MatDialog, 
    private cd: ChangeDetectorRef,
        public router: Router

  ) {}

  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 750;
    if (!this.isMobile) {
    this.isMenuOpen = true;
    }
  }

  ngOnInit() {
    this.checkWidth();
  }

  onOpenNewMessage() {
    console.log('Neue Nachricht')
    this.router.navigate(['/main/new-message']);   

  }

  openDialog() {
    this.dialog.open(AddChannel, {
      panelClass: 'add-channel-dialog-panel'
    });
  }

  toggleChannels() {
    this.showChannels = !this.showChannels;
  }

  toggleMessages() {
    this.showMessages = !this.showMessages;
  }

  onDrawerChange(event: any) {
    this.isMenuOpen = !this.isMenuOpen;
    this.cd.detectChanges();
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