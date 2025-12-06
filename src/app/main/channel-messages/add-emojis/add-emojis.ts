import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { EmojiService, Emoji } from '../../../services/emoji.service';

@Component({
  selector: 'app-add-emojis',
  imports: [CommonModule],
  templateUrl: './add-emojis.html',
  styleUrl: './add-emojis.scss',
})
export class AddEmojis {
  private dialogRef = inject(MatDialogRef<AddEmojis, string | null>);
  private emojiSvc = inject(EmojiService)

  emojis = this.emojiSvc.all();
  
  choose(emoji: Emoji) {
    this.dialogRef.close(emoji.emojiId);
  }

  close() {
    this.dialogRef.close(null);
  }
}