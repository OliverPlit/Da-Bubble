import { Component, EventEmitter, Output, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { AddChannel } from '../menu/add-channel/add-channel';
import { MatDialog } from '@angular/material/dialog';
import { Channels } from '../menu/channels/channels';
import { DirectMessages } from '../menu/direct-messages/direct-messages';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';




@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MatButtonModule, MatSidenavModule, Channels, DirectMessages, CommonModule],
  templateUrl: './menu.html',
  styleUrls: ['./menu.scss', './menu.responsive.scss'],
})
export class Menu {
  showFiller = false;
  showChannels = false;
  showMessages = false;
  isMenuOpen = false;
  showNewMessages = false;
  isMobile = false;
  isChannelMessagesVisible = true;
  userName: string = '';

  @Output() toggleChannelMessages = new EventEmitter<boolean>();

  @Output() openNewMessage = new EventEmitter<void>();

  constructor(private dialog: MatDialog, private cd: ChangeDetectorRef) {}
  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 550;
    if (this.isMobile) {
      this.toggleChannelMessages.emit(false);
      this.isMenuOpen = true;
    } else {
      this.toggleChannelMessages.emit(true);
    }
  }

  ngOnInit() {
    this.checkWidth();
  }
  

 
  openDialog() {
    this.dialog.open(AddChannel, {
      panelClass: 'add-channel-dialog-panel'
    });
  }

  onOpenNewMessage() {
    this.openNewMessage.emit();
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

   onDrawerChange(boolean: any) {
    this.isMenuOpen = !this.isMenuOpen;
    this.cd.detectChanges();
  }

}


