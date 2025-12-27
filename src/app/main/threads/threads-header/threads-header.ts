import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { LayoutService } from '../../../services/layout.service';

@Component({
  selector: 'app-threads-header',
  imports: [CommonModule, FormsModule],
  templateUrl: './threads-header.html',
  styleUrl: './threads-header.scss',
})
export class ThreadsHeader {
  channel = 'Entwicklerteam';

  private dialog = inject(MatDialog);
  private layout = inject(LayoutService);

  closeThread() {
      this.layout.closeRight();
  }
}
