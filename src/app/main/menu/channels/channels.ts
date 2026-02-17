import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, doc, collectionData } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AddChannel } from '../add-channel/add-channel';
import { ChannelStateService, DEFAULT_CHANNEL_ID } from './channel.service';
import { LayoutService } from '../../../services/layout.service';

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
  layout = inject(LayoutService);
  memberships: any[] = [];
  selectedChannelId: string = '';

  constructor(
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private channelState: ChannelStateService,
  ) { }

  ngOnInit() {
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
      this.memberships = [...memberships].sort((a, b) => {
        if (a.id === DEFAULT_CHANNEL_ID) return -1;
        if (b.id === DEFAULT_CHANNEL_ID) return 1;
        return (a['name'] || '').localeCompare(b['name'] || '');
      });
      this.preloadChannelData(this.memberships);

      const currentChannel = this.channelState.getSelectedChannel();

      if (this.memberships.length > 0 && !currentChannel) {
        const generalOrFirst = this.memberships.find((m: any) => m.id === DEFAULT_CHANNEL_ID) ?? this.memberships[0];
        this.selectChannelWithoutClosingMenu(generalOrFirst);
      }
      
      this.cdr.detectChanges();
    });
  }

  // Channel auswählen ohne das Menu zu schließen (für automatische Auswahl)
  private selectChannelWithoutClosingMenu(channel: any) {
    this.selectedChannelId = channel.id;
    // KEIN layout.showContent() - Menu bleibt offen
    this.loadChannelDataInBackground(channel.id);
  }

  // Vollständige Channel-Daten im Hintergrund laden
  private async preloadChannelData(memberships: any[]) {
    const loadPromises = memberships.map(async (membership) => {
      try {
        await this.loadChannelDataInBackground(membership.id);
      } catch (error) {
        console.error(`Fehler beim Vorladen von Channel ${membership.id}:`, error);
      }
    });
    await Promise.all(loadPromises);
  }

  openDialog() {
    this.dialog.open(AddChannel, { panelClass: 'add-channel-dialog-panel' });
  }

  onChannelClick(channel: any) {
    this.selectedChannelId = channel.id;
        this.channelState.selectChannel(channel);
    this.router.navigate(['/main/channels']);
    
    this.layout.showContent();
    
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