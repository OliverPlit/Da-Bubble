import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc, collection, getDocs, addDoc, collectionData  } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs';


export type Member = {
  uid: string;
  name: string;
  avatar?: string;
  status?: string;
};

export type HeaderView = 'default' | 'new-message' | 'add-channel';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
    private firestore = inject(Firestore);
private nameSource = new BehaviorSubject<string>('');
  currentName$ = this.nameSource.asObservable();
  membersSignal = signal<Member[]>([]);
    private currentViewSubject = new BehaviorSubject<HeaderView>('default');
  currentView$ = this.currentViewSubject.asObservable();

  constructor() {}

  // Ein Dokument abrufen
  async getDocument(collectionName: string, id: string) {
    const docRef = doc(this.firestore, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  // Alle Dokumente einer Collection abrufen
   getCollection$(collectionName: string): Observable<any[]> {
    const colRef = collection(this.firestore, collectionName);
    return collectionData(colRef, { idField: 'id' });
  }

   get currentNameValue(): string {
    return this.nameSource.getValue();
  }


  // Dokument hinzufügen
  addDocument(collectionName: string, data: any) {
    const colRef = collection(this.firestore, collectionName);
    return addDoc(colRef, data);
  }

 setName(name: string) {
    this.nameSource.next(name);
  }
  

   loadMembers(channelId: string) {
    const col = collection(this.firestore, `channels/${channelId}/members`);
    collectionData(col, { idField: 'uid' })
      .pipe(
        map(list => list.map(u => ({ uid: u['uid'], name: u['name'], avatar: u['avatar'] })))
      )
      .subscribe(list => this.membersSignal.set(list));
  }

   addMembers(channelId: string, newMembers: Member[]) {
    this.membersSignal.update(old => [...old, ...newMembers]);
    // 🔹 Hier kannst du auch Firestore updateDoc() aufrufen
  }

 setView(view: HeaderView) {
    this.currentViewSubject.next(view);
  }

  resetView() {
    this.currentViewSubject.next('default');
  }

  getCurrentView(): HeaderView {
    return this.currentViewSubject.value;
  }

}
