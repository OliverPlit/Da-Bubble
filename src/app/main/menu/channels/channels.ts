import { Component, inject, OnInit } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { FirebaseService } from '../../../services/firebase';
import { Channel } from "../channels/channel.model";
import { collection, doc } from '@angular/fire/firestore';
import { collectionData } from '@angular/fire/firestore';
import { ChangeDetectorRef } from '@angular/core';



@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './channels.html',
  styleUrl: './channels.scss',
})
export class Channels implements OnInit {
  firestore: Firestore = inject(Firestore);
  channels$: Observable<any[]> | undefined;
  memberships: any[] = [];

  constructor(private channelService: FirebaseService, private dialog: MatDialog,   private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;

    const userRef = doc(this.firestore, 'users', uid);
    const membershipsRef = collection(userRef, 'memberships');

    collectionData(membershipsRef, { idField: 'id' }).subscribe(memberships => {
      this.memberships = memberships;
       this.cdr.detectChanges();
    });
  }


  openDialog() {
    this.dialog.open(AddChannel, {
      panelClass: 'add-channel-dialog-panel'
    });
  }

  addChannel(channel: Channel) {
    this.channelService.addDocument('channels', channel);
  }

}
