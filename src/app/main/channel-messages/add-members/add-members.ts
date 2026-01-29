import { Component, inject, signal, computed, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Firestore, doc, getDoc, collection, getDocs, writeBatch, query } from '@angular/fire/firestore';
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
  firestore = inject(Firestore);
  private firebaseService = inject(FirebaseService);
  private cd = inject(ChangeDetectorRef);

  currentUserId = '';
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
  activeIndex = signal(-1);
  isSubmitting = signal(false);
  isLoading = signal(true);

  constructor(private channelState: ChannelStateService) {}

  async ngOnInit() {
    const [_, users] = await Promise.all([
      this.loadCurrentUser(),
      this.loadAllUsers()
    ]);
    this.initDialogData();
    this.allMembers = users;
    this.members = users;
    this.isLoading.set(false);
    this.cd.detectChanges();
    this.subscribeToNameChanges();
  }

  private initDialogData() {
    const d = this.data as DialogData;
    this.channelId = d.channelId || '';
    this.channelName = d.channelName || '';
    this.fullChannel = d.fullChannel;
    this.existingMembers.set(d.existingMembers || d.members || []);
  }

  private async loadCurrentUser() {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return;
    const u = JSON.parse(raw);
    this.currentUserId = u.uid || '';
    if (!this.currentUserId) return;
    const snap = await getDoc(doc(this.firestore, 'directMessages', this.currentUserId));
    if (!snap.exists()) return;
    this.userName = snap.data()['name'];
    this.firebaseService.setName(this.userName);
  }

  private async loadAllUsers(): Promise<Member[]> {
    const snap = await getDocs(query(collection(this.firestore, 'directMessages')));
    return snap.docs.map(d => ({
      uid: d.id,
      name: d.data()['name'] ?? 'Unbekannter Benutzer',
      avatar: d.data()['avatar'] ?? 'avatar-0.png',
      status: d.data()['status'] ?? 'offline',
      email: d.data()['email'] ?? ''
    }));
  }

  private subscribeToNameChanges() {
    this.firebaseService.currentName$.subscribe(n => {
      if (!n || !this.currentUserId) return;
      this.userName = n;
      this.updateNames(this.existingMembers);
      this.updateNames(this.selected);
      this.cd.detectChanges();
    });
  }

  private updateNames(sig: any) {
    sig.update((m: Member[]) =>
      m.map(x => x.uid === this.currentUserId
        ? { ...x, name: `${this.userName} (Du)` }
        : x)
    );
  }

  suggestions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const ex = new Set([...this.existingMembers(), ...this.selected()].map(u => u.uid));
    return this.members.filter(m => !ex.has(m.uid) && m.name.toLowerCase().includes(q)).slice(0, 6);
  });

  showDropdown = computed(() =>
    this.hasFocus() && this.query().trim() && this.suggestions().length > 0
  );

  onKeyDown(e: KeyboardEvent) {
    const l = this.suggestions();
    if (!l.length) return;
    if (e.key === 'ArrowDown') this.moveIndex(1, l.length, e);
    if (e.key === 'ArrowUp') this.moveIndex(-1, l.length, e);
    if (e.key === 'Enter') this.pickActive(l, e);
    if (e.key === 'Escape') this.resetFocus();
  }

  private moveIndex(d: number, len: number, e: Event) {
    e.preventDefault();
    this.activeIndex.set((this.activeIndex() + d + len) % len);
  }

  private pickActive(list: Member[], e: Event) {
    e.preventDefault();
    const i = this.activeIndex();
    if (i >= 0) this.selectUser(list[i]);
  }

  private resetFocus() {
    this.hasFocus.set(false);
    this.activeIndex.set(-1);
  }

  selectUser(u: Member) {
    if (this.selected().some(x => x.uid === u.uid)) return;
    if (this.existingMembers().some(x => x.uid === u.uid)) return;
    this.selected.update(a => [...a, u]);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  removeSelected(uid: string) {
    this.selected.update(a => a.filter(u => u.uid !== uid));
  }

  async addMembers() {
    if (this.isSubmitting()) return;
    if (!this.selected().length) return this.close();
    this.isSubmitting.set(true);
    try {
      const uids = this.mergeUids();
      const [c, m] = await Promise.all([
        this.fetchChannelData(),
        this.fetchAllMemberDetails(uids)
      ]);
      await this.updateMemberships(uids, c, m);
      await this.refreshChannel();
      this.dialogRef.close({ success: true, added: this.selected() });
    } catch {
      this.isSubmitting.set(false);
    }
  }

  private mergeUids() {
    return Array.from(new Set([
      ...this.existingMembers().map(u => u.uid),
      ...this.selected().map(u => u.uid)
    ]));
  }

  private async fetchChannelData() {
    const snap = await getDoc(doc(this.firestore, `users/${this.currentUserId}/memberships/${this.channelId}`));
    return snap.exists() ? snap.data() : {};
  }

  private async fetchAllMemberDetails(uids: string[]) {
    const map = new Map(this.allMembers.map(m => [m.uid, m]));
    return uids.map(uid => {
      const m = map.get(uid);
      return {
        uid,
        name: uid === this.currentUserId ? `${m?.name || 'Unbekannt'} (Du)` : m?.name || 'Unbekannt',
        avatar: m?.avatar || 'avatar-0.png',
        email: m?.email || '',
        status: m?.status || 'offline',
        isYou: uid === this.currentUserId
      };
    });
  }

  private async updateMemberships(uids: string[], channel: any, members: Member[]) {
    let batch = writeBatch(this.firestore);
    let count = 0;
    for (const uid of uids) {
      const ref = doc(this.firestore, `users/${uid}/memberships/${this.channelId}`);
      batch.set(ref, this.buildPayload(uid, channel, members));
      if (++count === 500) await this.commit(batch);
    }
    if (count % 500) await this.commit(batch);
  }

  private buildPayload(uid: string, c: any, m: Member[]) {
    return {
      channelId: this.channelId,
      name: c['name'] || 'Neuer Channel',
      description: c['description'] || '',
      joinedAt: c['joinedAt'] || new Date(),
      createdBy: c['createdBy'] || 'Unbekannt',
      members: m.map(x => ({
        ...x,
        isYou: x.uid === uid,
        name: x.uid === uid ? `${x.name.replace(' (Du)', '')} (Du)` : x.name.replace(' (Du)', '')
      }))
    };
  }

  private async commit(b: any) {
    await b.commit();
    b = writeBatch(this.firestore);
  }

  private async refreshChannel() {
    const snap = await getDoc(doc(this.firestore, `users/${this.currentUserId}/memberships/${this.channelId}`));
    if (snap.exists()) this.channelState.selectChannel({ ...snap.data(), id: this.channelId });
  }

  close() {
    this.dialogRef.close();
  }
}
