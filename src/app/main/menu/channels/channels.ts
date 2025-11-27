import { Component, inject, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Firestore, collection, doc, collectionData } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { FirebaseService } from '../../../services/firebase';
import { Channel } from "../channels/channel.model";
import { ChannelMessages } from '../../channel-messages/channel-messages';


@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [CommonModule, ChannelMessages],
  templateUrl: './channels.html',
  styleUrl: './channels.scss',
})
export class Channels implements OnInit {
  firestore: Firestore = inject(Firestore);
  memberships: any[] = [];
  selectedChannel: any = null;

  constructor(private channelService: FirebaseService, private dialog: MatDialog, private cdr: ChangeDetectorRef) { }
@Output() channelClicked = new EventEmitter<any>();
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
    this.dialog.open(AddChannel, { panelClass: 'add-channel-dialog-panel' });
  }

  openChannel(channel: any) {
    this.selectedChannel = channel; }
}
