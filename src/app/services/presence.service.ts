import { Injectable, signal, effect } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, ref, onDisconnect, set, onValue } from '@angular/fire/database';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private currentUid: string | null = null;
  private statusRef: any;
  userStatusMap = signal<Record<string, 'online' | 'offline'>>({});

  constructor(private auth: Auth, private db: Database, private router: Router) {
    this.setupPresence();
  }

  private setupPresence() {
    effect(() => {
      this.initPresence();
      this.listenToAllStatuses();
    });
  }

  private initPresence() {
    this.auth.onAuthStateChanged((user) => {
      if (!user) {
        this.currentUid = null;
        return;
      }

      this.currentUid = user.uid;
      this.statusRef = ref(this.db, `status/${user.uid}`);

      onDisconnect(this.statusRef).set({
        state: 'offline',
        lastChanged: Date.now(),
      });
    });

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (!this.currentUid || !this.statusRef) return;

        if (event.urlAfterRedirects.startsWith('/main')) {
          // 🟢 ONLINE
          set(this.statusRef, {
            state: 'online',
            lastChanged: Date.now(),
          });
          console.log('🟢 ONLINE:', event.urlAfterRedirects);
        } else {
          // 🔴 OFFLINE
          set(this.statusRef, {
            state: 'offline',
            lastChanged: Date.now(),
          });
          console.log('🔴 OFFLINE:', event.urlAfterRedirects);
        }
      });
  }

  private listenToAllStatuses() {
    const statusRef = ref(this.db, 'status');

    onValue(statusRef, (snapshot) => {
      const raw = snapshot.val() || {};
      const mapped: Record<string, 'online' | 'offline'> = {};

      for (const uid in raw) {
        mapped[uid] = raw[uid]?.state === 'online' ? 'online' : 'offline';
      }
      this.userStatusMap.set(mapped);
    });
  }
}
