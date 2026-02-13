import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { LayoutService } from '../../../services/layout.service';
import { ThreadStateService } from '../../../services/thread-state.service';
import { ThreadContext } from '../../../services/thread-state.types';

@Component({
  selector: 'app-threads-header',
  imports: [CommonModule, FormsModule],
  templateUrl: './threads-header.html',
  styleUrl: './threads-header.scss',
})
export class ThreadsHeader {
  private dialog = inject(MatDialog);
  public layout = inject(LayoutService);
  private state = inject(ThreadStateService);

  private get ctx(): ThreadContext | null {
    return this.state.value;
  }

  get title(): string {
    return 'Thread';
  }

  get subtitle(): string {
    const ctx = this.state.value;
    if (!ctx) return '';
    return ctx.kind === 'channel' ? `# ${ctx.channelName}` : ctx.dmName;
  }

  closeThread() {
    // Schließe Thread - auf Mobile wird dann automatisch der Content wieder sichtbar
    this.layout.closeThread();
  }
}