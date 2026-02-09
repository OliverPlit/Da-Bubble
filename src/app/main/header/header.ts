import { Component, inject, HostListener } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { Profile } from './profile/profile';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuTrigger } from '@angular/material/menu';
import { Firestore, collection, query, where, getDocs, orderBy, limit, doc, getDoc, collectionGroup } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';
import { FirebaseService, HeaderView } from '../../services/firebase';
import { ChannelStateService } from '../menu/channels/channel.service';
import { DirectChatService } from '../../services/direct-chat-service';
import { ThreadStateService } from '../../services/thread-state.service';
import { LayoutService } from '../../services/layout.service';
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
  messageData?: {
    messageId: string;
    channelId?: string;
    channelName?: string;
    dmId?: string;
    dmName?: string;
    text: string;
    author: { uid: string; username: string; avatar: string };
    createdAt: any;
  };
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
  private channelState = inject(ChannelStateService);
  private directChatService = inject(DirectChatService);
  private threadStateSvc = inject(ThreadStateService);
  private layout = inject(LayoutService);
  
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
  private currentUid = '';

  constructor(private firebase: FirebaseService) {
    this.checkWidth();
  }

  get currentLogo(): string {
    if (this.isMobile && this.currentView !== 'default') {
      return '/img/logo-menu-devspace.png';
    }
    return '/img/logo-menu.png';
  }

  get showMobileHeader(): boolean {
    return this.isMobile && this.currentView !== 'default';
  }

  async ngOnInit() {
    await this.loadUser();
    this.updateName();
    this.updateAvatar();

    this.viewSubscription = this.firebase.currentView$.subscribe(view => {
      this.currentView = view;
      this.cd.detectChanges();
    });

    this.firebase.currentName$.subscribe((name) => {
      if (name) {
        this.userName = name;
        this.cd.detectChanges();
      }
    });

     this.firebase.currentAvatar$.subscribe((avatar) => {
      if (avatar) {
        this.userAvatar = avatar;
        this.cd.detectChanges();
      }
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

    this.currentUid = uid;

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

  updateAvatar() {
    this.firebase.currentAvatar$.subscribe((avatar) => {
      if (avatar) {
        this.userAvatar = avatar;
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
      this.isVisible = !this.isMobile;
    }
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

    // Nur nach 3+ Zeichen suchen
    if (query.length < 3) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    this.isSearching = true;
    this.showSearchResults = true;

    try {
      let results: SearchResult[] = [];

      if (query.startsWith('@')) {
        const searchTerm = query.substring(1).toLowerCase();
        results = await this.searchDirectMessages(searchTerm);
      } else if (query.startsWith('#')) {
        const searchTerm = query.substring(1).toLowerCase();
        results = await this.searchChannels(searchTerm);
      } else {
        // Normale Textsuche: Durchsuche Nachrichten
        results = await this.searchMessages(query.toLowerCase());
      }

      this.searchResults = results;
    } catch (error) {
      console.error('Fehler bei der Suche:', error);
      this.searchResults = [];
    } finally {
      this.isSearching = false;
      this.cd.detectChanges();
    }
  }

  async searchMessages(searchTerm: string): Promise<SearchResult[]> {
    if (!this.currentUid) return [];

    const results: SearchResult[] = [];

    try {
      // Suche in Channel-Nachrichten
      const channelResults = await this.searchChannelMessages(searchTerm);
      results.push(...channelResults);

      // Suche in Direct Messages
      const dmResults = await this.searchDirectMessageMessages(searchTerm);
      results.push(...dmResults);

      // Sortiere nach Datum (neueste zuerst)
      results.sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.getTime() : 0;
        const timeB = b.timestamp ? b.timestamp.getTime() : 0;
        return timeB - timeA;
      });

    } catch (error) {
      console.error('Fehler beim Durchsuchen der Nachrichten:', error);
    }

    return results.slice(0, 10); // Max 10 Ergebnisse
  }

  async searchChannelMessages(searchTerm: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Hole alle Channels des Users
      const userRef = doc(this.firestore, 'users', this.currentUid);
      const channelsRef = collection(userRef, 'memberships');
      const channelsSnapshot = await getDocs(channelsRef);

      // Durchsuche jedes Channel
      for (const channelDoc of channelsSnapshot.docs) {
        const channelId = channelDoc.id;
        const channelData = channelDoc.data();
        const channelName = channelData['name'] || 'Unbekannt';

        // Hole Nachrichten aus diesem Channel
        const messagesRef = collection(this.firestore, `users/${this.currentUid}/messages/channels/${channelId}`);
        const messagesSnapshot = await getDocs(messagesRef);

        messagesSnapshot.forEach((msgDoc) => {
          const msgData = msgDoc.data();
          const text = (msgData['text'] || '').toLowerCase();

          if (text.includes(searchTerm)) {
            results.push({
              type: 'message',
              id: msgDoc.id,
              title: `# ${channelName}`,
              subtitle: msgData['author']?.username || 'Unbekannt',
              content: this.truncateText(msgData['text'], 80),
              timestamp: this.toDate(msgData['createdAt']),
              avatar: msgData['author']?.avatar || '',
              messageData: {
                messageId: msgDoc.id,
                channelId: channelId,
                channelName: channelName,
                text: msgData['text'],
                author: msgData['author'] || { uid: '', username: 'Unbekannt', avatar: '' },
                createdAt: msgData['createdAt']
              }
            });
          }
        });
      }
    } catch (error) {
      console.error('Fehler beim Durchsuchen der Channel-Nachrichten:', error);
    }

    return results;
  }

  async searchDirectMessageMessages(searchTerm: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Hole alle Direct Message Konversationen
      const dmMessagesRef = collection(this.firestore, `users/${this.currentUid}/messages/directMessages`);
      const dmFolders = await getDocs(dmMessagesRef);

      for (const dmFolder of dmFolders.docs) {
        const dmId = dmFolder.id;
        
        // Hole den Namen des Chat-Partners
        const otherUid = this.getOtherUidFromDmId(dmId, this.currentUid);
        const otherUserData = await this.getUserData(otherUid);
        const otherUserName = otherUserData?.name || 'Unbekannt';

        // Hole Nachrichten aus dieser DM
        const messagesRef = collection(this.firestore, `users/${this.currentUid}/messages/directMessages/${dmId}`);
        const messagesSnapshot = await getDocs(messagesRef);

        messagesSnapshot.forEach((msgDoc) => {
          const msgData = msgDoc.data();
          const text = (msgData['text'] || '').toLowerCase();

          if (text.includes(searchTerm)) {
            results.push({
              type: 'message',
              id: msgDoc.id,
              title: `@ ${otherUserName}`,
              subtitle: msgData['author']?.username || 'Unbekannt',
              content: this.truncateText(msgData['text'], 80),
              timestamp: this.toDate(msgData['createdAt']),
              avatar: msgData['author']?.avatar || '',
              messageData: {
                messageId: msgDoc.id,
                dmId: dmId,
                dmName: otherUserName,
                text: msgData['text'],
                author: msgData['author'] || { uid: '', username: 'Unbekannt', avatar: '' },
                createdAt: msgData['createdAt']
              }
            });
          }
        });
      }
    } catch (error) {
      console.error('Fehler beim Durchsuchen der Direct Messages:', error);
    }

    return results;
  }

  private getOtherUidFromDmId(dmId: string, currentUid: string): string {
    const parts = dmId.split('__');
    return parts[0] === currentUid ? parts[1] : parts[0];
  }

  private async getUserData(uid: string): Promise<any> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const snap = await getDoc(userRef);
      return snap.exists() ? snap.data() : null;
    } catch {
      return null;
    }
  }

  async searchDirectMessages(searchTerm: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return results;

    const currentUid = JSON.parse(storedUser).uid;

    try {
      const usersRef = collection(this.firestore, 'users');
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

  private toDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
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
        if (result.messageData) {
          this.openMessage(result.messageData);
        }
        break;
    }
  }

  private openMessage(messageData: any) {
    if (messageData.channelId) {
      // Channel-Nachricht: Öffne Channel und scrolle zur Nachricht
      const channelData = {
        id: messageData.channelId,
        name: messageData.channelName
      };
      this.channelState.selectChannel(channelData);
      this.router.navigate(['/main/channels']);

      // Optional: Öffne Thread-Ansicht für diese Nachricht
      setTimeout(() => {
        this.layout.openRight();
        this.threadStateSvc.open({
          uid: this.currentUid,
          channelId: messageData.channelId,
          channelName: messageData.channelName,
          messageId: messageData.messageId,
          root: {
            author: messageData.author,
            createdAt: messageData.createdAt,
            text: messageData.text,
            reactions: [],
            isYou: messageData.author.uid === this.currentUid
          }
        });
      }, 300);

    } else if (messageData.dmId) {
      // Direct Message: Öffne DM-Chat
      const otherUid = this.getOtherUidFromDmId(messageData.dmId, this.currentUid);
      this.getUserData(otherUid).then(userData => {
        if (userData) {
          const dmData = {
            id: otherUid,
            name: userData.name,
            avatar: userData.avatar,
            email: userData.email || '',
          };
          this.router.navigate(['/main/direct-message', dmData.name]);
        }
      });
    }
  }

  closeSearch() {
    this.showSearchResults = false;
  }

  ngOnDestroy() {
    this.viewSubscription?.unsubscribe();
  }
}