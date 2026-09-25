# zai-autocloser

**English** | [العربية](README.ar.md)

[![Install on Greasy Fork](https://img.shields.io/badge/Install-Greasy%20Fork-670000?style=flat-square&logo=greasyfork&logoColor=white)](https://greasyfork.org/en/scripts/597424-z-ai-peak-popup-auto-close-smart-resend)

A Tampermonkey/Violentmonkey userscript that automatically closes the
Z.ai "Currently in peak hours" popup and safely resends your message.

When Z.ai is overloaded, chat.z.ai shows a modal like:

> Currently in peak hours
> GLM-5.3 is intensifying the coordination of resources, please switch to
> GLM-5.3-Flash for experience or try again later.

This script closes that dialog for you and resends your message after a
short, escalating delay — without ever clicking the "Switch to ..." button.

## Features

- Popup detection for the English and Chinese UI (case-insensitive)
- Safe close-button search: `aria-label` → CSS class → icon-only X →
  known-safe text buttons ("Try again later", "Got it", …)
- Never clicks switch/cancel/confirm buttons (`FORBIDDEN_BUTTONS` blacklist)
- Backs up your input text before closing and restores it before resending
- React-safe input restoration (native value setter + `input` event)
- Escalating backoff: 3.5s, 5.5s, 7.5s … up to 5 retries per message
- Watches `fetch` for a successful send and resets the retry counter,
  so a message that actually went through is never duplicated
- Console control: `__zaiPeakAutoCloser.stop()`, `.reset()`, `.state`,
  `.triggerTest()`

## Install

1. Install a userscript manager directly from the Chrome Web Store:
   - [Tampermonkey — Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Violentmonkey — Chrome Web Store](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag)
2. Open the script page on Greasy Fork and click **Install this script**:

   <https://greasyfork.org/en/scripts/597424-z-ai-peak-popup-auto-close-smart-resend>

   (Manual alternative: create a new userscript in your manager and paste the
   contents of [`zai-autocloser.user.js`](zai-autocloser.user.js).)
3. Open <https://chat.z.ai> — you should see `🚀 Z.ai Peak AutoCloser …`
   in the browser console.

## Configuration

Edit the `CONFIG` object at the top of the script:

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `KEYWORDS` | see file | Popup phrases used for detection |
| `FORBIDDEN_BUTTONS` | see file | Button texts the script must never click |
| `SAFE_DISMISS_BUTTONS` | see file | Text buttons that are safe to click to dismiss |
| `RESEND_DELAY` | 3500 ms | Base wait before resending |
| `RETRY_BACKOFF` | 2000 ms | Extra wait added per failed attempt |
| `MAX_RETRY` | 5 | Max automatic retries per message |
| `DEBUG` | true | Console logging |

## Disclaimer

The peak popup is how Z.ai sheds load during busy periods. This script
dismisses it and retries politely with escalating delays and a hard retry
cap — but using it is at your own discretion and may be at odds with the
service's intent.

## License

MIT — see [LICENSE](LICENSE).
