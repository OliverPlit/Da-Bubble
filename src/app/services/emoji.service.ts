import { Injectable, computed, signal } from "@angular/core";
import { map, Observable, of } from "rxjs";

export type Emoji = {
    emojiId: EmojiId;
    emojiname: string;
    emojiSrc: string;
}

export const EMOJIS_LIBRARY = [
    { emojiId: 'rocket', emojiname: 'Rocket', emojiSrc: 'icons/emojis/emoji_rocket.png' },
    { emojiId: 'check', emojiname: 'Check', emojiSrc: 'icons/emojis/emoji_white heavy check mark.png' },
    { emojiId: 'nerd', emojiname: 'Nerd', emojiSrc: 'icons/emojis/emoji_nerd face.png' },
    { emojiId: 'thumbs_up', emojiname: 'ThumbsUp', emojiSrc: 'icons/emojis/emoji_person raising both hands in celebration.png' },
] as const;

export type EmojiId = typeof EMOJIS_LIBRARY[number]['emojiId'];

@Injectable({ providedIn: 'root' })
export class EmojiService {
    private readonly _all = signal<ReadonlyArray<Emoji>>([...EMOJIS_LIBRARY]);
    private readonly _map = computed(() => new Map(this._all().map(emoji => [emoji.emojiId, emoji])));

    all(): ReadonlyArray<Emoji> { return this._all(); }
    get(emojiId: EmojiId | string): Emoji | undefined { return this._map().get(emojiId as EmojiId); }
    isValid(emojiId: string): emojiId is EmojiId { return this._map().has(emojiId as EmojiId); }
    src(emojiId: EmojiId | string): string { return this.get(emojiId)?.emojiSrc ?? ''; }

    all$(): Observable<Emoji[]> { return of(this._all() as Emoji[]); }
    get$(emojiId: EmojiId): Observable<Emoji | undefined> { return of(this.get(emojiId)); }
}