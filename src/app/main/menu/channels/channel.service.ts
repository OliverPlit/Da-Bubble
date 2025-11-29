import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChannelStateService {
  private selectedChannelSubject = new BehaviorSubject<any>(null);
  
  selectedChannel$ = this.selectedChannelSubject.asObservable();

  selectChannel(channel: any) {
    this.selectedChannelSubject.next(channel);
  }

  getCurrentChannel() {
    return this.selectedChannelSubject.value;
  }
}
