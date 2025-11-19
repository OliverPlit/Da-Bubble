import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { AddChannel } from '../menu/add-channel/add-channel';
import { MatDialog } from '@angular/material/dialog';
import { Channels } from '../menu/channels/channels';
import { DirectMessages } from '../menu/direct-messages/direct-messages';
import { CommonModule } from '@angular/common';




@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MatButtonModule, MatSidenavModule, Channels,DirectMessages, CommonModule],
  templateUrl: './menu.html',
  styleUrl: './menu.scss',
})
export class Menu {
  showFiller = false;
  showChannels = false;
  showMessages = false;
  isMenuOpen = false;
  showNewMessages = false;
    @Output() openNewMessage = new EventEmitter<void>();

constructor(private dialog: MatDialog) {}

  openDialog() {
    this.dialog.open(AddChannel, {
      panelClass: 'add-channel-dialog-panel'
    });
  }

  onOpenNewMessage() {
    this.openNewMessage.emit(); // sagt Parent: toggle
 }
toggleChannels() {
  this.showChannels = !this.showChannels;
  if (this.showChannels) {
    this.showMessages = false; 
  }
}

toggleMessages() {
  this.showMessages = !this.showMessages;
  if (this.showMessages) {
    this.showChannels = false;
  }
}

  onDrawerChange(open: boolean) {
    this.isMenuOpen = open;
  }
  
}


