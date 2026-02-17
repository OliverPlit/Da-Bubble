import { Injectable, signal, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { getDocs, query, orderBy, collection, doc, Firestore, getDoc } from '@angular/fire/firestore';

/** Eindeutige ID des Standard-Channels „General“ – wird zuerst geöffnet, alle User sind automatisch drin. */
export const DEFAULT_CHANNEL_ID = 'general';

@Injectable({
  providedIn: 'root'
})
export class ChannelStateService {
  private selectedChannelSubject = new BehaviorSubject<any>(null);
  selectedChannel$ = this.selectedChannelSubject.asObservable();
private firestore = inject(Firestore);  private _channels = signal<any[]>([]);
  private _channelsSubject = new BehaviorSubject<any[]>([]);
  channels$ = this._channelsSubject.asObservable();
    private channelCache = new Map<string, any>();

  selectChannel(channel: any) {
    const cachedChannel = this.channelCache.get(channel.id);
    this.selectedChannelSubject.next(cachedChannel || channel);
  }

  getSelectedChannel() {
    return this.selectedChannelSubject.value;
  }

  updateSelectedChannel(channelData: any) {
    const currentChannel = this.selectedChannelSubject.value;
        this.channelCache.set(channelData.id, channelData);
    
    if (currentChannel && currentChannel.id === channelData.id) {
      this.selectedChannelSubject.next(channelData);
    }
  }

  getCurrentChannel() {
    return this.selectedChannelSubject.value;
  }

  setChannels(channels: any[]) {
    this._channels.set(channels);
    this._channelsSubject.next(channels);
  }

  async loadFullChannel(channelId: string) {
    if (this.channelCache.has(channelId)) {
      return this.channelCache.get(channelId);
    }

    const firestore = this.firestore;
    const ref = doc(firestore, `channels/${channelId}`);
    
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      const fullChannel = {
        id: channelId,
        ...data,
        members: Array.isArray(data['members']) ? data['members'] : [],
      };
            this.channelCache.set(channelId, fullChannel);
      
      return fullChannel;
    } catch (error) {
      console.error(`Fehler beim Laden von Channel ${channelId}:`, error);
      return null;
    }
  }

  removeChannel(channelId: string) {
    const updated = this._channels().filter(c => c.id !== channelId);
    this._channels.set(updated);
    this._channelsSubject.next(updated); 
    this.channelCache.delete(channelId);

    if (this.getCurrentChannel()?.id === channelId) {
      this.selectedChannelSubject.next(null);
    }
  }

  async loadFirstAvailableChannel(): Promise<void> {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) return;
      const uid = JSON.parse(storedUser).uid;
      const userRef = doc(this.firestore, 'users', uid);
      const membershipsRef = collection(userRef, 'memberships');
      const q = query(membershipsRef, orderBy('name'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docs = snapshot.docs;
        const generalDoc = docs.find(d => d.id === DEFAULT_CHANNEL_ID);
        const chosen = generalDoc ?? docs[0];
        const firstChannel = {
          id: chosen.id,
          ...chosen.data()
        };
        const fullChannel = await this.loadFullChannel(firstChannel.id);
        this.selectChannel(fullChannel || firstChannel);
      } else {
        this.selectChannel(null);
      }
    } catch (error) {
      console.error('Fehler beim Laden des ersten Channels:', error);
    }
  }

  clearCache() {
    this.channelCache.clear();
  }

  /** Cache für einen Channel leeren und ggf. neu laden (z. B. nach General-Sync). */
  async invalidateChannelAndReloadIfSelected(channelId: string): Promise<void> {
    this.channelCache.delete(channelId);
    const current = this.getCurrentChannel();
    if (current?.id === channelId) {
      const full = await this.loadFullChannel(channelId);
      if (full) this.selectChannel(full);
    }
  }
}