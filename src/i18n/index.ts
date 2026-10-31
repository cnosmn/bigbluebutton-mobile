import { getLocales } from 'expo-localization';

import en from './en';
import tr from './tr';

export type Messages = typeof tr;

const catalogs: Record<string, Messages> = { tr, en };

// Turkish devices get Turkish, everything else falls back to English.
function detectLanguage(): keyof typeof catalogs {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code in catalogs ? code : 'en';
}

export const language = detectLanguage();
export const t: Messages = catalogs[language];
