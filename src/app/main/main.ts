import { Component } from '@angular/core';
import { Header } from './header/header';
import { Menu } from './menu/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ChannelMessages } from './channel-messages/channel-messages';
import { Threads } from './threads/threads';
import { CommonModule } from '@angular/common';
import { DirectMessages } from '../main/menu/direct-messages/direct-messages';
import { ChatDirectMessage } from '../main/menu/chat-direct-message/chat-direct-message';
import { directMessageContact } from '../main/menu/direct-messages/direct-messages.model';
import { ChatDirectYou } from '../main/menu/chat-direct-you/chat-direct-you';
import { DirectChatService } from '../services/direct-chat-service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-main',
  imports: [
    Header,
    RouterOutlet,
    ChatDirectMessage,
    Menu,
    ChannelMessages,
    DirectMessages,
    ChatDirectYou,
    Threads,
    CommonModule,
    MatButtonModule,
    MatSidenavModule,
  ],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {
  showNewMessages = false;
  showNewMessagesChat = false;
  showNewMessagesYou = false;
  isMenuOpen = true;
  showThreads = false;
  isChannelMessagesVisible = true;
  selectedChatUser: directMessageContact | null = null;
  activePanel: 'none' | 'chatYou' | 'chatDirect' | 'channel' = 'none';

  constructor(private directChatService: DirectChatService) {}
  showLeft = true;
  showRight = true;

  toggleLeft() {
    this.showLeft = !this.showLeft;
  }

  toggleRight() {
    this.showRight = !this.showRight;
  }

  openChatYou() {
    this.activePanel = 'chatYou';
  }

  openChatDirectMessage() {
    this.activePanel = 'chatDirect';
  }

  openChannel() {
    this.activePanel = 'channel';
  }

  closePanels() {
    this.activePanel = 'none';
  }

  setChannelMessagesVisible(value: boolean) {
    this.isChannelMessagesVisible = value;
  }

  toggleNewMessage() {
    this.showNewMessages = !this.showNewMessages;
  }

  toggleNewDirectChat(dm: directMessageContact) {
    console.log('3. Main: Event empfangen!', dm);
    this.selectedChatUser = dm;
    this.showNewMessagesChat = true;
    console.log('4. Main: Chat geöffnet für:', this.selectedChatUser);
  }

  toggleNewDirectChatYou() {
    console.log('3. Main: You empfangen!');
    this.showNewMessagesYou = true;
  }

  closeNewMessage() {
    this.showNewMessages = false;
  }

  closeDirectChatYou() {
    this.showNewMessagesYou = false;
  }

  get channelMessagesStyle(): { [key: string]: string } {
    const style: { [key: string]: string } = {};

    const menuWidth = this.isMenuOpen ? 366 : 0;
    const threadsWidth = this.showThreads ? 485 : 0;

    style['width'] = `calc(100% - ${menuWidth + threadsWidth}px)`;

    return style;
  }

  closeDirectChat() {
    this.showNewMessagesChat = false;
  }
}
