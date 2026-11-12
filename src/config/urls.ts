const CATHAY_MEMBERSHIP_SIGN_UP = {
  traditionalChinese:
    "https://www.cathaypacific.com/cx/zh_HK/membership/sign-up.html",
  english: "https://www.cathaypacific.com/cx/en_HK/membership/sign-up.html",
};

export function cathayMembershipSignUpUrl(locale: string): string {
  return locale === "zh-Hant"
    ? CATHAY_MEMBERSHIP_SIGN_UP.traditionalChinese
    : CATHAY_MEMBERSHIP_SIGN_UP.english;
}

// Official FAQ verified on 2026-11-12. This is guidance, not an invented management URL.
export function cathayGuardianGuidanceUrl(locale: string): string {
  const language = locale === "zh-Hant" ? "zh_HK" : "en_HK";
  return `https://www.cathaypacific.com/cx/${language}/faqs/cathay-membership-programme/asia-miles/transfer-asia-miles/how-can-i-add-a-guardians-membership-information-to-a-minors-account.html`;
}
