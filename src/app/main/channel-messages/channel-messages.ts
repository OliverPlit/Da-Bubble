import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChannelMessagesHeader } from './channel-messages-header/channel-messages-header';
import { ThreadChannelMessages } from './thread-channel-messages/thread-channel-messages';
import { NewMessage } from '../menu/new-message/new-message';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-channel-messages',
  imports: [ChannelMessagesHeader, ThreadChannelMessages, NewMessage, CommonModule],
  templateUrl: './channel-messages.html',
  styleUrl: './channel-messages.scss',
})
export class ChannelMessages {
  private _channel: any;

  @Input()
  set channel(value: any) {
    this._channel = value;
    if (value) {
      this.channelName = value.name;
      this.channelId = value.id;
      this.members = value.members || [];
    }
  }
  get channel() {
    return this._channel;
  }

  @Input() showNewMessages = false;
  @Output() closeNewMessage = new EventEmitter<void>();

  channelName = '';
  channelId = '';
  members: any[] = [];

  onClose() {
    this.closeNewMessage.emit();
  }

}



