import { Injectable, computed, signal } from "@angular/core";
import { map, Observable, of } from "rxjs";

export type Emoji = {
    emojiId: EmojiId;
    emojiname: string;
    emojiSrc: string;
    unicode: string;
    shortcode: ReadonlyArray<string>;
}

export const EMOJIS_LIBRARY = [
    {
        emojiId: 'rocket',
        emojiname: 'Rocket',
        emojiSrc: '/img/emojis/emoji_rocket.png',
        unicode: '🚀',
        shortcode: [':rocket:']
    },
    {
        emojiId: 'check',
        emojiname: 'Check',
        emojiSrc: '/img/emojis/emoji_white heavy check mark.png',
        unicode: '✅',
        shortcode: [':check:']
    },
    {
        emojiId: 'nerd',
        emojiname: 'Nerd',
        emojiSrc: '/img/emojis/emoji_nerd face.png',
        unicode: '🤓',
        shortcode: [':nerd:']
    },
    {
        emojiId: 'thumbs_up',
        emojiname: 'ThumbsUp',
        emojiSrc: '/img/emojis/emoji_person raising both hands in celebration.png',
        unicode: '👍',
        shortcode: [':thumbs_up:']
    },
] as const;

export type EmojiId = typeof EMOJIS_LIBRARY[number]['emojiId'];

@Injectable({ providedIn: 'root' })
export class EmojiService {
    private readonly _all = signal<ReadonlyArray<Emoji>>([...EMOJIS_LIBRARY]);
    private readonly _map = computed(() => new Map(this._all().map(emoji => [emoji.emojiId, emoji])));

    private readonly _shortcodeMap = computed<Map<string, Emoji>>(() => {
        const map = new Map<string, Emoji>();
        for (const emoji of this._all()) {
            for (const shortcode of emoji.shortcode) {
                map.set(shortcode, emoji);
            }
        }
        return map;
    });

    private readonly _unicodeMap = computed<Map<string, Emoji>>(() => {
        const map = new Map<string, Emoji>();
        for (const emoji of this._all()) map.set(emoji.unicode, emoji);
        return map;
    });

    all(): ReadonlyArray<Emoji> { return this._all(); }
    get(emojiId: EmojiId | string): Emoji | undefined { return this._map().get(emojiId as EmojiId); }
    isValid(emojiId: string): emojiId is EmojiId { return this._map().has(emojiId as EmojiId); }
    src(emojiId: EmojiId | string): string { return this.get(emojiId)?.emojiSrc ?? ''; }

    all$(): Observable<Emoji[]> { return of(this._all() as Emoji[]); }
    get$(emojiId: EmojiId): Observable<Emoji | undefined> { return of(this.get(emojiId)); }

    emojiToText(emojiId: EmojiId | string): string {
        return this.get(emojiId)?.unicode ?? '';
    }

    normalizeShortcodes(text: string): string {
        if (!text) return text;
        return text.replace(/:[a-z_]+:/g, (m) => this._shortcodeMap().get(m)?.unicode ?? m);
    }

    unicodeToId(unicode: string): EmojiId | undefined {
        return this._unicodeMap().get(unicode)?.emojiId as EmojiId | undefined;
    }

    idToShortcode(id: EmojiId | string): string | null {
        const emoji = this.get(id);
        return emoji?.shortcode?.[0] ?? null;
    }

    idToUnicode(id: EmojiId | string): string {
        return this.get(id)?.unicode ?? '';
    }

    appendById(draft: string, id: EmojiId, withSpace = true): string {
        const unicode = this.idToUnicode(id);
        if (!unicode) return draft ?? '';
        const spacer = withSpace ? ' ' : '';
        return (draft ?? '') + (draft ? ' ' : '') + unicode + spacer;
    }
}