import { Component, inject, EventEmitter, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { AddEmojis } from '../../channel-messages/add-emojis/add-emojis';
import { AtMembers } from '../../channel-messages/at-members/at-members';

@Component({
  selector: 'app-chat-direct-message',
  imports: [],
  templateUrl: './chat-direct-message.html',
  styleUrl: './chat-direct-message.scss',
})
export class ChatDirectMessage {
@Output() close = new EventEmitter<void>();
    private dialog = inject(MatDialog)


  closeMessage() {
    this.close.emit(); 
  }


  openAddEmojis() {
      this.dialog.open(AddEmojis, {
        panelClass: 'add-emojis-dialog-panel'
      });
    }
  
    openAtMembers() {
      this.dialog.open(AtMembers, {
        panelClass: 'at-members-dialog-panel'
      });
    }

    sendMessage() {
  
  }
}
