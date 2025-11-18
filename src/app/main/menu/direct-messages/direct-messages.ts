import { Component, OnInit } from '@angular/core';
import { directMessageContact } from './direct-messages.model';
import { FirebaseService } from '../../../services/firebase';

import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-direct-messages',
  imports: [CommonModule],
  templateUrl: './direct-messages.html',
  styleUrl: './direct-messages.scss',
})
export class DirectMessages {
  directMessage: directMessageContact[] = [];

  constructor(private firebaseService: FirebaseService) { }

  async ngOnInit() {
    this.firebaseService.getCollection$('directMessages')
      .subscribe(data => {
        this.directMessage = data as directMessageContact[];
      });
  }


}
