import { Component, inject } from '@angular/core';
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
  private dialog = inject(MatDialog);

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

  onDrawerChange(open: boolean) {
    this.isMenuOpen = open;
  }
  
}


