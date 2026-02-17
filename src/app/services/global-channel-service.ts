import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection, getDocs } from '@angular/fire/firestore';
import { DEFAULT_CHANNEL_ID, ChannelStateService } from '../main/menu/channels/channel.service';

type Member = {
  uid: string;
  name: string;
  avatar?: string;
  email?: string;
  status?: string;
  isYou?: boolean;
};

type Channel = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: Member[];
  createdAt: Date;
  updatedAt: Date;
};

@Injectable({
  providedIn: 'root',
})
export class GlobalChannelService {
  private firestore = inject(Firestore);
  private channelState = inject(ChannelStateService);

  // -----------------------------------------------------
  // 1) Channel immer robust lesen (mit Fallbacks)
  // -----------------------------------------------------
  async getGlobalChannel(channelId: string): Promise<Channel | null> {
    const ref = doc(this.firestore, `channels/${channelId}`);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    const data = snap.data();

    return {
      id: snap.id,
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      createdBy: data['createdBy'] ?? '',
      members: Array.isArray(data['members']) ? data['members'] : [], // 🔥 IMMER Array
      createdAt: data['createdAt'] ?? new Date(),
      updatedAt: data['updatedAt'] ?? new Date()
    };
  }

  // -----------------------------------------------------
  // 2) Sicheres Update – members immer mitführen
  // -----------------------------------------------------
  async updateGlobalChannel(channelId: string, channelData: Partial<Channel>) {
    const existing = await this.getGlobalChannel(channelId);

    const mergedData = {
      ...existing,
      ...channelData,
      members: Array.isArray(channelData.members)
        ? channelData.members
        : existing?.members ?? [],   // 🔥 niemals undefined!
      updatedAt: new Date()
    };

    const ref = doc(this.firestore, `channels/${channelId}`);
    await setDoc(ref, mergedData, { merge: true });
  }

  // -----------------------------------------------------
  // 3) Members synchronisieren – FEHLERSICHER
  // -----------------------------------------------------
  async syncAllUserMemberships(channelId: string, updatedMembers: Member[] | undefined) {

    // 🔥 Sicherstellen, dass ein Array existiert
    if (!Array.isArray(updatedMembers)) {
      console.warn(`⚠ updatedMembers war undefined – setze []`);
      updatedMembers = [];
    }

    const globalChannel = await this.getGlobalChannel(channelId);
    if (!globalChannel) {
      console.warn(`⚠ Channel ${channelId} nicht gefunden`);
      return;
    }

    // 🔥 Nur EIN globalChannel für alle User, spart Firestore calls
    const payload = {
      channelId,
      name: globalChannel.name,
      description: globalChannel.description,
      createdBy: globalChannel.createdBy,
      members: globalChannel.members // immer Array
    };

    for (const member of updatedMembers) {
      await this.syncUserMembership(member.uid, channelId, payload);
    }

  }

  // -----------------------------------------------------
  // 4) Einzelne Membership robust synchronisieren
  // -----------------------------------------------------
  private async syncUserMembership(uid: string, channelId: string, channel: any) {
    const ref = doc(this.firestore, `users/${uid}/memberships/${channelId}`);

    const snap = await getDoc(ref);
    const joinedAt = snap.exists() ? snap.data()['joinedAt'] : new Date();

    await setDoc(ref, {
      ...channel,
      joinedAt,
      syncedAt: new Date()
    }, { merge: true });
  }

  // -----------------------------------------------------
  // 5) Neue Members hinzufügen – fehlersicher
  // -----------------------------------------------------
  async addMembersToChannel(channelId: string, newMembers: Member[], channelData: Partial<Channel>) {
    let global = await this.getGlobalChannel(channelId);

    if (!global) {
      global = {
        id: channelId,
        name: channelData.name || 'Neuer Channel',
        description: channelData.description || '',
        createdBy: channelData.createdBy || 'Unknown',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    const existingUids = new Set(global.members.map(m => m.uid));
    const uniqueNewMembers = newMembers.filter(m => !existingUids.has(m.uid));

    const updatedMembers = [...global.members, ...uniqueNewMembers];

    await this.updateGlobalChannel(channelId, { members: updatedMembers });

    await this.syncAllUserMemberships(channelId, updatedMembers);


    return updatedMembers;
  }

  // -----------------------------------------------------
  // 6) Standard-Channel „General“: anlegen falls nötig, neuen User immer hinzufügen
  // -----------------------------------------------------
  async ensureDefaultChannelAndAddUser(uid: string, name: string, avatar?: string, email?: string): Promise<void> {
    const channelId = DEFAULT_CHANNEL_ID;
    const channelRef = doc(this.firestore, `channels/${channelId}`);
    const snap = await getDoc(channelRef);

    const newMember: Member = {
      uid,
      name,
      avatar: avatar || 'avatar-0.png',
      email: email || ''
    };

    if (!snap.exists()) {
      const dmRef = collection(this.firestore, 'directMessages');
      const dmSnap = await getDocs(dmRef);
      const members: Member[] = dmSnap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          name: data['name'] ?? '',
          avatar: data['avatar'] || 'avatar-0.png',
          email: data['email'] || ''
        };
      });
      if (members.every(m => m.uid !== uid)) {
        members.push(newMember);
      }
      const channelData: Channel = {
        id: channelId,
        name: 'General',
        description: 'Willkommen! Hier sind alle Nutzer.',
        createdBy: name,
        members,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await setDoc(channelRef, channelData);
      await this.syncAllUserMemberships(channelId, members);
      return;
    }

    await this.addMembersToChannel(channelId, [newMember], {
      name: 'General',
      description: 'Willkommen! Hier sind alle Nutzer.',
      createdBy: snap.data()['createdBy'] || name
    });
  }

  /**
   * General-Mitglieder an den aktuellen Stand von directMessages anpassen.
   * Entfernt gelöschte User aus dem Channel. Einmal ausführen nach Aufräumen in Firebase.
   */
  async syncGeneralMembersFromDirectMessages(): Promise<void> {
    const channelId = DEFAULT_CHANNEL_ID;
    const global = await this.getGlobalChannel(channelId);
    if (!global) return;

    const dmRef = collection(this.firestore, 'directMessages');
    const dmSnap = await getDocs(dmRef);
    const members: Member[] = dmSnap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        name: data['name'] ?? '',
        avatar: data['avatar'] || 'avatar-0.png',
        email: data['email'] ?? ''
      };
    });

    await this.updateGlobalChannel(channelId, { members });
    await this.syncAllUserMemberships(channelId, members);
    await this.channelState.invalidateChannelAndReloadIfSelected(channelId);
  }
}
