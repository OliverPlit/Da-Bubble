import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AddEmojis } from '../add-emojis/add-emojis';
import { AtMembers } from '../at-members/at-members';

type Reply = {
  id: string;
  author: string;
  time: string;
  text: string;
  avatar?: string;
  reactions?: { emoji: string; count: number }[];
  isYou?: boolean;
};

@Component({
  selector: 'app-messades-threads',
  imports: [CommonModule, FormsModule,],
  templateUrl: './messades-threads.html',
  styleUrls: ['./messades-threads.scss'],
})
export class MessadesThreads {
  channel = 'Entwicklerteam';

  root = {
    author: 'Noah Braun',
    time: '14:25 Uhr',
    avatar: 'icons/avatars/avatar3.png',
    text: 'Welche Version ist aktuell von Angular?',
    isYou: false,
  };

  replies: Reply[] = [
    {
      id: 'r1',
      author: 'Sofia Müller',
      time: '14:30 Uhr',
      text:
        'Ich habe die gleiche Frage. Ich habe gegoogelt und es scheint, dass die aktuelle Version Angular 13 ist. ' +
        'Vielleicht weiß Frederik, ob es wahr ist.',
      reactions: [{ emoji: 'icons/emojis/emoji_rocket.png', count: 1 }, { emoji: 'icons/emojis/emoji_nerd face.png', count: 1 }],
    },
    {
      id: 'r2',
      author: 'Frederik Beck',
      time: '15:06 Uhr',
      text: 'Ja das ist es.',
      isYou: true,
      reactions: [{ emoji: 'icons/emojis/emoji_person raising both hands in celebration.png', count: 1 }],
    },
  ];

  draft = '';






  private dialog = inject(MatDialog)

  openAddEmojis() {
    this.dialog.open(AddEmojis, {
      panelClass: 'add-emojis-dialog-panel'
    });
  }

  openAtMembers(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    const gap = 24;
    const dlgW = 350;
    const dlgH = 467;

    this.dialog.open(AtMembers, {
      width: dlgW + 'px',
      panelClass: 'at-members-dialog-panel',
      position: {
        bottom: `${-160 + dlgH + gap}px`,
        right: `${-240 + dlgW}px`
      }
    });
  }

  sendMessage() {
    if (!this.draft.trim()) return;
    this.replies.push({
      id: crypto.randomUUID(),
      author: 'Oliver Plit',
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr',
      text: this.draft.trim(),
      isYou: true,
      reactions: [],
    });
    this.draft = '';
  }

}
