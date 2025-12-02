import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, map, firstValueFrom } from 'rxjs';
import { setDoc, Firestore, doc, updateDoc, arrayUnion, collection, collectionData } from '@angular/fire/firestore';



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
  selectedPeople: { name: string, avatar?: string }[] = [];
  allPeople: { name: string, avatar?: string }[] = [];
  filteredPeople: { name: string, avatar?: string }[] = [];
  hasFocus: boolean = false;
  activeIndex: number = -1;




  ngOnInit() {
    const dmRef = collection(this.firestore, 'directMessages');
    collectionData(dmRef, { idField: 'id' })
      .pipe(map(users => users.map(u => ({ name: u['name'] as string, avatar: u['avatar'] as string }))))
      .subscribe(users => {
        this.allPeople = users;
        this.filteredPeople = [];
      });
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
      .filter(u => !this.selectedPeople.some(sp => sp.name === u.name));
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.filteredPeople.length > 0) {
      event.preventDefault();
      this.selectPerson(this.filteredPeople[0]);
    }
  }


  selectPerson(person: { name: string, avatar?: string }) {

    if (this.selectedPeople.some(p => p.name === person.name)) return;

    this.selectedPeople.push(person);

    this.allPeople = this.allPeople.filter(
      p => p.name !== person.name || p.avatar !== person.avatar
    );

    this.inputName = '';
    this.filteredPeople = [];
  }


  removePerson(person: { name: string }) {
    this.selectedPeople = this.selectedPeople.filter(p => p.name !== person.name);
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
    const user = JSON.parse(storedUser);
    const uid = user.uid;
    const userName = user.name || 'Unbekannt';
    const userAvatar = user.avatar || '';

    const channelId = this.data.channelId;
    const membershipRef = doc(
      this.firestore,
      `users/${uid}/memberships/${channelId}`
    );

    // Stelle sicher, dass members existiert
    await setDoc(membershipRef, { members: [] }, { merge: true });

    // Option 2: ausgewählte Personen hinzufügen
    if (this.selectedOption === 'option2') {
      for (let p of this.selectedPeople) {
        await updateDoc(membershipRef, {
          members: arrayUnion({
            name: p.name,
            avatar: p.avatar ?? '',
            status: 'online'
          })
        });
      }
    }

    // Option 1: alle DirectMessage User hinzufügen
    else if (this.selectedOption === 'option1') {
      const dmRef = collection(this.firestore, 'directMessages');
      const dmSnap = await firstValueFrom(collectionData(dmRef, { idField: 'id' }));
      if (dmSnap) {
        for (let user of dmSnap) {
          await updateDoc(membershipRef, {
            members: arrayUnion({
              name: user['name'],
              avatar: user['avatar'] ?? '',
              status: 'online'
            })
          });
        }
      }
    }

    await updateDoc(membershipRef, {
      members: arrayUnion({
        name: userName,
        avatar: userAvatar,
        status: 'online'
      })
    });

    this.closeDialog();
  }


  create() {
    this.addMember();
    console.log('erstellt');

  }

}
