// Links shared on Instagram, Facebook, Messenger or TikTok open inside that app's own browser.
// Google blocks OAuth sign-in there (403 disallowed_useragent), so the account card warns first
// and offers to copy the link for Safari/Chrome. E-mail sign-in keeps working in these browsers.
const IN_APP=[
 ['Instagram',/\bInstagram\b/i],
 ['Facebook',/\bFBA[NV]\/|\bFB_IAB\b|\bFBIOS\b/i],
 ['Messenger',/\bMessenger(?:ForiOS|LiteForiOS)?\b/i],
 ['TikTok',/\bBytedanceWebview\b|\bmusical_ly\b|\bTikTok\b/i],
 ['LinkedIn',/\bLinkedInApp\b/i],
 ['Snapchat',/\bSnapchat\b/i]
];

export function inAppBrowserName(userAgent=''){
 const ua=String(userAgent||'');
 for(const [name,pattern] of IN_APP)if(pattern.test(ua))return name;
 return '';
}

export function inAppBrowserHint(name){
 if(!name)return '';
 return `Otwierasz City Route w przeglądarce ${name}a. Google nie pozwala się w niej zalogować. Otwórz link w Safari lub Chrome (menu ⋯ → „Otwórz w przeglądarce”) albo załóż konto e-mailem poniżej.`;
}
