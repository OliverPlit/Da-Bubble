import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChannelMessagesHeader } from './channel-messages-header/channel-messages-header';
import { ThreadChannelMessages } from './thread-channel-messages/thread-channel-messages';
import { NewMessage } from '../menu/new-message/new-message';
import { CommonModule } from '@angular/common';
import { ChannelStateService } from '../../main/menu/channels/channel.service';
import { CurrentUserService } from '../../services/current-user.service';

@Component({
  selector: 'app-channel-messages',
  imports: [ChannelMessagesHeader, ThreadChannelMessages, NewMessage, CommonModule],
  templateUrl: './channel-messages.html',
  styleUrl: './channel-messages.scss',
})
export class ChannelMessages implements OnInit, OnDestroy {
  currentUid = '';
  channelName = '';
  channelId = '';
  description = '';
  createdBy = '';
  members: any[] = [];
  fullChannel: any = null;

  @Input() showNewMessages = false;
  private subscription?: Subscription;
  constructor(
    private channelState: ChannelStateService,
    private session: CurrentUserService
  ) { }
  async ngOnInit() {
    await this.session.hydrateFromLocalStorage();
    const u = this.session.getCurrentUser();
    this.currentUid = u?.uid ?? '';

    this.subscription = this.channelState.selectedChannel$.subscribe(channel => {
      if (channel) {
        console.log('Vollständiges Channel-Objekt:', channel);
        this.fullChannel = channel;
        this.channelName = channel.name || '';
        this.channelId = channel.id || '';
        this.members = channel.members || [];
        this.description = channel.description || '';
        this.createdBy = channel.createdBy || '';

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



