import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { ComponentType } from '@angular/cdk/portal';

type AnchorAlign  = 'start' | 'center' | 'end';
type AnchorSide  = 'left' | 'right' | 'top' | 'bottom';

export interface AnchorOverlayOptions {
    width: number;
    height: number;
    preferredSide?: AnchorSide;
    align?: AnchorAlign;
    offset?: number;
    dialogConfig?: Omit<MatDialogConfig, 'position' | 'width'>;
}

@Injectable({ providedIn: 'root' })
export class AnchorOverlayService {
    openAnchored<T, R = any>(
        dialog: MatDialog,
        component: ComponentType<T>,
        origin: HTMLElement,
        opts: AnchorOverlayOptions
    ): MatDialogRef<T, R> {
        const { x, y, w, h } = this.rect(origin);
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const width = opts.width;
        const height = opts.height;
        const offset = opts.offset ?? 8;
        const side = opts.preferredSide ?? 'bottom';
        const align = opts.align ?? 'start';

        let left = this.computeLeft(x, w, width, side, align, offset);
        let top = this.computeTop(y, h, height, side, align, offset);

        if (left < 0 || left + width > vw) {
            const flipSide = side === 'left' ? 'right' :
                side === 'right' ? 'left' : side;
            const flippedLeft = this.computeLeft(x, w, width, flipSide, align, offset);
            if (flippedLeft >= 0 && flippedLeft + width <= vw) {
                left = flippedLeft;
            }
        }
        
        if (top < 0 || top + height > vh) {
            const flipSide = side === 'top' ? 'bottom' :
                side === 'bottom' ? 'top' : side;
            const flippedTop = this.computeTop(y, h, height, flipSide, align, offset);
            if (flippedTop >= 0 && flippedTop + height <= vh) {
                top = flippedTop;
            }
        }

        left = Math.min(Math.max(8, left), Math.max(8, vw - width - 8));
        top = Math.min(Math.max(8, top), Math.max(8, vh - height - 8));

        const cfg: MatDialogConfig = {
            ...(opts.dialogConfig ?? {}),
            width: `${width}px`,
    
            position: { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` },
        };

        return dialog.open<T, any, R>(component, cfg);
    }

    private rect(el: HTMLElement) {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    }

    private computeLeft(
        x: number, w: number, dlgW: number, side: AnchorSide, align: AnchorAlign, offset: number
    ): number {
        if (side === 'left') return x - dlgW - offset;
        if (side === 'right') return x + w + offset;

        if (align === 'center') return x + (w - dlgW) / 2;
        if (align === 'end') return x + w - dlgW;
        return x;
    }

    private computeTop(
        y: number, h: number, dlgH: number, side: AnchorSide, align: AnchorAlign, offset: number
    ): number {
        if (side === 'top') return y - dlgH - offset;
        if (side === 'bottom') return y + h + offset;

        if (align === 'center') return y + (h - dlgH) / 2;
        if (align === 'end') return y + h - dlgH;
        return y;
    }
}