import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChannelMessagesHeader } from './channel-messages-header/channel-messages-header';
import { ThreadChannelMessages } from './thread-channel-messages/thread-channel-messages';
import { NewMessage } from '../menu/new-message/new-message';
import { CommonModule } from '@angular/common';
import { ChannelStateService } from '../../main/menu/channels/channel.service';

@Component({
  selector: 'app-channel-messages',
  imports: [ChannelMessagesHeader, ThreadChannelMessages, NewMessage, CommonModule],
  templateUrl: './channel-messages.html',
  styleUrl: './channel-messages.scss',
})
export class ChannelMessages implements OnInit, OnDestroy {
  channelName = '';
  channelId = '';
  description = '';
  members: any[] = [];
    fullChannel: any = null;

 @Input() showNewMessages = false;
    private subscription?: Subscription;
  constructor(private channelState: ChannelStateService) {} 
    ngOnInit() {
      
    this.subscription = this.channelState.selectedChannel$.subscribe(channel => {
      if (channel) {
        console.log('Vollständiges Channel-Objekt:', channel); 
         this.fullChannel = channel;
        this.channelName = channel.name || '';
        this.channelId = channel.id || '';
        this.members = channel.members || [];
        this.description = channel.description || ''; 
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  onClose() {
    this.showNewMessages = false;
  }

}



