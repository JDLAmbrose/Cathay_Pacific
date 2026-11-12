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
