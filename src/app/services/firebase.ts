import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, collection, getDocs } from '@angular/fire/firestore';

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
  async getCollection(collectionName: string) {
    const colRef = collection(this.firestore, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => doc.data());
  }
}
