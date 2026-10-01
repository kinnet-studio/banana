import { describe, expect, it } from 'bun:test';
import {
    DUAL_SPINE_HINT_KEYS,
    SINGLE_SPINE_HINT_KEYS,
} from 'track-layout/station-placement';

import en from '../src/i18n/locales/en';
import ja from '../src/i18n/locales/ja';
import zhTW from '../src/i18n/locales/zh-TW';

describe('station placement hint translations', () => {
    for (const [locale, { translation }] of Object.entries({
        en,
        ja,
        'zh-TW': zhTW,
    })) {
        it(`${locale} translates every hint key`, () => {
            for (const key of [
                ...SINGLE_SPINE_HINT_KEYS,
                ...DUAL_SPINE_HINT_KEYS,
            ]) {
                expect(translation).toHaveProperty(key);
            }
        });
    }
});
