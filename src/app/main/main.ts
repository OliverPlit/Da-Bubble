import { Component } from '@angular/core';
import { Header } from "./header/header";
import { Menu } from "./menu/menu";
import { ChannelMessages } from './channel-messages/channel-messages';
import { Threads } from "./threads/threads";

@Component({
  selector: 'app-main',
  imports: [Header, Menu, ChannelMessages, Threads],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {
  showNewMessages = false;

  toggleNewMessage() {
    this.showNewMessages = !this.showNewMessages;
  }

  closeNewMessage() {
    this.showNewMessages = false;
  }
}
