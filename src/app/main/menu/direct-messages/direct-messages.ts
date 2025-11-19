import { Component, OnInit } from '@angular/core';
import { directMessageContact } from './direct-messages.model';
import { FirebaseService } from '../../../services/firebase';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-direct-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './direct-messages.html',
  styleUrl: './direct-messages.scss',
})
export class DirectMessages {
  directMessage: directMessageContact[] = [];

  constructor(private firebaseService: FirebaseService) { }
  directMessage$: Observable<directMessageContact[]> | undefined;

  async ngOnInit() {
    this.directMessage$ = this.firebaseService.getCollection$('directMessages');

  }


}
