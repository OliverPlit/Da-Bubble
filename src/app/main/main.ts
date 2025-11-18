import { Component } from '@angular/core';
import { Header } from "./header/header";
import { Menu } from "./menu/menu";
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ChannelMessages } from './channel-messages/channel-messages';
import { Threads } from "./threads/threads";
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-main',
  imports: [Header, Menu, ChannelMessages, Threads, CommonModule, MatButtonModule,MatSidenavModule ],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {
showNewMessages = false;
  isMenuOpen = true;
  showThreads = false;

  
  toggleNewMessage() {
    this.showNewMessages = !this.showNewMessages;
  }

  closeNewMessage() {
    this.showNewMessages = false;
  }

 get channelMessagesStyle(): { [key: string]: string } {
  const style: { [key: string]: string } = {};

  const menuWidth = this.isMenuOpen ? 366 : 0;
  const threadsWidth = this.showThreads ? 485 : 0;

  style['width'] = `calc(100% - ${menuWidth + threadsWidth}px)`;

  return style;
}

}
