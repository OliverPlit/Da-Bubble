import { Component, HostListener } from '@angular/core';
import { ThreadsHeader } from "./threads-header/threads-header";
import { MessadesThreads } from "./messages-threads/messades-threads";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-threads',
  imports: [ThreadsHeader, MessadesThreads, CommonModule],
  templateUrl: './threads.html',
  styleUrls: ['./threads.scss'],
})
export class Threads {

 isMobile = false;
  isVisible = true;
  constructor() {this.checkWidth()}

  
  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 650;
    this.isVisible = !this.isMobile;

  }
}