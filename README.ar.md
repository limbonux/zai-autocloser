# zai-autocloser

[English](README.md) | **العربية**

[![ثبّت من Greasy Fork](https://img.shields.io/badge/%D8%AB%D8%A8%D8%AA-Greasy%20Fork-670000?style=flat-square&logo=greasyfork&logoColor=white)](https://greasyfork.org/en/scripts/597424-z-ai-peak-popup-auto-close-smart-resend)

سكربت مستخدم (Tampermonkey / Violentmonkey) يغلق تلقائيًا نافذة
"Currently in peak hours" في Z.ai ويعيد إرسال رسالتك بأمان.

عندما يزدحم الخادم، يعرض chat.z.ai نافذة مثل:

> Currently in peak hours
> GLM-5.3 is intensifying the coordination of resources, please switch to
> GLM-5.3-Flash for experience or try again later.

هذا السكربت يغلق تلك النافذة عنك ويعيد إرسال رسالتك بعد مهلة قصيرة متزايدة —
دون أن يضغط أبدًا على زر "Switch to …".

## الميزات

- كشف النافذة في واجهتي الموقع الإنجليزية والصينية (بلا حساسية لحالة الأحرف)
- بحث آمن عن زر الإغلاق بترتيب أولوية: `aria-label` ← فئة CSS ← أيقونة X ←
  أزرار نصية معروفة بأنها آمنة ("Try again later", "Got it", …)
- لا ينقر أبدًا أزرار التبديل/الإلغاء/التأكيد (قائمة محظورات `FORBIDDEN_BUTTONS`)
- يحفظ نسخة من نص رسالتك قبل الإغلاق ويستعيدها قبل إعادة الإرسال
- استرجاع متوافق مع React (setter أصلي + حدث `input`)
- مهل متزايدة: 3.5 ث ثم 5.5 ث ثم 7.5 ث … حتى 5 محاولات لكل رسالة
- يراقب `fetch`؛ عند نجاح الإرسال الفعلي يصفّر العداد — فلا تتكرر رسالة وصلت أصلًا
- تحكم من الكونسول: `__zaiPeakAutoCloser.stop()` و `.reset()` و `.state`
  و `.triggerTest()`

## التثبيت

1. ثبّت مدير سكربتات لمتصفحك مباشرة من متجر كروم:
   - [Tampermonkey — متجر كروم](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Violentmonkey — متجر كروم](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag)
2. أنشئ سكربتًا جديدًا والصق محتوى
   [`zai-autocloser.user.js`](zai-autocloser.user.js)، أو ثبّته مباشرة من
   الرابط الخام:
   `https://github.com/limbonux/zai-autocloser/raw/main/zai-autocloser.user.js`
3. افتح <https://chat.z.ai> — سترى في كونسول المتصفح رسالة
   `🚀 Z.ai Peak AutoCloser …`.

## الإعدادات

عدّل كائن `CONFIG` في أعلى الملف:

| الخيار | الافتراضي | المعنى |
| ------ | --------- | ------ |
| `KEYWORDS` | انظر الملف | عبارات التعرف على نافذة الذروة |
| `FORBIDDEN_BUTTONS` | انظر الملف | نصوص أزرار لا يجوز النقر عليها أبدًا |
| `SAFE_DISMISS_BUTTONS` | انظر الملف | أزرار نصية آمنة للإغلاق |
| `RESEND_DELAY` | 3500 ms | المهلة الأساسية قبل إعادة الإرسال |
| `RETRY_BACKOFF` | 2000 ms | مهلة إضافية بعد كل محاولة فاشلة |
| `MAX_RETRY` | 5 | أقصى عدد محاولات تلقائية لكل رسالة |
| `DEBUG` | true | طباعة السجل في الكونسول |

## تنبيه

نافذة الذروة وسيلة لتخفيف الحمل عن خوادم Z.ai في أوقات الازدحام. هذا السكربت
يغلقها ويعيد المحاولة بلطف بمهل متزايدة وحد أقصى للمحاولات — لكن استخدامه
على مسؤوليتك، وقد يخالف نية الخدمة.

## الترخيص

MIT — انظر [LICENSE](LICENSE).
