// All text shown in the app lives here, in English and Traditional Chinese (Hong Kong).
// To change any wording, edit it here. Every key must exist in both languages.

export type Lang = "en" | "zh";

export const translations = {
  en: {
    appName: "MediMemory",
    switchLanguage: "中文",
    switchLanguageLabel: "Switch to Traditional Chinese",

    // Landing page
    landingTitle: "Never wonder \"Did I take my medicine?\" again",
    landingSubtitle:
      "A simple medication tracker for older adults, their families, and their doctors.",
    chooseRole: "Who are you?",
    rolePatientTitle: "I take medicine",
    rolePatientDesc: "Confirm your doses with one big button.",
    roleCaregiverTitle: "I am a family caregiver",
    roleCaregiverDesc: "Set up medicines, see how things are going, and get alerts.",
    roleDoctorTitle: "I am a doctor",
    roleDoctorDesc: "Open the medication summary link shared by a caregiver.",

    // Placeholder pages
    comingSoon: "This page is coming soon.",
    backHome: "Back to home",
    patientTitle: "Your medicines",
    patientPlaceholder: "Here you will confirm each dose with one large button.",
    caregiverTitle: "Caregiver dashboard",
    caregiverPlaceholder:
      "Here you will set up medicines, see today's doses, and create a summary for the doctor.",
    doctorTitle: "Medication summary",
    doctorPlaceholder: "Here the doctor will see a printable summary of the medication history.",
    doctorLinkCode: "Link code",
    doctorDisclaimer:
      "Generated from caregiver and patient logged data. For clinical review only. Not medical advice.",

    // Footer (shown on every page)
    footerDisclaimer:
      "This tool records and summarises medication intake. It does not provide medical advice. Always follow your doctor's instructions.",
  },
  zh: {
    appName: "藥記通",
    switchLanguage: "English",
    switchLanguageLabel: "轉換至英文",

    landingTitle: "不再擔心「我食咗藥未？」",
    landingSubtitle: "為長者、家人及醫生而設的簡易服藥記錄工具。",
    chooseRole: "你是誰？",
    rolePatientTitle: "我需要服藥",
    rolePatientDesc: "按一個大按鈕，確認已經食藥。",
    roleCaregiverTitle: "我是照顧者",
    roleCaregiverDesc: "設定藥物、查看服藥情況及接收提示。",
    roleDoctorTitle: "我是醫生",
    roleDoctorDesc: "打開照顧者分享的服藥摘要連結。",

    comingSoon: "此頁面即將推出。",
    backHome: "返回主頁",
    patientTitle: "你的藥物",
    patientPlaceholder: "你將會在這裡按一個大按鈕，確認每次服藥。",
    caregiverTitle: "照顧者主頁",
    caregiverPlaceholder: "你將會在這裡設定藥物、查看今日服藥情況，並為醫生製作摘要。",
    doctorTitle: "服藥摘要",
    doctorPlaceholder: "醫生將會在這裡查看可列印的服藥記錄摘要。",
    doctorLinkCode: "連結編號",
    doctorDisclaimer: "根據照顧者及病人記錄的資料產生。只供臨床參考，並非醫療建議。",

    footerDisclaimer:
      "本工具只記錄及總結服藥情況，並不提供醫療建議。請時刻遵從醫生指示。",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TranslationKey = keyof (typeof translations)["en"];
