import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, map, firstValueFrom } from 'rxjs';
import { setDoc, Firestore, doc, updateDoc, arrayUnion, collection, collectionData, getDoc } from '@angular/fire/firestore';



@Component({
  selector: 'app-add-people',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-people.html',
  styleUrl: './add-people.scss',
})
export class AddPeople implements OnInit {
  dialogRef = inject(MatDialogRef<AddPeople>);
  data = inject(MAT_DIALOG_DATA);
  firestore: Firestore = inject(Firestore);
  showExtraFields = false;
  selectedOption: 'option1' | 'option2' | null = null;
  inputName: string = "";
  peopleList: string[] = [];
  directMessagePeople: Observable<any[]> | undefined;
  selectedPeople: { uid: string, name: string, avatar: string, email: string }[] = [];
  allPeople: { uid: string, name: string, avatar: string, email: string }[] = [];
  filteredPeople: { uid: string, name: string, avatar: string, email: string }[] = [];
  hasFocus: boolean = false;
  activeIndex: number = -1;
  currentUserId: string = '';




  ngOnInit() {
        this.loadCurrentUserId();

    const dmRef = collection(this.firestore, 'directMessages');

    collectionData(dmRef, { idField: 'uid' })
      .pipe(
        map(users =>
          users.map(u => ({
            uid: u['uid'] as string,
            name: u['name'] as string,
            avatar: u['avatar'] as string,
            email: (u['email'] as string) ?? ''
          }))
        )
      )
      .subscribe(users => {
        this.allPeople = users;
        this.filteredPeople = [];
      });
  }

  private loadCurrentUserId() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserId = JSON.parse(storedUser).uid;
    }
  }




  onOptionChange(opt: 'option1' | 'option2') {
    this.selectedOption = opt;
    if (opt === 'option2') {
      this.showExtraFields = true;
    }
    else {
      this.showExtraFields = false;
      this.inputName = '';
      this.filteredPeople = [];
      this.selectedPeople = [];
    }
  }


  filterPeople() {
    const value = this.inputName.toLowerCase().trim();

    if (value.length < 1) {
      this.filteredPeople = [];
      return;
    }

    this.filteredPeople = this.allPeople
      .filter(u => u.name.toLowerCase().includes(value))
      .filter(u => !this.selectedPeople.some(sp => sp.uid === u.uid))
      .filter(u => u.uid !== this.currentUserId); 
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.filteredPeople.length > 0) {
      event.preventDefault();
      this.selectPerson(this.filteredPeople[0]);
    }
  }


  selectPerson(person: { uid: string, name: string, avatar: string, email: string }) {
    if (this.selectedPeople.some(p => p.uid === person.uid)) return;

    this.selectedPeople.push(person);

    this.allPeople = this.allPeople.filter(p => p.uid !== person.uid);

    this.inputName = '';
    this.filteredPeople = [];
  }


  removePerson(person: { uid: string, name: string, avatar: string, email: string }) {
    this.selectedPeople = this.selectedPeople.filter(p => p.uid !== person.uid);
    this.allPeople.push(person);
    this.allPeople.sort((a, b) => a.name.localeCompare(b.name));

    this.filterPeople();
  }

  toggleExtraField(status: boolean) {
    this.showExtraFields = status;
  }


  closeDialog() {
    this.dialogRef.close();
  }

  isFormValid(): boolean {
    if (!this.selectedOption) return false;

    if (this.selectedOption == 'option2') {
      return this.selectedPeople.length > 0;
    }

    return true;
  }


 async addMember() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const currentUid = JSON.parse(storedUser).uid;
    const channelId = this.data.channelId;

    try {
        const memberUids: string[] = await this.getMemberUids(currentUid);

        for (const memberUid of memberUids) {
            await this.handleUserChannelMembership(memberUid, channelId, memberUids);
        }
        await this.updateChannelState(currentUid, channelId, memberUids);

        this.closeDialog();
    } catch (error) {
        console.error('Fehler beim Hinzufügen von Mitgliedern:', error);
    }
}


async getMemberUids(currentUid: string): Promise<string[]> {
    let memberUids: string[] = [currentUid]; 

    if (this.selectedOption === 'option2') {
        memberUids.push(...this.selectedPeople.map(p => p.uid));
    } else if (this.selectedOption === 'option1') {
        const dmRef = collection(this.firestore, 'directMessages');
        const dmSnap = await firstValueFrom(collectionData(dmRef, { idField: 'uid' }));
        memberUids = dmSnap.map(u => u['uid'] as string);
    }

    return Array.from(new Set(memberUids));
}


async handleUserChannelMembership(userUid: string, channelId: string, allMemberUids: string[]) {
    try {
        const storedUser = localStorage.getItem('currentUser');
        const currentUid = storedUser ? JSON.parse(storedUser).uid : '';

        // 1. Channel-Informationen vom Ersteller holen
        const channelData = await this.fetchChannelData(currentUid, channelId);

        // 2. Alle Member-Daten (Name, Avatar etc.) holen
        const allMembers = await this.fetchMemberDetails(currentUid, allMemberUids);

        // 3. Channel-Membership für diesen User erstellen/aktualisieren
        await this.setChannelMembership(userUid, channelId, channelData, allMembers);

    } catch (error) {
        console.error(`Fehler beim Bearbeiten der Channel-Mitgliedschaft für User ${userUid}:`, error);
    }
}


async fetchChannelData(currentUid: string, channelId: string): Promise<any> {
    const creatorMembershipRef = doc(
        this.firestore,
        `users/${currentUid}/memberships/${channelId}`
    );
    const creatorSnap = await getDoc(creatorMembershipRef);
    return creatorSnap.exists() ? creatorSnap.data() : {};
}



async fetchMemberDetails(currentUid: string, allMemberUids: string[]): Promise<any[]> {
    const allMembers = [];
    for (const uid of allMemberUids) {
        const dmUserRef = doc(this.firestore, 'directMessages', uid);
        const dmUserSnap = await getDoc(dmUserRef);

        if (dmUserSnap.exists()) {
            const userData = dmUserSnap.data();
            allMembers.push({
                uid: uid,
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

async setChannelMembership(userUid: string, channelId: string, channelData: any, allMembers: any[]) {
    const membershipRef = doc(
        this.firestore,
        `users/${userUid}/memberships/${channelId}`
    );

    await setDoc(membershipRef, {
        channelId,
        name: channelData['name'] || 'Neuer Channel',
        description: channelData['description'] || '',
        joinedAt: new Date(),
        createdBy: channelData['createdBy'] || 'Unbekannt',
        members: allMembers ,
    });
}


async updateChannelState(currentUid: string, channelId: string, memberUids: string[]) {
    if (!this.data.channelState) return;

    // Aktuelle Channel-Daten neu laden
    const membershipRef = doc(this.firestore, `users/${currentUid}/memberships/${channelId}`);
    const membershipSnap = await getDoc(membershipRef);
    
    if (membershipSnap.exists()) {
        const updatedChannelData = {
            id: channelId,
            ...membershipSnap.data()
        };
        
        // Channel-State Service aktualisieren
        this.data.channelState.updateSelectedChannel(updatedChannelData);
    }
}


  create() {
    this.addMember();
    console.log('erstellt');
  }

}