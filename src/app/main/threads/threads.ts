import { Component, HostBinding, HostListener, inject, effect } from '@angular/core';
import { ThreadsHeader } from "./threads-header/threads-header";
import { MessadesThreads } from "./messages-threads/messades-threads";
import { CommonModule } from '@angular/common';
import { ThreadStateService } from '../../services/thread-state.service';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-threads',
  imports: [ThreadsHeader, MessadesThreads, CommonModule],
  templateUrl: './threads.html',
  styleUrls: ['./threads.scss'],
})
export class Threads {
  private state = inject(ThreadStateService);
  public layout = inject(LayoutService);

  isMobile = false;
  isVisible = true;

  @HostBinding('class.mobile') get isMobileClass() {
    return this.isMobile;
  }

  @HostBinding('class.thread-open') get isThreadOpen() {
    return this.isVisible;
  }

  constructor() {
    this.checkWidth();

    // Reagiere auf Thread-Context Änderungen
    this.state.ctx$.subscribe(ctx => {
      this.updateVisibility(!!ctx);
    });

    // Reagiere auf Layout showRight() Signal Änderungen
    effect(() => {
      const showRight = this.layout.showRight();
      // Update visibility wenn sich showRight ändert
      this.updateVisibility(!!this.state.value);
    });
  }

  private updateVisibility(hasContext: boolean) {
    if (this.isMobile) {
      // On mobile, show threads as fullscreen overlay when there's context AND showRight is true
      this.isVisible = hasContext && this.layout.showRight();
    } else {
      // On desktop, show in sidebar when there's context
      this.isVisible = hasContext;
    }
  }

  @HostListener('window:resize')
  checkWidth() {
    this.isMobile = window.innerWidth <= 750;
    this.updateVisibility(!!this.state.value);
  }
}