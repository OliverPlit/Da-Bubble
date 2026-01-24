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
  private cd = inject(ChangeDetectorRef);
  firestore = inject(Firestore);
  private firebaseService = inject(FirebaseService);
  
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
  activeIndex = signal<number>(-1);
  isSubmitting = signal(false);
  isLoading = signal(true);

  constructor(private cdr: ChangeDetectorRef, private channelState: ChannelStateService) {}

  async ngOnInit() {
    // Alle Daten parallel laden
    const [userData, allUsers] = await Promise.all([
      this.loadCurrentUser(),
      this.loadAllUsers()
    ]);

    // Dialog-Daten setzen
    const data = this.data as DialogData;
    this.channelId = data.channelId || '';
    this.channelName = data.channelName || '';
    this.fullChannel = data.fullChannel;
    
    if (data.existingMembers) {
      this.existingMembers.set(data.existingMembers);
    } else if (data.members) {
      this.existingMembers.set(data.members);
    }

    // User-Liste setzen
    this.allMembers = allUsers;
    this.members = allUsers;
    this.isLoading.set(false);
    this.cd.detectChanges();

    // Name-Updates abonnieren (für spätere Änderungen)
    this.subscribeToNameChanges();
  }

  private async loadCurrentUser(): Promise<void> {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const userData = JSON.parse(storedUser);
    this.currentUserId = userData.uid;
    if (!this.currentUserId) return;

    try {
      const userRef = doc(this.firestore, 'directMessages', this.currentUserId);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const data: any = snap.data();
        this.userName = data.name;
        this.firebaseService.setName(this.userName);
      }
    } catch (error) {
      console.error('Fehler beim Laden des aktuellen Users:', error);
    }
  }

  private async loadAllUsers(): Promise<Member[]> {
    try {
      const dmRef = collection(this.firestore, 'directMessages');
      const q = query(dmRef);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(docSnap => ({
        uid: docSnap.id,
        name: docSnap.data()['name'] ?? 'Unbekannter Benutzer',
        avatar: docSnap.data()['avatar'] ?? 'avatar-0.png',
        status: docSnap.data()['status'] ?? 'offline',
        email: docSnap.data()['email'] ?? ''
      } as Member));
    } catch (error) {
      console.error('Fehler beim Laden aller User:', error);
      return [];
    }
  }

  private subscribeToNameChanges(): void {
    this.firebaseService.currentName$.subscribe((name) => {
      if (!name || !this.currentUserId) return;
      this.userName = name;

      this.existingMembers.update(members =>
        members.map(m => m.uid === this.currentUserId ? { ...m, name: `${name} (Du)` } : m)
      );

      this.selected.update(members =>
        members.map(m => m.uid === this.currentUserId ? { ...m, name: `${name} (Du)` } : m)
      );

      this.cd.detectChanges();
    });
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

    const channelId = this.channelId;

    try {
      const newMemberUids = this.selected().map(u => u.uid);
      const existingMemberUids = this.existingMembers().map(u => u.uid);
      
      const allMemberUids = Array.from(new Set([
        ...existingMemberUids,
        ...newMemberUids
      ]));

      // Parallel: Channel-Daten und Member-Details laden
      const [channelData, allMembersData] = await Promise.all([
        this.fetchChannelData(this.currentUserId, channelId),
        this.fetchAllMemberDetailsBatch(allMemberUids)
      ]);

      // Batch-Update aller Memberships
      await this.updateAllUserMembershipsBatch(allMemberUids, channelId, channelData, allMembersData);

      // Channel-State aktualisieren
      const membershipRef = doc(this.firestore, `users/${this.currentUserId}/memberships/${channelId}`);
      const snap = await getDoc(membershipRef);
      
      if (snap.exists()) {
        const freshChannelData = snap.data();
        this.channelState.selectChannel({ ...freshChannelData, id: channelId });
      }

      // Dialog schließen
      this.dialogRef.close({ success: true, added: this.selected() });

    } catch (err) {
      console.error('Fehler beim Hinzufügen von Mitgliedern:', err);
      this.isSubmitting.set(false);
    }
  }

  private async fetchChannelData(currentUid: string, channelId: string) {
    const ref = doc(this.firestore, `users/${currentUid}/memberships/${channelId}`);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  }

  private async fetchAllMemberDetailsBatch(allMemberUids: string[]): Promise<Member[]> {
    // Alle bereits in allMembers geladenen User verwenden
    const memberMap = new Map(this.allMembers.map(m => [m.uid, m]));
    
    return allMemberUids.map(uid => {
      const member = memberMap.get(uid);
      if (!member) {
        return {
          uid,
          name: 'Unbekannter Benutzer',
          avatar: 'avatar-0.png',
          email: '',
          status: 'offline',
          isYou: uid === this.currentUserId
        } as Member;
      }
      
      return {
        ...member,
        name: uid === this.currentUserId ? `${member.name} (Du)` : member.name,
        isYou: uid === this.currentUserId
      };
    });
  }

  private async updateAllUserMembershipsBatch(
    allMemberUids: string[],
    channelId: string,
    channelData: any,
    allMembers: Member[]
  ) {
    const MAX_BATCH_SIZE = 500;
    const batches: Promise<void>[] = [];
    let currentBatch = writeBatch(this.firestore);
    let operationCount = 0;

    for (const userUid of allMemberUids) {
      const ref = doc(this.firestore, `users/${userUid}/memberships/${channelId}`);
      
      const personalizedMembers = allMembers.map(m => 
        m.uid === userUid 
          ? { ...m, name: m.name.includes('(Du)') ? m.name : `${m.name.replace(' (Du)', '')} (Du)`, isYou: true }
          : { ...m, name: m.name.replace(' (Du)', ''), isYou: false }
      );

      currentBatch.set(ref, {
        channelId,
        name: channelData['name'] || 'Neuer Channel',
        description: channelData['description'] || '',
        joinedAt: channelData['joinedAt'] || new Date(),
        createdBy: channelData['createdBy'] || 'Unbekannt',
        members: personalizedMembers
      }, { merge: false });

      operationCount++;

      if (operationCount >= MAX_BATCH_SIZE) {
        batches.push(currentBatch.commit());
        currentBatch = writeBatch(this.firestore);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
  }

  close() {
    this.dialogRef.close();
  }
}