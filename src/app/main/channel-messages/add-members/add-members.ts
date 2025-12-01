import { Component, inject, signal, computed, effect, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { setDoc, Firestore, doc, updateDoc, arrayUnion, collection, collectionData } from '@angular/fire/firestore';
import { map } from 'rxjs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';




type Member = {
  uid: string;      
  name: string;
  avatar?: string;
  status?: string;  
  isYou?: boolean;
};

@Component({
  selector: 'app-add-members',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-members.html',
  styleUrl: './add-members.scss',
})
export class AddMembers {
  private dialogRef = inject(MatDialogRef<AddMembers>);
    data = inject(MAT_DIALOG_DATA);
  @Input() fullChannel: any = null;
  @Input() channel = '';
  @Input() channelId = '';
  @Input() members: Member[] = [];
  firestore = inject(Firestore);
allMembers: Member[] = [];
channelName = this.data.channelName;
ngOnInit() {
  const dmRef = collection(this.firestore, 'directMessages');

  collectionData(dmRef, { idField: 'uid' })
    .pipe(
      map(users =>
        users.map(u => ({
          uid: u['uid'] ?? crypto.randomUUID(),
          name: u['name'],
          avatar: u['avatar'],
          status: u['status'] ?? 'offline'
        }))
      )
    )
    .subscribe(list => {
      this.allMembers = list;
      this.members = list;
    });
}


  query = signal('');
  hasFocus = signal(false);
  activeIndex = signal<number>(-1);
  selected = signal<Member[]>([]);

  suggestions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(this.selected().map(u => u.uid));
    return this.members
      .filter(m => !chosen.has(m.uid) && m.name.toLowerCase().includes(q))
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

  selectUser(u: Member) {
    if (this.selected().find(x => x.uid === u.uid)) return;
    this.selected.update(arr => [...arr, u]);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  removeSelected(uid: string) {
    this.selected.update(arr => arr.filter(u => u.uid !== uid));
  }

 async addMembers() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const uid = JSON.parse(storedUser).uid;

    const channelId = this.data.channelId
    const membershipRef = doc(
      this.firestore,
      `users/${uid}/memberships/${channelId}`
    );

   for (const user of this.selected()) {
    await updateDoc(membershipRef, {
      members: arrayUnion({
        uid: user.uid,
        name: user.name,
        avatar: user.avatar ?? '',
        status: 'online'
      })
    });
  }
    this.dialogRef.close({ added: this.selected() });
  }

  close() {
    this.dialogRef.close();
  }
}
