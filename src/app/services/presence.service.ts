import { Injectable, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, ref, onDisconnect, set, onValue } from '@angular/fire/database';

@Injectable({ providedIn: 'root' })
export class PresenceService {

  userStatusMap = signal<Record<string, 'online' | 'offline'>>({});

  constructor(private auth: Auth, private db: Database) {
    this.initPresence();
    this.listenToAllStatuses();
  }

  private initPresence() {
    this.auth.onAuthStateChanged(user => {
      if (!user) return;

      const statusRef = ref(this.db, `status/${user.uid}`);

      set(statusRef, {
        state: 'online',
        lastChanged: Date.now()
      });

      onDisconnect(statusRef).set({
        state: 'offline',
        lastChanged: Date.now()
      });
    });
  }

  private listenToAllStatuses() {
    const statusRef = ref(this.db, 'status');

    onValue(statusRef, snapshot => {
      this.userStatusMap.set(snapshot.val() || {});
    });
  }
}