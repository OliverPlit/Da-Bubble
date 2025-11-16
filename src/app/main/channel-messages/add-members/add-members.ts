import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

type User = {
  uid: string;
  name: string;
  avatar: string;
  isOnline?: boolean;
}

@Component({
  selector: 'app-add-members',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-members.html',
  styleUrl: './add-members.scss',
})
export class AddMembers {
  private dialogRef = inject(MatDialogRef<AddMembers>);

  allUsers: User[] = [
    { uid: 'u_elise', name: 'Elise Roth', avatar: 'icons/avatars/avatar1.png', isOnline: true },
    { uid: 'u_elias', name: 'Elias Neumann', avatar: 'icons/avatars/avatar2.png', isOnline: true },
    { uid: 'u_noah', name: 'Noah Braun', avatar: 'icons/avatars/avatar3.png', isOnline: false },
    { uid: 'u_sofia', name: 'Sofia Müller', avatar: 'icons/avatars/avatar4.png', isOnline: true },
  ];

  channelName = 'Entwicklerteam';

  query = signal('');
  hasFocus = signal(false);
  activeIndex = signal<number>(-1);
  selected = signal<User[]>([]);

  suggestions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(this.selected().map(u => u.uid));
    return this.allUsers
      .filter(u => !chosen.has(u.uid) && u.name.toLowerCase().includes(q))
      .slice(0, 6);
  });

  showDropdown = computed(() =>
    this.hasFocus() && this.query().trim().length > 0 && this.suggestions().length > 0
  );

  onKeyDown(e: KeyboardEvent) {
    const list = this.suggestions();
    if (!list.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (this.activeIndex() + 1) % list.length;
      this.activeIndex.set(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (this.activeIndex() - 1 + list.length) % list.length;
      this.activeIndex.set(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = this.activeIndex();
      if (idx >= 0 && idx < list.length) this.selectUser(list[idx]);
    } else if (e.key === 'Escape') {
      this.hasFocus.set(false);
      this.activeIndex.set(-1);
    }
  }

  selectUser(u: User) {
    if (this.selected().find(x => x.uid === u.uid)) return;
    this.selected.update(arr => [...arr, u]);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  removeSelected(uid: string) {
    this.selected.update(arr => arr.filter(u => u.uid !== uid));
  }

  addMembers() {
    this.dialogRef.close({ added: this.selected() });
  }

  close() {
    this.dialogRef.close();
  }
}
