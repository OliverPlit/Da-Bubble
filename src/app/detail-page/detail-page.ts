import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-detail-page',
  templateUrl: './detail-page.html',
  styleUrls: ['./detail-page.scss']
})
export class DetailPage implements OnInit {
  id!: string;
  data: any;

  constructor(private route: ActivatedRoute, private firestore: Firestore) {}

  async ngOnInit() {
    // ID aus der URL holen
    this.id = this.route.snapshot.paramMap.get('id')!;

    // Firestore-Daten unter dieser ID abrufen
    const docRef = doc(this.firestore, 'collectionName', this.id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      this.data = docSnap.data();
    } else {
      console.log('Kein Dokument gefunden!');
    }
  }
}