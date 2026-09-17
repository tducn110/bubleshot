import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const LANGUAGE_STORAGE_KEY = "08-shoot-language";
type SupportedLanguage = "vi" | "en";
const isSupportedLanguage = (value: string | null): value is SupportedLanguage => value === "vi" || value === "en";
const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") return "en";
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(value)) return value;
  } catch {
    // Storage read failure fallback
  }
  
  return "en";
};

const persistLanguage = (language: string): void => {
  const normalized = language.split("-")[0];
  if (typeof window === "undefined" || !isSupportedLanguage(normalized)) return;
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized); } catch { /* Optional persistence. */ }
};

const syncDocumentLang = (language: string): void => {
  if (typeof document === "undefined") return;
  const normalized = language.split("-")[0];
  document.documentElement.lang = isSupportedLanguage(normalized) ? normalized : "en";
};

const resources = {
  vi: {
    translation: {
      common: {
        play: "Chơi",
        pause: "Tạm dừng",
        resume: "Tiếp tục",
        back: "Quay lại",
        close: "Đóng",
        retry: "Chơi lại",
        score: "Điểm",
        play_again: "Chơi lại",
      },
      game: {
        level_clear: "VƯỢT ẢI!",
        you_lose: "BẠN ĐÃ THUA RỒI",
        retry: "LẠI",
        next: "TIẾP",
        play_again: "CHƠI LẠI",
        score: "ĐIỂM",
        rank: "HẠNG",
      },
      leaderboard: {
        title: "BẢNG XẾP HẠNG",
        subtitle: "TOP 10 CAO THỦ",
        you: "BẠN",
        rank: "HẠNG",
        anonymous: "ẨN DANH",
      },
      settings: {
        title: "Cài đặt",
        language: "Ngôn ngữ",
        music: "Nhạc nền",
        sfx: "Hiệu ứng âm thanh",
        haptics: "Rung",
        on: "Bật",
        off: "Tắt",
      },
    },
  },
  en: {
    translation: {
      common: {
        play: "Play",
        pause: "Pause",
        resume: "Resume",
        back: "Back",
        close: "Close",
        retry: "Play again",
        score: "Score",
        play_again: "Play again",
      },
      game: {
        level_clear: "LEVEL CLEAR!",
        you_lose: "YOU LOST!",
        retry: "RETRY",
        next: "NEXT",
        play_again: "PLAY AGAIN",
        score: "SCORE",
        rank: "RANK",
      },
      leaderboard: {
        title: "LEADERBOARD",
        subtitle: "TOP 10 PLAYERS",
        you: "YOU",
        rank: "RANK",
        anonymous: "ANONYMOUS",
      },
      settings: {
        title: "Settings",
        language: "Language",
        music: "Background music",
        sfx: "Sound effects",
        haptics: "Haptics",
        on: "On",
        off: "Off",
      },
    },
  },
} as const;

const initialLanguage = getInitialLanguage();
syncDocumentLang(initialLanguage);

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    supportedLngs: ["vi", "en"],
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
i18n.on("languageChanged", (lang) => {
  persistLanguage(lang);
  syncDocumentLang(lang);
});

export default i18n;
