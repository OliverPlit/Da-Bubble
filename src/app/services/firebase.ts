import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, collection, getDocs, addDoc, collectionData  } from '@angular/fire/firestore';
import { Observable } from 'rxjs';



@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  constructor(private firestore: Firestore) {}

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

  // Dokument hinzufügen
  addDocument(collectionName: string, data: any) {
    const colRef = collection(this.firestore, collectionName);
    return addDoc(colRef, data);
  }

}
