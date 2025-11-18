import { Component, inject, OnInit } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { FirebaseService } from '../../../services/firebase';
import { Channel } from "../channels/channel.model";



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
  channels: Channel[] = [
  ];
  private dialog = inject(MatDialog);

  constructor(private channelService: FirebaseService) { }

  ngOnInit() {
 this.channelService.getCollection$('channels')
      .subscribe(data => {
        this.channels = data as Channel[];
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
