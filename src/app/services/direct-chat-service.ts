import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { directMessageContact } from '../main/menu/direct-messages/direct-messages.model';

@Injectable({
  providedIn: 'root',
})
export class DirectChatService {
  private chatUserSubject = new BehaviorSubject<directMessageContact | null>(null);

  chatUser$ = this.chatUserSubject.asObservable();

  openChat(user: directMessageContact) {
    this.chatUserSubject.next(user);
  }
}
