import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, doc, collectionData } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { ChannelStateService } from './channel.service';

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './channels.html',
  styleUrl: './channels.scss',
})
export class Channels implements OnInit {
  firestore: Firestore = inject(Firestore);
  router = inject(Router);
  memberships: any[] = [];
  selectedChannelId: string = '';

  constructor(
    private dialog: MatDialog, 
    private cdr: ChangeDetectorRef, 
    private channelState: ChannelStateService
  ) { }

  ngOnInit() {
    // Zuerst den aktuell ausgewählten Channel laden (falls vorhanden)
    const currentChannel = this.channelState.getSelectedChannel();
    if (currentChannel) {
      this.selectedChannelId = currentChannel.id;
    }
    
    this.loadData();
    
    this.channelState.selectedChannel$.subscribe(channel => {
      if (channel) {
        this.selectedChannelId = channel.id;
        this.cdr.detectChanges();
      }
    });
  }

   loadData() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;

    const uid = JSON.parse(storedUser).uid;
    if (!uid) return;

    const userRef = doc(this.firestore, 'users', uid);
    const membershipsRef = collection(userRef, 'memberships');

    collectionData(membershipsRef, { idField: 'id' }).subscribe(async memberships => {
      this.memberships = memberships;
      
      // Vollständige Channel-Daten im Hintergrund vorladen
      this.preloadChannelData(memberships);
      
      const currentChannel = this.channelState.getSelectedChannel();

      if (memberships.length > 0 && !currentChannel) {
        // Ersten Channel auswählen ohne auf vollständige Daten zu warten
        this.onChannelClick(memberships[0]);
      }
      
      this.cdr.detectChanges();
    });
  }

  // Vollständige Channel-Daten im Hintergrund laden
  private async preloadChannelData(memberships: any[]) {
    const loadPromises = memberships.map(async (membership) => {
      try {
        await this.channelState.loadFullChannel(membership.id);
      } catch (error) {
        console.error(`Fehler beim Vorladen von Channel ${membership.id}:`, error);
      }
    });
    
    // Alle Channels parallel laden
    await Promise.all(loadPromises);
  }

  openDialog() {
    this.dialog.open(AddChannel, { panelClass: 'add-channel-dialog-panel' });
  }

  onChannelClick(channel: any) {
    this.selectedChannelId = channel.id;
    
    // Sofort mit den verfügbaren Daten navigieren
    this.channelState.selectChannel(channel);
    this.router.navigate(['/main/channels']);
    
    // Vollständige Daten im Hintergrund nachladen falls noch nicht vorhanden
    this.loadChannelDataInBackground(channel.id);
  }

  private async loadChannelDataInBackground(channelId: string) {
    try {
      const fullChannel = await this.channelState.loadFullChannel(channelId);
      if (fullChannel) {
        this.channelState.updateSelectedChannel(fullChannel);
      }
    } catch (error) {
      console.error(`Fehler beim Laden von Channel ${channelId}:`, error);
    }
  }
}