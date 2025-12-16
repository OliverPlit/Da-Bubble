import { Component, inject, signal, computed, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Firestore, doc, getDoc, collection, collectionData, setDoc } from '@angular/fire/firestore';
import { map } from 'rxjs';
import { ChannelStateService } from '../../menu/channels/channel.service';
import { FirebaseService } from "../../../services/firebase";

type Member = {
  uid: string;
  name: string;
  avatar?: string;
  status?: string;
  isYou?: boolean;
  email?: string;
};

type DialogData = {
  channelName?: string;
  members?: Member[];
  currentUserId?: string;
  channelId?: string;
  fullChannel?: any;
  existingMembers?: Member[];
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
  private cd = inject(ChangeDetectorRef);
  firestore = inject(Firestore);
  private firebaseService = inject(FirebaseService);
  userName = '';

  fullChannel: any = null;
  @Input() channel = '';
  @Input() channelId = '';
  @Input() members: Member[] = [];

  allMembers: Member[] = [];
  channelName = this.data.channelName;
  existingMembers = signal<Member[]>([]);
  selected = signal<Member[]>([]);
  query = signal('');
  hasFocus = signal(false);
  activeIndex = signal<number>(-1);
  isSubmitting = signal(false);

  constructor(private cdr: ChangeDetectorRef, private channelState: ChannelStateService) {}

  async ngOnInit() {
    await this.initUserId();

    this.firebaseService.currentName$.subscribe((name) => {
      if (!name) return;
      this.userName = name;

      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) return;
      const currentUid = JSON.parse(storedUser).uid;

      this.existingMembers.update(members =>
        members.map(m => m.uid === currentUid ? { ...m, name: `${name} (Du)` } : m)
      );

      this.selected.update(members =>
        members.map(m => m.uid === currentUid ? { ...m, name: `${name} (Du)` } : m)
      );

      this.cd.detectChanges();
    });

    const data = this.data as DialogData;
    this.channelId = data.channelId || '';
    this.channelName = data.channelName || '';
    this.fullChannel = data.fullChannel;
    
    if (data.existingMembers) {
      this.existingMembers.set(data.existingMembers);
    } else if (data.members) {
      this.existingMembers.set(data.members);
    }

    const dmRef = collection(this.firestore, 'directMessages');
    collectionData(dmRef, { idField: 'uid' })
      .pipe(
        map(users => users.map(u => ({
          uid: u['uid'] ?? crypto.randomUUID(),
          name: u['name'] ?? 'Unbekannter Benutzer',
          avatar: u['avatar'] ?? 'default-avatar.png',
          status: u['status'] ?? 'offline'
        } as Member)))
      )
      .subscribe(list => {
        this.allMembers = list;
        this.members = list;
        this.cd.detectChanges();
      });
  }

  async initUserId() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const userData = JSON.parse(storedUser);
    const currentUserId = userData.uid;
    if (!currentUserId) return;

    const userRef = doc(this.firestore, 'directMessages', currentUserId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data: any = snap.data();
      this.userName = data.name;
      this.firebaseService.setName(this.userName);
      this.cd.detectChanges();
    }
  }

  suggestions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];

    const excluded = new Set([
      ...this.existingMembers().map(u => u.uid),
      ...this.selected().map(u => u.uid)
    ]);

    return this.members
      .filter(m => !excluded.has(m.uid) && m.name.toLowerCase().includes(q))
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
      this.activeIndex.set((this.activeIndex() + 1) % list.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex.set((this.activeIndex() - 1 + list.length) % list.length);
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
    // Doppelte Checks zur Sicherheit
    if (this.selected().find(x => x.uid === u.uid)) return;
    if (this.existingMembers().find(x => x.uid === u.uid)) return;

    this.selected.update(arr => [...arr, u]);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  removeSelected(uid: string) {
    this.selected.update(arr => arr.filter(u => u.uid !== uid));
  }

  async addMembers() {
    if (this.isSubmitting()) return;
    if (!this.selected().length) { this.close(); return; }
    this.isSubmitting.set(true);

    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const currentUid = JSON.parse(storedUser).uid;
    const channelId = this.channelId;

    try {
      // Alle UIDs sammeln (bestehende + neue)
      const newMemberUids = this.selected().map(u => u.uid);
      const existingMemberUids = this.existingMembers().map(u => u.uid);
      
      let allMemberUids = Array.from(new Set([
        ...existingMemberUids,
        ...newMemberUids
      ]));

      console.log('🔥 Updating members for all users:', allMemberUids);

      for (const userUid of allMemberUids) {
        await this.handleUserChannelMembership(userUid, channelId, allMemberUids);
      }

      const membershipRef = doc(this.firestore, `users/${currentUid}/memberships/${channelId}`);
      const snap = await getDoc(membershipRef);
      if (snap.exists()) {
        const freshChannelData = snap.data();
        this.channelState.selectChannel({ ...freshChannelData, id: channelId });
      }

      await new Promise(r => setTimeout(r, 200));
      this.dialogRef.close({ success: true, added: this.selected() });

    } catch (err) {
      console.error('Fehler beim Hinzufügen von Mitgliedern:', err);
      this.isSubmitting.set(false);
    }
  }

  async handleUserChannelMembership(userUid: string, channelId: string, allMemberUids: string[]) {
    try {
      const storedUser = localStorage.getItem('currentUser');
      const currentUid = storedUser ? JSON.parse(storedUser).uid : '';

      const channelData = await this.fetchChannelData(currentUid, channelId);
      const allMembers = await this.fetchMemberDetails(currentUid, allMemberUids);
      await this.setChannelMembership(userUid, channelId, channelData, allMembers);

    } catch (err) {
      console.error(`Fehler für User ${userUid}:`, err);
    }
  }

  async fetchChannelData(currentUid: string, channelId: string) {
    const ref = doc(this.firestore, `users/${currentUid}/memberships/${channelId}`);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  }

  async fetchMemberDetails(currentUid: string, allMemberUids: string[]) {
    const allMembers: Member[] = [];
    for (const uid of allMemberUids) {
      const dmRef = doc(this.firestore, `directMessages/${uid}`);
      const dmSnap = await getDoc(dmRef);
      if (dmSnap.exists()) {
        const userData = dmSnap.data();
        allMembers.push({
          uid,
          name: uid === currentUid ? `${userData['name']} (Du)` : userData['name'],
          avatar: userData['avatar'] || 'avatar-0.png',
          email: userData['email'] || '',
          status: 'online',
          isYou: uid === currentUid
        });
      }
    }
    return allMembers;
  }

  async setChannelMembership(userUid: string, channelId: string, channelData: any, allMembers: Member[]) {
    const ref = doc(this.firestore, `users/${userUid}/memberships/${channelId}`);
    
    await setDoc(ref, {
      channelId,
      name: channelData['name'] || 'Neuer Channel',
      description: channelData['description'] || '',
      joinedAt: channelData['joinedAt'] || new Date(),
      createdBy: channelData['createdBy'] || 'Unbekannt',
      members: allMembers
    }, { merge: false });
  }

  close() {
    this.dialogRef.close();
  }
}