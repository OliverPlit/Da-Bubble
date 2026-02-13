import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { ThreadContext } from './thread-state.types';

/*
export type ThreadContext = {
    uid: string;
    channelId: string;
    channelName: string;
    messageId: string;
    root?: {
        author: { uid: string; username: string; avatar: string };
        createdAt: Date | string;
        text: string;
        reactions?: any[];
        isYou?: boolean;
    };
};
*/

@Injectable({ providedIn: 'root' })
export class ThreadStateService {
    private readonly _ctx$ = new BehaviorSubject<ThreadContext | null>(null);

    readonly ctx$: Observable<ThreadContext | null> = this._ctx$.asObservable();

    get value(): ThreadContext | null {
        return this._ctx$.value;
    }

    open(ctx: ThreadContext) {
        this._ctx$.next(ctx);
    }

    close() {
        this._ctx$.next(null);
    }

    closeIf(predicate: (ctx: ThreadContext) => boolean) {
        const v = this._ctx$.value;
        if (v && predicate(v)) this._ctx$.next(null);
    }
}