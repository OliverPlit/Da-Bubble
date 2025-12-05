import { Component, inject, EventEmitter, Output, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { AddEmojis } from '../../channel-messages/add-emojis/add-emojis';
import { AtMembers } from '../../channel-messages/at-members/at-members';
import { CommonModule } from '@angular/common';
import { directMessageContact } from '../direct-messages/direct-messages.model';
import { ProfileCard } from '../../../shared/profile-card/profile-card';
import { DirectChatService } from '../../../services/direct-chat-service';


@Component({
  selector: 'app-chat-direct-message',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-direct-message.html',
  styleUrl: './chat-direct-message.scss',
})
export class ChatDirectMessage {
  @Input() chatUser: directMessageContact | null = null;
  @Output() close = new EventEmitter<void>();
  private dialog = inject(MatDialog)
constructor(private directChatService: DirectChatService) {}

ngOnInit() {
  this.directChatService.chatUser$.subscribe(user => {
    if (user) {
      this.chatUser = user;
    }
  });
}

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

openProfile(member: directMessageContact) {
  this.dialog.open(ProfileCard, {
    data: member,
    panelClass: 'profile-dialog-panel'
  });
 
}
}
