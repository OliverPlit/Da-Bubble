import { Component, inject, Inject, EventEmitter, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { directMessageContact } from '../../main/menu/direct-messages/direct-messages.model';
import { DirectChatService } from '../../services/direct-chat-service';


@Component({
  selector: 'app-profile-card',
  templateUrl: './profile-card.html',
  styleUrl: './profile-card.scss',
})
export class ProfileCard {
  @Output() ChatDirectMessage = new EventEmitter<directMessageContact>();

  dialogRef = inject(MatDialogRef<ProfileCard>);
  private dialog = inject(MatDialog);
  private directChatService = inject(DirectChatService);

  constructor(@Inject(MAT_DIALOG_DATA) public data: directMessageContact) {}

  close() {
    this.dialogRef.close();
  }

  closeAllDialogs() {
    this.dialog.closeAll();
  }

  openChatDirectMessage(dm: directMessageContact) {
    console.log('Starte Chat mit:', dm);
    this.directChatService.openChat(dm);

    this.closeAllDialogs();
  }
}
