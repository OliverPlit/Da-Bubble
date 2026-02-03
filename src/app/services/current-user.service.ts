// src/app/services/user-session.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Pipe, PipeTransform } from '@angular/core';

export type CurrentUser = {
    uid: string;
    name: string;
    email?: string | null;
    avatar: string;
};

@Pipe({ name: 'avatarUrl', standalone: true })
export class AvatarUrlPipe implements PipeTransform {
  transform(src?: string): string {
    if (!src) return '/icons/avatars/avatar1.png';
    if (src.startsWith('http')) return src;
    if (src.startsWith('/icons/avatars/')) return src;
    
    return `/icons/avatars/${src}`;
  }
}


@Injectable({ providedIn: 'root' })
export class CurrentUserService {
    private firestore = inject(Firestore);
    private _user$ = new BehaviorSubject<CurrentUser | null>(null);

    readonly user$ = this._user$.asObservable();

    async hydrateFromLocalStorage() {
        const raw = localStorage.getItem('currentUser');
        if (!raw) { this._user$.next(null); return; }

        let uid = '';
        try {
            const parsed = JSON.parse(raw);
            uid = parsed?.uid ?? raw;
        } catch {
            uid = raw;
        }
        if (!uid) { this._user$.next(null); return; }

        const snap = await getDoc(doc(this.firestore, 'users', uid));
        if (!snap.exists()) { this._user$.next(null); return; }

        const d: any = snap.data();
        this._user$.next({
            uid,
            name: d.name ?? 'Unbekannt',
            avatar: d.avatar ?? 'avatar1.png',
            email: d.email ?? '',
        });
    }

    getCurrentUser(): CurrentUser | null {
        return this._user$.value;
    }
}