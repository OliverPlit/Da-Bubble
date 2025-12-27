import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  showLeft = signal(true);
  showRight = signal(true);

  closeRight() {
    this.showRight.set(false);
  }

  openRight() {
    this.showRight.set(true);
  }

  toggleLeft() {
    this.showLeft.set(!this.showLeft());
  }

}
