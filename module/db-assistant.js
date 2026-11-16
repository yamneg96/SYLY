/*!
 * SYLY <db-assistant> : accessible multilingual course assistant (Track 3).
 * One zero-dependency vanilla JS file, no build step (SDS 1.2, FR-L9).
 *
 * Host contract (FR-L1, FR-L2):
 *   <script src="/module/db-assistant.js" defer></script>
 *   <db-assistant lang="am" api="/api" content="/demo/data/content.json"
 *                 theme="auto" mode="panel" position="end"></db-assistant>
 * Events (FR-L3), bubbles + composed:
 *   db-assistant:question  {text, language}
 *   db-assistant:escalated {ticketId}
 *   db-assistant:language  {language}
 * Methods: open(), close(), getText(key, lang?)
 *
 * Sections: config, i18n, util, search, element (panel / inline), api, queue,
 * voice, links, dates.
 */
(function () {
  'use strict';
  if (!window.customElements || window.customElements.get('db-assistant')) return;

  /* ---------------------------------------------------------------- config */
  // document.baseURI, not location.href: inside an srcdoc iframe location.href is "about:srcdoc".
  var SCRIPT_URL = (document.currentScript && document.currentScript.src) || document.baseURI;
  // Guide section 8: "Use the <dialog> element with showModal()". The panel is
  // therefore always modal. Set to false for the SDS 1.3 variant (show() at
  // 900px and wider, showModal() below).
  var MODAL_ALWAYS = true;
  var MODAL_BELOW_PX = 900;
  var FALLBACK_BUTTON = '#002B56'; // guide's skeleton colour, 4.5:1+ with white
  var THRESHOLD = { en: 1.5, am: 0.35 }; // tuned on api/scripts/eval.py questions
  var STORE = 'db-assistant:';
  var POLL_MS = 5000;

  /* ------------------------------------------------------------------ i18n */
  // Generated from module/i18n/*.json by `npm --prefix module run i18n`.
  // A test checks this copy and the JSON files are identical.
  /* I18N:BEGIN */
  var I18N = {
    "en": {
      "dir": "ltr",
      "speechLang": "en-US",
      "title": "SYLY Assistant",
      "resize": "Resize the assistant panel. Use the left and right arrow keys, Home, End, or Enter to reset.",
      "launcher": "Ask SYLY",
      "close": "Close",
      "language": "Language",
      "simpleMode": "Simple mode",
      "onlineAnswers": "Online answers",
      "questionLabel": "Your question",
      "inlineLabel": "Ask about this lesson",
      "questionHint": "Enter sends. Shift and Enter adds a new line.",
      "send": "Send",
      "mic": "Speak",
      "micStop": "Stop recording",
      "micListening": "Listening. Speak now.",
      "micDone": "Check the text, then press Send.",
      "micUnsupported": "Voice input does not work in this browser. Please type your question.",
      "micError": "I could not hear you. Please try again or type.",
      "talk": "Talk to a person",
      "you": "You",
      "assistant": "SYLY",
      "tutor": "Tutor",
      "sources": "Sources",
      "listen": "Listen",
      "stopListening": "Stop",
      "noVoice": "No voice is available for this answer. It is shown as text.",
      "fromSection": "From the section “{title}”:",
      "answeredLocal": "Answer taken from the course text.",
      "answeredAi": "Written by AI from the course text. Check the source.",
      "notFound": "I could not find this in the course.",
      "notFoundOffer": "A person can help you. Press “Talk to a person”.",
      "noAdvice": "I cannot give medical, legal or immigration advice. A person can help you.",
      "emptyIntro": "Ask a question about this lesson. I answer only from the course and show where each answer came from.",
      "exampleAbout": "Tell me about {title}",
      "refresh": "Refresh",
      "refreshedPage": "The page was read again.",
      "refreshedChat": "The page was read again. A new conversation started.",
      "translateLabel": "Show this answer in",
      "translating": "Translating…",
      "translatedNote": "Translated by AI from {from}. Check the original through the source link.",
      "translateFailed": "Could not translate now. The answer is shown in its original language.",
      "translateNeedsConsent": "To translate, first turn on online answers.",
      "translateHint": "Online answers are off, so this answer stays in its own language. Turn them on to read it in {language}.",
      "noAnswerToTranslate": "There is no answer to translate yet. Ask a question first.",
      "examplesTitle": "Try one of these:",
      "example1": "Will AI replace virtual assistants?",
      "example2": "What skills will clients value?",
      "example3": "What should an aspiring VA do?",
      "statusOnline": "Online",
      "statusOffline": "Offline: answers from saved course notes",
      "statusSending": "Sending…",
      "statusReady": "Ready",
      "queued": "Saved on this phone. It will send when you are online.",
      "queuedSent": "Your saved message was sent.",
      "emptyQuestion": "Please type a question first.",
      "consentTitle": "Before we start",
      "consentText": "To answer, SYLY can send your question to an online AI service. Nothing about who you are is sent.",
      "consentAllow": "Allow online answers",
      "consentDeny": "Use answers from this page only",
      "consentWhat": "What is sent?",
      "consentDetails": "Only your question and the course sections that match it. No name, phone number or account is sent. You can change this choice with the “Online answers” button at the top.",
      "escalating": "Connecting…",
      "escalatedOnline": "A tutor is joining. Stay on this page; their reply will appear here.",
      "escalatedLater": "A tutor will answer here. It may take until morning.",
      "escalateQueued": "Your request for a person is saved on this phone. It will send when you are online.",
      "ticketNumber": "Request number: {id}",
      "tutorJoined": "A person joined: {name}",
      "skipLink": "Skip to assistant",
      "langName_am": "አማርኛ",
      "langName_en": "English",
      "langName_ar": "العربية",
      "noVoiceAm": "No Amharic voice available. The answer is shown as text.",
      "telegramOption": "Also get the tutor's reply on Telegram",
      "shareScreen": "Share my screen",
      "shareStop": "Stop sharing (Esc)",
      "sharing": "You are sharing your screen with the tutor.",
      "shareStopped": "Screen sharing stopped.",
      "shareAsked": "The tutor asks to see your screen. You choose: share it, or send a screenshot.",
      "sendScreenshot": "Send a screenshot",
      "screenshotSent": "Screenshot sent to the tutor.",
      "screenshotTooBig": "This picture is too big. Please choose a smaller screenshot.",
      "yourData": "Your data",
      "exportData": "Download my data",
      "deleteData": "Delete my conversation",
      "dataDeleted": "Your conversation was deleted from this phone and from the server.",
      "dataNote": "We keep your questions without your name, to improve the course. You can download or delete them here.",
      "jobTrust": "Check on the employer's own site. Never pay to apply.",
      "jobDeadline": "Apply by {date}.",
      "jobDeadlinePassed": "The deadline for this job has passed ({date}).",
      "jobAsk": "Tell me about this job: {title}",
      "alertsHow": "To get alerts for jobs like this, send “/alerts {keyword}” to our Telegram bot, or text “ALERT {keyword}”. Send STOP at any time to stop.",
      "openTelegram": "Open the Telegram bot",
      "accTitle": "Interview support request",
      "accFor": "For the job: {title}",
      "accStep": "Step {n} of {total}",
      "accQ1": "What support do you need?",
      "accHint1": "Choose any. You do not need to explain why or show any document.",
      "need_interpreter": "Sign-language interpreter",
      "need_extra_time": "Extra time",
      "need_written_questions": "Written questions",
      "need_accessible_venue": "Accessible venue",
      "need_other": "Other",
      "accQ2": "Anything else the career helper should know? (optional)",
      "accQ3": "How should we send you a copy?",
      "copy_none": "No copy",
      "copy_telegram": "Telegram",
      "copy_sms": "Text message (SMS)",
      "copy_email": "Email",
      "accContact": "Phone number, Telegram username or email for the copy",
      "accReview": "Check your request",
      "accNeeds": "Support",
      "accNote": "Note",
      "accCopy": "Copy by",
      "accNext": "Next",
      "accBack": "Back",
      "accCancel": "Cancel",
      "accSend": "Send to a career helper",
      "accSent": "Sent. A career helper will contact you. Your request goes to a person, not to the employer.",
      "accFailed": "The request could not be sent now. Please try again, or press “Talk to a person”.",
      "accChooseOne": "Please choose at least one kind of support.",
      "accNeedContact": "Please enter where to send the copy, or choose “No copy”.",
      "accNone": "None",
      "contentUnavailable": "The course text could not be loaded, so I cannot search it right now. Check your connection and try again, or press “Talk to a person”.",
      "micDenied": "The microphone is blocked. Allow it in the browser's site settings, or type your question.",
      "shareFailed": "Screen sharing could not start in this browser. You can send a screenshot instead.",
      "screenshotFailed": "The screenshot could not be sent. Check your connection and try again.",
      "dataDeleteFailed": "Your conversation was deleted from this phone, but the server could not be reached. Please try “Delete my conversation” again when you are online.",
      "genericError": "Something went wrong on this page. Please try again. If it keeps happening, press “Talk to a person”.",
      "langBeta": "beta",
      "micRecording": "Recording. Press Stop when you finish.",
      "micTranscribing": "Turning your voice into text…",
      "micNeedsConsent": "Voice in this language needs an online service. Press “Online answers” to allow it, or type your question.",
      "micServerFailed": "I could not turn your voice into text. Please try again, or type your question."
    },
    "am": {
      "dir": "ltr",
      "speechLang": "am-ET",
      "title": "SYLY ረዳት",
      "resize": "የረዳቱን ፓነል መጠን ይቀይሩ። የግራና የቀኝ ቀስት ቁልፎችን፣ Home፣ End፣ ወይም ለመመለስ Enter ይጠቀሙ።",
      "launcher": "SYLYን ይጠይቁ",
      "close": "ዝጋ",
      "language": "ቋንቋ",
      "simpleMode": "ቀላል ቋንቋ",
      "onlineAnswers": "የመስመር ላይ መልሶች",
      "questionLabel": "ጥያቄዎ",
      "inlineLabel": "ስለዚህ ትምህርት ይጠይቁ",
      "questionHint": "Enter ይልካል። Shift እና Enter አዲስ መስመር ያክላሉ።",
      "send": "ላክ",
      "mic": "በድምፅ ይናገሩ",
      "micStop": "ቀረጻውን አቁም",
      "micListening": "እያዳመጥኩ ነው። አሁን ይናገሩ።",
      "micDone": "ጽሑፉን ያረጋግጡ፣ ከዚያ ላክን ይጫኑ።",
      "micUnsupported": "በዚህ ብራውዘር የድምፅ ግብዓት አይሰራም። እባክዎ ጥያቄዎን ይጻፉ።",
      "micError": "ድምፅዎን መስማት አልቻልኩም። እባክዎ እንደገና ይሞክሩ ወይም ይጻፉ።",
      "talk": "ከሰው ጋር ይነጋገሩ",
      "you": "እርስዎ",
      "assistant": "SYLY",
      "tutor": "አስጠኚ",
      "sources": "ምንጮች",
      "listen": "ያዳምጡ",
      "stopListening": "አቁም",
      "noVoice": "ለዚህ መልስ ድምፅ የለም። መልሱ በጽሑፍ ቀርቧል።",
      "fromSection": "ከ“{title}” ክፍል፦",
      "answeredLocal": "መልሱ ከትምህርቱ ጽሑፍ የተወሰደ ነው።",
      "answeredAi": "በAI ከትምህርቱ ጽሑፍ የተጻፈ። ምንጩን ያረጋግጡ።",
      "notFound": "ይህንን በትምህርቱ ውስጥ ማግኘት አልቻልኩም።",
      "notFoundOffer": "ሰው ሊረዳዎት ይችላል። “ከሰው ጋር ይነጋገሩ” የሚለውን ይጫኑ።",
      "noAdvice": "የሕክምና፣ የሕግ ወይም የኢሚግሬሽን ምክር መስጠት አልችልም። ሰው ሊረዳዎት ይችላል።",
      "emptyIntro": "ስለዚህ ትምህርት ጥያቄ ይጠይቁ። የምመልሰው ከትምህርቱ ብቻ ነው፤ እያንዳንዱ መልስ ከየት እንደመጣም አሳያለሁ።",
      "exampleAbout": "ስለ {title} ንገረኝ",
      "refresh": "አድስ",
      "refreshedPage": "ገጹ እንደገና ተነብቧል።",
      "refreshedChat": "ገጹ እንደገና ተነብቧል። አዲስ ውይይት ተጀምሯል።",
      "translateLabel": "ይህን መልስ በዚህ ቋንቋ አሳይ",
      "translating": "በመተርጎም ላይ…",
      "translatedNote": "በAI ከ{from} ተተርጉሟል። ዋናውን በምንጭ አገናኙ ይመልከቱ።",
      "translateFailed": "አሁን መተርጎም አልተቻለም። መልሱ በዋናው ቋንቋ ነው።",
      "translateNeedsConsent": "ለመተርጎም መጀመሪያ የመስመር ላይ መልሶችን ያብሩ።",
      "translateHint": "የመስመር ላይ መልሶች ጠፍተዋል፣ ስለዚህ መልሱ በራሱ ቋንቋ ነው። በ{language} ለማንበብ ያብሩዋቸው።",
      "noAnswerToTranslate": "ለመተርጎም መልስ የለም። መጀመሪያ ጥያቄ ይጠይቁ።",
      "examplesTitle": "ከእነዚህ አንዱን ይሞክሩ፦",
      "example1": "AI ምናባዊ ረዳቶችን ይተካል?",
      "example2": "ደንበኞች ምን ዓይነት ክህሎቶችን ያደንቃሉ?",
      "example3": "ምናባዊ ረዳት መሆን የሚፈልግ ሰው ምን ማድረግ አለበት?",
      "statusOnline": "መስመር ላይ",
      "statusOffline": "ከመስመር ውጭ፦ መልሶች ከተቀመጡ የትምህርት ማስታወሻዎች",
      "statusSending": "በመላክ ላይ…",
      "statusReady": "ዝግጁ",
      "queued": "በዚህ ስልክ ላይ ተቀምጧል። መስመር ላይ ሲሆኑ ይላካል።",
      "queuedSent": "የተቀመጠው መልእክትዎ ተልኳል።",
      "emptyQuestion": "እባክዎ መጀመሪያ ጥያቄ ይጻፉ።",
      "consentTitle": "ከመጀመራችን በፊት",
      "consentText": "ለመመለስ SYLY ጥያቄዎን ወደ የመስመር ላይ AI አገልግሎት ሊልክ ይችላል። ስለ እርስዎ ማንነት ምንም አይላክም።",
      "consentAllow": "የመስመር ላይ መልሶችን ፍቀድ",
      "consentDeny": "ከዚህ ገጽ ብቻ መልሶችን ተጠቀም",
      "consentWhat": "ምን ይላካል?",
      "consentDetails": "ጥያቄዎ እና ከእሱ ጋር የሚዛመዱት የትምህርት ክፍሎች ብቻ። ስም፣ ስልክ ቁጥር ወይም መለያ አይላክም። ይህን ምርጫ ከላይ ባለው “የመስመር ላይ መልሶች” ቁልፍ መቀየር ይችላሉ።",
      "escalating": "በማገናኘት ላይ…",
      "escalatedOnline": "አስጠኚ እየመጣ ነው። በዚህ ገጽ ላይ ይቆዩ፤ መልሳቸው እዚህ ይታያል።",
      "escalatedLater": "አስጠኚ እዚህ ይመልሳል። እስከ ጠዋት ሊወስድ ይችላል።",
      "escalateQueued": "ሰው ለማግኘት ያቀረቡት ጥያቄ በዚህ ስልክ ላይ ተቀምጧል። መስመር ላይ ሲሆኑ ይላካል።",
      "ticketNumber": "የጥያቄ ቁጥር፦ {id}",
      "tutorJoined": "ሰው ተቀላቅሏል፦ {name}",
      "skipLink": "ወደ ረዳቱ ይዝለሉ",
      "langName_am": "አማርኛ",
      "langName_en": "English",
      "langName_ar": "العربية",
      "noVoiceAm": "የአማርኛ ድምፅ የለም። መልሱ በጽሑፍ ቀርቧል።",
      "telegramOption": "የአስጠኚውን መልስ በቴሌግራምም ያግኙ",
      "shareScreen": "ስክሪኔን አጋራ",
      "shareStop": "ማጋራት አቁም (Esc)",
      "sharing": "ስክሪንዎን ለአስጠኚው እያጋሩ ነው።",
      "shareStopped": "ስክሪን ማጋራት ቆሟል።",
      "shareAsked": "አስጠኚው ስክሪንዎን ማየት ይፈልጋል። እርስዎ ይምረጡ፦ ስክሪንዎን ያጋሩ ወይም የስክሪን ምስል ይላኩ።",
      "sendScreenshot": "የስክሪን ምስል ላክ",
      "screenshotSent": "የስክሪን ምስሉ ለአስጠኚው ተልኳል።",
      "screenshotTooBig": "ይህ ምስል በጣም ትልቅ ነው። እባክዎ አነስ ያለ የስክሪን ምስል ይምረጡ።",
      "yourData": "የእርስዎ መረጃ",
      "exportData": "መረጃዬን አውርድ",
      "deleteData": "ውይይቴን ሰርዝ",
      "dataDeleted": "ውይይትዎ ከዚህ ስልክ እና ከሰርቨሩ ተሰርዟል።",
      "dataNote": "ትምህርቱን ለማሻሻል ጥያቄዎችዎን ያለ ስምዎ እናስቀምጣለን። እዚህ ማውረድ ወይም መሰረዝ ይችላሉ።",
      "jobTrust": "በአሠሪው የራሱ ድረ-ገጽ ላይ ያረጋግጡ። ለማመልከት ፈጽሞ ገንዘብ አይክፈሉ።",
      "jobDeadline": "እስከ {date} ድረስ ያመልክቱ።",
      "jobDeadlinePassed": "የዚህ ሥራ የማመልከቻ ጊዜ አልፏል ({date})።",
      "jobAsk": "ስለዚህ ሥራ ንገረኝ፦ {title}",
      "alertsHow": "እንደዚህ ያሉ ሥራዎች ማሳወቂያ ለማግኘት “/alerts {keyword}” ወደ ቴሌግራም ቦታችን ይላኩ፣ ወይም “ALERT {keyword}” በጽሑፍ መልእክት ይላኩ። ለማቆም በማንኛውም ጊዜ STOP ይላኩ።",
      "openTelegram": "የቴሌግራም ቦቱን ክፈት",
      "accTitle": "የቃለ መጠይቅ ድጋፍ ጥያቄ",
      "accFor": "ለሥራው፦ {title}",
      "accStep": "ደረጃ {n} ከ{total}",
      "accQ1": "ምን ዓይነት ድጋፍ ያስፈልግዎታል?",
      "accHint1": "የፈለጉትን ይምረጡ። ምክንያት ማስረዳት ወይም ሰነድ ማሳየት አያስፈልግዎትም።",
      "need_interpreter": "የምልክት ቋንቋ አስተርጓሚ",
      "need_extra_time": "ተጨማሪ ጊዜ",
      "need_written_questions": "በጽሑፍ የሚቀርቡ ጥያቄዎች",
      "need_accessible_venue": "ተደራሽ ቦታ",
      "need_other": "ሌላ",
      "accQ2": "የሙያ ረዳቱ ማወቅ ያለበት ሌላ ነገር አለ? (አማራጭ)",
      "accQ3": "ቅጂውን እንዴት እንላክልዎ?",
      "copy_none": "ቅጂ አያስፈልግም",
      "copy_telegram": "ቴሌግራም",
      "copy_sms": "የጽሑፍ መልእክት (SMS)",
      "copy_email": "ኢሜል",
      "accContact": "ለቅጂው ስልክ ቁጥር፣ የቴሌግራም ስም ወይም ኢሜል",
      "accReview": "ጥያቄዎን ያረጋግጡ",
      "accNeeds": "ድጋፍ",
      "accNote": "ማስታወሻ",
      "accCopy": "ቅጂ በ",
      "accNext": "ቀጣይ",
      "accBack": "ተመለስ",
      "accCancel": "ሰርዝ",
      "accSend": "ለሙያ ረዳት ላክ",
      "accSent": "ተልኳል። የሙያ ረዳት ያገኝዎታል። ጥያቄዎ የሚሄደው ለሰው ነው፤ ለአሠሪው አይደለም።",
      "accFailed": "ጥያቄው አሁን ሊላክ አልቻለም። እባክዎ እንደገና ይሞክሩ፣ ወይም “ከሰው ጋር ይነጋገሩ” የሚለውን ይጫኑ።",
      "accChooseOne": "እባክዎ ቢያንስ አንድ ዓይነት ድጋፍ ይምረጡ።",
      "accNeedContact": "እባክዎ ቅጂው የሚላክበትን ያስገቡ፣ ወይም “ቅጂ አያስፈልግም” የሚለውን ይምረጡ።",
      "accNone": "የለም",
      "contentUnavailable": "የትምህርቱ ጽሑፍ ሊጫን አልቻለም፤ ስለዚህ አሁን መፈለግ አልችልም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ፣ ወይም “ከሰው ጋር ይነጋገሩ” የሚለውን ይጫኑ።",
      "micDenied": "ማይክሮፎኑ ታግዷል። በብራውዘሩ የድረ-ገጽ ቅንብሮች ውስጥ ይፍቀዱት፣ ወይም ጥያቄዎን ይጻፉ።",
      "shareFailed": "በዚህ ብራውዘር ስክሪን ማጋራት መጀመር አልተቻለም። በምትኩ የስክሪን ምስል መላክ ይችላሉ።",
      "screenshotFailed": "የስክሪን ምስሉ ሊላክ አልቻለም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።",
      "dataDeleteFailed": "ውይይትዎ ከዚህ ስልክ ተሰርዟል፤ ነገር ግን ሰርቨሩን ማግኘት አልተቻለም። መስመር ላይ ሲሆኑ “ውይይቴን ሰርዝ”ን እንደገና ይሞክሩ።",
      "genericError": "በዚህ ገጽ ላይ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ። ችግሩ ከቀጠለ “ከሰው ጋር ይነጋገሩ” የሚለውን ይጫኑ።",
      "langBeta": "ሙከራ",
      "micRecording": "በመቅዳት ላይ። ሲጨርሱ «ቀረጻውን አቁም» ይጫኑ።",
      "micTranscribing": "ድምፅዎን ወደ ጽሑፍ በመቀየር ላይ…",
      "micNeedsConsent": "በዚህ ቋንቋ የድምፅ ግብዓት የመስመር ላይ አገልግሎት ይፈልጋል። ለመፍቀድ «የመስመር ላይ መልሶች»ን ይጫኑ፣ ወይም ጥያቄዎን ይጻፉ።",
      "micServerFailed": "ድምፅዎን ወደ ጽሑፍ መቀየር አልቻልኩም። እባክዎ እንደገና ይሞክሩ፣ ወይም ጥያቄዎን ይጻፉ።"
    },
    "ar": {
      "dir": "rtl",
      "speechLang": "ar-SA",
      "title": "مساعد SYLY",
      "resize": "غيّر حجم لوحة المساعد. استخدم مفتاحي السهم الأيسر والأيمن أو Home أو End أو Enter للإعادة.",
      "launcher": "اسأل SYLY",
      "close": "إغلاق",
      "language": "اللغة",
      "simpleMode": "الوضع المبسّط",
      "onlineAnswers": "الإجابات عبر الإنترنت",
      "questionLabel": "سؤالك",
      "inlineLabel": "اسأل عن هذا الدرس",
      "questionHint": "زر Enter يرسل. Shift مع Enter يضيف سطرًا جديدًا.",
      "send": "إرسال",
      "mic": "تحدّث",
      "micStop": "إيقاف التسجيل",
      "micListening": "أستمع إليك. تحدّث الآن.",
      "micDone": "راجع النص، ثم اضغط إرسال.",
      "micUnsupported": "الإدخال الصوتي لا يعمل في هذا المتصفح. يرجى كتابة سؤالك.",
      "micError": "لم أتمكن من سماعك. حاول مرة أخرى أو اكتب.",
      "talk": "تحدّث مع شخص",
      "you": "أنت",
      "assistant": "SYLY",
      "tutor": "المعلّم",
      "sources": "المصادر",
      "listen": "استمع",
      "stopListening": "إيقاف",
      "noVoice": "لا يتوفر صوت لهذه الإجابة. الإجابة معروضة كنص.",
      "fromSection": "من قسم «{title}»:",
      "answeredLocal": "الإجابة مأخوذة من نص الدورة.",
      "answeredAi": "كتبها الذكاء الاصطناعي من نص الدورة. تحقّق من المصدر.",
      "notFound": "لم أجد هذا في الدورة.",
      "notFoundOffer": "يمكن لشخص أن يساعدك. اضغط «تحدّث مع شخص».",
      "noAdvice": "لا أستطيع تقديم نصائح طبية أو قانونية أو متعلقة بالهجرة. يمكن لشخص أن يساعدك.",
      "emptyIntro": "اطرح سؤالًا عن هذا الدرس. أجيب من الدورة فقط وأبيّن مصدر كل إجابة.",
      "exampleAbout": "أخبرني عن {title}",
      "refresh": "تحديث",
      "refreshedPage": "أُعيدت قراءة الصفحة.",
      "refreshedChat": "أُعيدت قراءة الصفحة وبدأت محادثة جديدة.",
      "translateLabel": "اعرض هذه الإجابة بلغة",
      "translating": "جارٍ الترجمة…",
      "translatedNote": "ترجمها الذكاء الاصطناعي من {from}. راجع الأصل عبر رابط المصدر.",
      "translateFailed": "تعذرت الترجمة الآن. تظهر الإجابة بلغتها الأصلية.",
      "translateNeedsConsent": "للترجمة، شغّل الإجابات عبر الإنترنت أولاً.",
      "translateHint": "الإجابات عبر الإنترنت متوقفة، لذلك تبقى هذه الإجابة بلغتها. شغّلها لقراءتها بـ{language}.",
      "noAnswerToTranslate": "لا توجد إجابة للترجمة بعد. اطرح سؤالاً أولاً.",
      "examplesTitle": "جرّب أحد هذه الأسئلة:",
      "example1": "هل سيحل الذكاء الاصطناعي محل المساعدين الافتراضيين؟",
      "example2": "ما المهارات التي سيقدّرها العملاء؟",
      "example3": "ماذا يجب أن يفعل من يريد أن يصبح مساعدًا افتراضيًا؟",
      "statusOnline": "متصل",
      "statusOffline": "غير متصل: الإجابات من ملاحظات الدورة المحفوظة",
      "statusSending": "جارٍ الإرسال…",
      "statusReady": "جاهز",
      "queued": "حُفظت على هذا الهاتف. ستُرسل عندما تكون متصلًا.",
      "queuedSent": "أُرسلت رسالتك المحفوظة.",
      "emptyQuestion": "يرجى كتابة سؤال أولًا.",
      "consentTitle": "قبل أن نبدأ",
      "consentText": "للإجابة، يمكن لـ SYLY إرسال سؤالك إلى خدمة ذكاء اصطناعي عبر الإنترنت. لا يُرسل أي شيء عن هويتك.",
      "consentAllow": "السماح بالإجابات عبر الإنترنت",
      "consentDeny": "استخدام الإجابات من هذه الصفحة فقط",
      "consentWhat": "ما الذي يُرسل؟",
      "consentDetails": "سؤالك وأقسام الدورة المطابقة له فقط. لا يُرسل اسم ولا رقم هاتف ولا حساب. يمكنك تغيير هذا الاختيار بزر «الإجابات عبر الإنترنت» في الأعلى.",
      "escalating": "جارٍ الاتصال…",
      "escalatedOnline": "معلّم في الطريق. ابقَ في هذه الصفحة؛ سيظهر رده هنا.",
      "escalatedLater": "سيجيب معلّم هنا. قد يستغرق ذلك حتى الصباح.",
      "escalateQueued": "حُفظ طلبك للتحدث مع شخص على هذا الهاتف. سيُرسل عندما تكون متصلًا.",
      "ticketNumber": "رقم الطلب: {id}",
      "tutorJoined": "انضم شخص: {name}",
      "skipLink": "انتقل إلى المساعد",
      "langName_am": "አማርኛ",
      "langName_en": "English",
      "langName_ar": "العربية",
      "noVoiceAm": "لا يتوفر صوت باللغة الأمهرية. الإجابة معروضة كنص.",
      "telegramOption": "استلم رد المعلّم على تيليجرام أيضًا",
      "shareScreen": "مشاركة شاشتي",
      "shareStop": "إيقاف المشاركة (Esc)",
      "sharing": "أنت تشارك شاشتك مع المعلّم.",
      "shareStopped": "توقفت مشاركة الشاشة.",
      "shareAsked": "يطلب المعلّم رؤية شاشتك. أنت تختار: شارك الشاشة أو أرسل لقطة شاشة.",
      "sendScreenshot": "إرسال لقطة شاشة",
      "screenshotSent": "أُرسلت لقطة الشاشة إلى المعلّم.",
      "screenshotTooBig": "هذه الصورة كبيرة جدًا. يرجى اختيار لقطة شاشة أصغر.",
      "yourData": "بياناتك",
      "exportData": "تنزيل بياناتي",
      "deleteData": "حذف محادثتي",
      "dataDeleted": "حُذفت محادثتك من هذا الهاتف ومن الخادم.",
      "dataNote": "نحتفظ بأسئلتك دون اسمك لتحسين الدورة. يمكنك تنزيلها أو حذفها هنا.",
      "jobTrust": "تحقّق من الموقع الرسمي لصاحب العمل. لا تدفع أبدًا مقابل التقديم.",
      "jobDeadline": "قدّم قبل {date}.",
      "jobDeadlinePassed": "انتهى موعد التقديم لهذه الوظيفة ({date}).",
      "jobAsk": "أخبرني عن هذه الوظيفة: {title}",
      "alertsHow": "لتلقي تنبيهات بوظائف مشابهة، أرسل «/alerts {keyword}» إلى بوت تيليجرام الخاص بنا، أو أرسل رسالة نصية «ALERT {keyword}». أرسل STOP في أي وقت للإيقاف.",
      "openTelegram": "فتح بوت تيليجرام",
      "accTitle": "طلب دعم للمقابلة",
      "accFor": "للوظيفة: {title}",
      "accStep": "الخطوة {n} من {total}",
      "accQ1": "ما الدعم الذي تحتاجه؟",
      "accHint1": "اختر ما تشاء. لا تحتاج إلى شرح السبب أو تقديم أي مستند.",
      "need_interpreter": "مترجم لغة الإشارة",
      "need_extra_time": "وقت إضافي",
      "need_written_questions": "أسئلة مكتوبة",
      "need_accessible_venue": "مكان يسهل الوصول إليه",
      "need_other": "غير ذلك",
      "accQ2": "هل هناك شيء آخر يجب أن يعرفه المساعد المهني؟ (اختياري)",
      "accQ3": "كيف نرسل لك نسخة؟",
      "copy_none": "بدون نسخة",
      "copy_telegram": "تيليجرام",
      "copy_sms": "رسالة نصية (SMS)",
      "copy_email": "البريد الإلكتروني",
      "accContact": "رقم الهاتف أو اسم مستخدم تيليجرام أو البريد الإلكتروني للنسخة",
      "accReview": "راجع طلبك",
      "accNeeds": "الدعم",
      "accNote": "ملاحظة",
      "accCopy": "النسخة عبر",
      "accNext": "التالي",
      "accBack": "رجوع",
      "accCancel": "إلغاء",
      "accSend": "إرسال إلى مساعد مهني",
      "accSent": "تم الإرسال. سيتواصل معك مساعد مهني. يذهب طلبك إلى شخص، وليس إلى صاحب العمل.",
      "accFailed": "تعذّر إرسال الطلب الآن. حاول مرة أخرى، أو اضغط «تحدّث مع شخص».",
      "accChooseOne": "يرجى اختيار نوع واحد من الدعم على الأقل.",
      "accNeedContact": "يرجى إدخال مكان إرسال النسخة، أو اختيار «بدون نسخة».",
      "accNone": "لا شيء",
      "contentUnavailable": "تعذّر تحميل نص الدورة، لذا لا أستطيع البحث فيه الآن. تحقّق من اتصالك وحاول مرة أخرى، أو اضغط «تحدّث مع شخص».",
      "micDenied": "الميكروفون محظور. اسمح به من إعدادات الموقع في المتصفح، أو اكتب سؤالك.",
      "shareFailed": "تعذّر بدء مشاركة الشاشة في هذا المتصفح. يمكنك إرسال لقطة شاشة بدلًا من ذلك.",
      "screenshotFailed": "تعذّر إرسال لقطة الشاشة. تحقّق من اتصالك وحاول مرة أخرى.",
      "dataDeleteFailed": "حُذفت محادثتك من هذا الهاتف، لكن تعذّر الوصول إلى الخادم. حاول «حذف محادثتي» مرة أخرى عندما تكون متصلًا.",
      "genericError": "حدث خطأ في هذه الصفحة. يرجى المحاولة مرة أخرى. إذا تكرر ذلك، اضغط «تحدّث مع شخص».",
      "langBeta": "تجريبي",
      "micRecording": "جارٍ التسجيل. اضغط «إيقاف التسجيل» عند الانتهاء.",
      "micTranscribing": "جارٍ تحويل صوتك إلى نص…",
      "micNeedsConsent": "الإدخال الصوتي بهذه اللغة يحتاج إلى خدمة عبر الإنترنت. اضغط «الإجابات عبر الإنترنت» للسماح بذلك، أو اكتب سؤالك.",
      "micServerFailed": "لم أستطع تحويل صوتك إلى نص. حاول مرة أخرى، أو اكتب سؤالك."
    }
  };
  /* I18N:END */

  /* ICONS:BEGIN */
  // Lucide 0.460.0 (ISC licence, https://lucide.dev), copied by scripts/sync-icons.mjs.
  var ICONS = {
    "close": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
    "refresh": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />",
    "language": "<path d=\"m5 8 6 6\" /><path d=\"m4 14 6-6 2-3\" /><path d=\"M2 5h12\" /><path d=\"M7 2h1\" /><path d=\"m22 22-5-10-5 10\" /><path d=\"M14 18h6\" />",
    "simple": "<path d=\"M17 6.1H3\" /><path d=\"M21 12.1H3\" /><path d=\"M15.1 18H3\" />",
    "online": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /><path d=\"M2 12h20\" />",
    "data": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"m9 12 2 2 4-4\" />",
    "send": "<path d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\" /><path d=\"m21.854 2.147-10.94 10.939\" />",
    "mic": "<path d=\"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z\" /><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\" /><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\" />",
    "stop": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />",
    "talk": "<path d=\"M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z\" /><path d=\"M21 16v2a4 4 0 0 1-4 4h-5\" />",
    "listen": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><path d=\"M16 9a5 5 0 0 1 0 6\" /><path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\" />",
    "sources": "<path d=\"M12 7v14\" /><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\" />",
    "share": "<path d=\"M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3\" /><path d=\"M8 21h8\" /><path d=\"M12 17v4\" /><path d=\"m17 8 5-5\" /><path d=\"M17 3h5v5\" />",
    "shareOff": "<path d=\"M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3\" /><path d=\"M8 21h8\" /><path d=\"M12 17v4\" /><path d=\"m22 3-5 5\" /><path d=\"m17 3 5 5\" />",
    "screenshot": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" /><circle cx=\"9\" cy=\"9\" r=\"2\" /><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />",
    "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><polyline points=\"7 10 12 15 17 10\" /><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
    "trash": "<path d=\"M3 6h18\" /><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
    "next": "<path d=\"M5 12h14\" /><path d=\"m12 5 7 7-7 7\" />",
    "back": "<path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" />",
    "check": "<path d=\"M20 6 9 17l-5-5\" />",
    "bot": "<path d=\"M12 8V4H8\" /><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\" /><path d=\"M2 14h2\" /><path d=\"M20 14h2\" /><path d=\"M15 13v2\" /><path d=\"M9 13v2\" />",
    "you": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /><circle cx=\"12\" cy=\"7\" r=\"4\" />",
    "tutor": "<path d=\"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z\" /><path d=\"M22 10v6\" /><path d=\"M6 12.5V16a6 3 0 0 0 12 0v-3.5\" />",
    "job": "<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\" /><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\" />",
    "ai": "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\" /><path d=\"M20 3v4\" /><path d=\"M22 5h-4\" /><path d=\"M4 17v2\" /><path d=\"M5 18H3\" />",
    "telegram": "<path d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\" /><path d=\"m21.854 2.147-10.94 10.939\" />",
    "consent": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"m9 12 2 2 4-4\" />"
  };
  /* ICONS:END */

  /* ------------------------------------------------------------------ util */
  // Wraps every UI handler: an unexpected error is logged for developers and shown to the
  // learner in words (the element listens for "dba-error" and shows genericError).
  function safe(fn) {
    return function (e) {
      try { return fn.apply(this, arguments); } catch (err) {
        if (window.console) console.error('[db-assistant]', err);
        var target = (e && e.currentTarget) || this;
        if (target && target.dispatchEvent) target.dispatchEvent(new CustomEvent('dba-error', { bubbles: true }));
      }
    };
  }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), safe(v));
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  // Decorative Lucide icon: always next to visible text, hidden from screen readers.
  function icon(name, extra) {
    var t = document.createElement('span');
    t.innerHTML = '<svg class="icon' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
    return t.firstChild;
  }
  // Decorative emoji: aria-hidden so screen readers do not read "light bulb" in the middle of Amharic.
  // A section link like "/pages/x.html#y" belongs to the site that served the content (or the API),
  // not to the page that embeds the widget. Same-site links stay relative so focus handling works.
  function absUrl(u, base) {
    if (!u || !base) return u;
    try {
      var abs = new URL(u, base);
      return abs.origin === location.origin ? abs.pathname + abs.search + abs.hash : abs.href;
    } catch (e) { return u; }
  }
  function logoEl() { var t = document.createElement('span'); t.innerHTML = LOGO; return t.firstChild; }
  function emoji(ch) { return h('span', { class: 'emoji', 'aria-hidden': 'true', text: ch }); }
  // Button content = icon + text span (the span carries data-t so language changes keep the icon).
  function iconText(name, attrs, extra) { return [icon(name, extra), h('span', attrs)]; }
  function fmt(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }
  function load(key, fallback) {
    try { var v = localStorage.getItem(STORE + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch (e) { /* private mode: keep in memory */ }
  }
  /* "reply in Amharic", "translate to Arabic", በአማርኛ መልስ, ترجم إلى العربية ...: the learner names the language of the reply.
     Returns { lang, text, only } or null. text = the question without the instruction; only = nothing else was asked. */
  var REQ_NAME_EN = '(amharic|english|arabic|afaan oromo|oromo|oromiffa|tigrinya|tigrigna|somali)';
  var REQ_CODE = { amharic: 'am', english: 'en', arabic: 'ar', 'afaan oromo': 'om', oromo: 'om', oromiffa: 'om', tigrinya: 'ti', tigrigna: 'ti', somali: 'so',
    'አማርኛ': 'am', 'እንግሊዝኛ': 'en', 'አረብኛ': 'ar', 'ኦሮምኛ': 'om', 'ትግርኛ': 'ti', 'ሶማሊኛ': 'so',
    'الأمهرية': 'am', 'الامهرية': 'am', 'العربية': 'ar', 'الإنجليزية': 'en', 'الانجليزية': 'en',
    'الأورومية': 'om', 'التغرينية': 'ti', 'الصومالية': 'so' };
  var REQ_AM = '(አማርኛ|እንግሊዝኛ|አረብኛ|ኦሮምኛ|ትግርኛ|ሶማሊኛ)';
  var REQ_AR = '(الأمهرية|الامهرية|العربية|الإنجليزية|الانجليزية|الأورومية|التغرينية|الصومالية)';
  function parseLangRequest(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    var m, lang = null, rest = null;
    // a bare language name: "in Amharic", "Amharic please"
    m = new RegExp('^(?:please\\s+)?(?:in\\s+|to\\s+)?' + REQ_NAME_EN + '(?:\\s+(?:please|language))?[\\s.!?]*$', 'i').exec(s);
    if (m) return { lang: REQ_CODE[m[1].toLowerCase()], text: '', only: true };
    // English: "... in Amharic", with a verb before it or a comma / the start of the message
    m = new RegExp('(^|[\\s,;:])(?:in|into|to)\\s+' + REQ_NAME_EN + '(?:\\s+(?:please|language))?(?=[\\s.,;:!?]|$)', 'i').exec(s);
    if (m) {
      var before = s.slice(0, m.index);
      if (!before.trim() || /[,;:]\s*$/.test(before) || /\b(reply|respond|answer|say|write|explain|tell|speak|translate|give|show|describe|summari[sz]e|list)\b/i.test(before)) {
        lang = REQ_CODE[m[2].toLowerCase()];
        rest = (before + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
      }
    }
    // Amharic: በአማርኛ መልስ / ወደ አማርኛ ተርጉም
    if (!lang) {
      m = new RegExp('(?:በ|ወደ\\s*)' + REQ_AM + '(?:\\s*(?:መልስ|ተርጉም|ንገር|አስረዳ|ጻፍ|አቅርብ)\\S*)?').exec(s);
      if (m) { lang = REQ_CODE[m[1]]; rest = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
    }
    // Arabic: بالعربية / أجب بالعربية / ترجم إلى العربية
    if (!lang) {
      m = new RegExp('(?:(?:أجب|رد|اشرح|ترجم|قل|اكتب)\\S*\\s+)?(?:ب|إلى\\s+|الى\\s+)' + REQ_AR).exec(s);
      if (m) { lang = REQ_CODE[m[1]]; rest = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
    }
    if (!lang) return null;
    // drop a leading or trailing instruction verb that is left over ("... Reply", "Please answer, ...")
    rest = rest.replace(/^(?:please\s*[,:]?\s*)?(?:reply|respond|answer|translate(?: this| it| that)?|say(?: it)?)\s*(?:me|us)?\s*[,:]?\s*(?=\S)/i, '')
      .replace(/[\s,;:.-]*\b(?:please\s+)?(?:reply|respond|answer|say it|write|explain|translate(?: this| it| that)?|tell me|give me|show me|speak)\s*[.!?]*$/i, '')
      .replace(/^[\s,;:.-]+|[\s,;:-]+$/g, '').trim();
    var core = rest.replace(/\b(please|reply|respond|answer|say|write|explain|translate|tell|give|show|speak|me|us|it|this|that|again|back|the|your|in|into|to)\b/ig, ' ').replace(/[^\p{L}\p{N}]+/gu, '');
    return { lang: lang, text: core === '' ? '' : rest, only: core === '' };
  }

  // After a source link scrolls to a section, tint that section for about 3 seconds with a heartbeat (two soft beats a
  // second, so nothing flashes more than 3 times a second). Uses the Web Animations API: nothing is added to the host
  // page's markup or styles, and the tint is gone by itself. With reduced motion the tint stays steady instead of pulsing.
  function sectionElements(heading, target) {
    var box = target && target !== heading && target.contains(heading) && /^(ARTICLE|SECTION|LI)$/.test(target.tagName) ? target : null;
    if (box) return [box];
    var rank = Number(heading.tagName.slice(1)) || 6, out = [heading], n = heading.nextElementSibling;
    while (n && out.length < 14 && !(/^H[1-6]$/.test(n.tagName) && Number(n.tagName.slice(1)) <= rank)) { out.push(n); n = n.nextElementSibling; }
    return out;
  }
  function flashSection(heading, target) {
    if (!heading.animate) return;
    var amber = '245, 163, 0', still = reducedMotion();
    var frames = still
      ? [{ backgroundColor: 'rgba(' + amber + ',0.35)' }, { backgroundColor: 'rgba(' + amber + ',0.35)', offset: 0.85 }, { backgroundColor: 'rgba(' + amber + ',0)' }]
      : [{ backgroundColor: 'rgba(' + amber + ',0)', boxShadow: '0 0 0 0 rgba(' + amber + ',0)' },
         { backgroundColor: 'rgba(' + amber + ',0.55)', boxShadow: '0 0 0 6px rgba(' + amber + ',0.35)', offset: 0.14 },
         { backgroundColor: 'rgba(' + amber + ',0.18)', boxShadow: '0 0 0 2px rgba(' + amber + ',0.15)', offset: 0.28 },
         { backgroundColor: 'rgba(' + amber + ',0.45)', boxShadow: '0 0 0 5px rgba(' + amber + ',0.3)', offset: 0.42 },
         { backgroundColor: 'rgba(' + amber + ',0)', boxShadow: '0 0 0 0 rgba(' + amber + ',0)' }];
    sectionElements(heading, target).forEach(function (el) {
      try { el.animate(frames, { duration: still ? 3000 : 1000, iterations: still ? 1 : 3, delay: 350, easing: 'ease-in-out' }); } catch (err) { /* old browser: no tint */ }
    });
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function reducedMotion() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  // Colour contrast (WCAG relative luminance), used for the host's --bs-primary (NFR-A5).
  function parseColor(str) {
    str = (str || '').trim().toLowerCase();
    var m = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
      var x = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      return [0, 2, 4].map(function (i) { return parseInt(x.substr(i, 2), 16); });
    }
    m = str.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
    if (m && (m[4] === undefined || parseFloat(m[4]) >= (m[4].indexOf('%') > 0 ? 100 : 1))) {
      return [+m[1], +m[2], +m[3]];
    }
    return null;
  }
  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /* ---------------------------------------------------------------- search */
  // Same algorithm as api/services/retrieval.py (SDS 1.5). Keep them in step.
  var EN_STOP = new Set(('a an and are as at be been but by can could did do does for from had has have how i if in ' +
    'into is it its me my of on or our so that the their them then there these they this to too us was we were what ' +
    'when where which who why will with would you your about more most than also just not no yes any some much many ' +
    'should shall may might must going get gets').split(' '));
  var AM_STOP = new Set(('ነው ናቸው ነበር ምን ምንድን ምንድነው ምንድናቸው እንዴት ለምን የት መቼ ማን ይህ ያ እነዚህ እና ወይም ግን ላይ ውስጥ ' +
    'ጋር ስለ አለ አለበት አሉ ይሆናል ነገር እኔ እርስዎ እኛ').split(' '));
  // Topics the assistant must not advise on (FR-T6). Data, not UI sentences.
  var NO_ADVICE = /\b(visa|immigration|asylum|refugee status|lawyer|lawsuit|legal advice|court|medicine|medical|doctor|diagnos\w*|prescription|symptom\w*)\b|ቪዛ|ኢሚግሬሽን|ስደተኛ ፈቃድ|ጠበቃ|ፍርድ ቤት|ሐኪም|ሀኪም|መድኃኒት|መድሃኒት|ሕክምና|ህክምና|تأشيرة|هجرة|لجوء|محام|محكمة|طبيب|دواء|علاج/i;

  function ethiopicShare(s) {
    var eth = (s.match(/[ሀ-፿]/g) || []).length;
    var lat = (s.match(/[A-Za-z]/g) || []).length;
    return eth + lat ? eth / (eth + lat) : 0;
  }
  function detectLang(s, fallback) {
    if (/[؀-ۿ]/.test(s)) return 'ar';
    if (ethiopicShare(s) >= 0.5) return 'am';
    return /[A-Za-z]/.test(s) ? 'en' : fallback;
  }
  function stem(w) { return w.length <= 4 ? w : w.replace(/(ies|es|s|ed|ing|ly|e)$/, ''); }
  function wordsOf(s) { return (String(s || '').toLowerCase().normalize('NFC').match(/[\p{L}\p{N}]+/gu)) || []; }
  function tokensEn(s) {
    return wordsOf(s).filter(function (w) { return w.length > 1 && !EN_STOP.has(w); }).map(stem);
  }
  function wordsAm(s) {
    return wordsOf(s).filter(function (w) { return !AM_STOP.has(w); });
  }
  function grams(w) {
    if (w.length < 3) return [w];
    var out = [];
    for (var i = 0; i + 3 <= w.length; i++) out.push(w.substr(i, 3));
    return out;
  }
  function repeat(list, n) { var out = []; for (var i = 0; i < n; i++) out = out.concat(list); return out; }

  function Index(sections) {
    this.sections = sections;
    this.en = sections.map(function (s) {
      return [].concat(repeat(tokensEn(s.title_en), 2), tokensEn(s.text_en), repeat(tokensEn((s.keywords_en || []).join(' ')), 3));
    });
    this.avg = this.en.reduce(function (a, d) { return a + d.length; }, 0) / Math.max(1, this.en.length);
    this.df = {};
    var self = this;
    this.en.forEach(function (doc) { new Set(doc).forEach(function (t) { self.df[t] = (self.df[t] || 0) + 1; }); });
    this.am = sections.map(function (s) {
      var g = new Set();
      [].concat(wordsAm(s.title_am), wordsAm(s.text_am), wordsAm((s.keywords_am || []).join(' ')))
        .forEach(function (w) { grams(w).forEach(function (x) { g.add(x); }); });
      return g;
    });
    this.gdf = {};
    this.am.forEach(function (g) { g.forEach(function (x) { self.gdf[x] = (self.gdf[x] || 0) + 1; }); });
  }
  Index.prototype.scoreEn = function (q) {
    var N = this.sections.length, k1 = 1.2, b = 0.75, self = this;
    var terms = Array.from(new Set(tokensEn(q)));
    return this.en.map(function (doc) {
      var tf = {};
      doc.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      return terms.reduce(function (sum, t) {
        if (!tf[t]) return sum;
        var df = self.df[t] || 0;
        var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        return sum + idf * (tf[t] * (k1 + 1)) / (tf[t] + k1 * (1 - b + b * doc.length / self.avg));
      }, 0);
    });
  };
  Index.prototype.scoreAm = function (q) {
    var N = this.sections.length, self = this;
    var qg = new Set();
    wordsAm(q).filter(function (w) { return /[ሀ-፿]/.test(w); })
      .forEach(function (w) { grams(w).forEach(function (x) { qg.add(x); }); });
    var latin = new Set(wordsOf(q).filter(function (w) { return /^[a-z0-9]+$/.test(w); }));
    var ql = q.toLowerCase();
    var weights = {}, total = 0;
    qg.forEach(function (x) { var df = self.gdf[x] || 0; weights[x] = Math.log(1 + N / (df || 0.5)); total += weights[x]; });
    return this.am.map(function (g, i) {
      var hit = 0;
      qg.forEach(function (x) { if (g.has(x)) hit += weights[x]; });
      var score = total ? hit / total : 0;
      var bonus = 0;
      (self.sections[i].keywords_am || []).forEach(function (k) {
        k = String(k).toLowerCase();
        if (k.length >= 2 && (/^[a-z0-9]+$/.test(k) ? latin.has(k) : ql.indexOf(k) >= 0)) bonus += 0.15;
      });
      return score + Math.min(bonus, 0.45);
    });
  };
  // Returns { lang: 'am'|'en', ranked: [{section, score}], best, found }
  Index.prototype.search = function (q) {
    var lang = ethiopicShare(q) >= 0.5 ? 'am' : 'en';
    var scores = lang === 'am' ? this.scoreAm(q) : this.scoreEn(q);
    var ranked = this.sections.map(function (s, i) { return { section: s, score: scores[i] }; })
      .sort(function (a, b) { return b.score - a.score; });
    var best = ranked[0];
    return { lang: lang, ranked: ranked, best: best, found: !!best && best.score >= THRESHOLD[lang] };
  };
  function splitSentences(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?።])\s+/).filter(Boolean);
  }
  // The n sentences of a section that best match the question, kept in page order.
  // No match at all: the first n sentences (SDS 1.5 step 3).
  Index.prototype.excerpt = function (q, section, lang, n) {
    var parts = splitSentences(section['text_' + lang] || section.text_en);
    return this.excerptIndices(q, section, lang, n).map(function (i) { return parts[i]; }).join(' ');
  };
  // Indices of the n best-matching sentences in page order (pre-generated audio is per sentence).
  Index.prototype.excerptIndices = function (q, section, lang, n) {
    var parts = splitSentences(section['text_' + lang] || section.text_en);
    var scores;
    if (lang === 'am') {
      var qg = new Set();
      wordsAm(q).forEach(function (w) { grams(w).forEach(function (x) { qg.add(x); }); });
      scores = parts.map(function (p) {
        var g = new Set();
        wordsAm(p).forEach(function (w) { grams(w).forEach(function (x) { g.add(x); }); });
        var hit = 0;
        qg.forEach(function (x) { if (g.has(x)) hit += 1; });
        return hit;
      });
    } else {
      var terms = new Set(tokensEn(q)), N = this.sections.length, df = this.df;
      scores = parts.map(function (p) {
        return Array.from(new Set(tokensEn(p))).reduce(function (sum, t) {
          return terms.has(t) ? sum + Math.log(1 + (N + 0.5) / ((df[t] || 0) + 0.5)) : sum;
        }, 0);
      });
    }
    // Short heading-like lines ("AI fluency.") count less than full sentences.
    scores = scores.map(function (sc, i) { return wordsOf(parts[i]).length < 5 ? sc * 0.3 : sc; });
    var order = parts.map(function (p, i) { return i; }).filter(function (i) { return scores[i] > 0; })
      .sort(function (a, b) { return scores[b] - scores[a] || a - b; }).slice(0, n).sort(function (a, b) { return a - b; });
    if (!order.length) order = parts.slice(0, n).map(function (p, i) { return i; });
    return order;
  };

  /* ---------------------------------------------------------- page reading */
  // FR-AD4 (SDS 1.8): read the lesson already on screen, in the learner's own browser, as a
  // fallback content source. Read-only: never adds ids, classes or attributes to the host page.
  var PAGE_MAX_SECTIONS = 50, PAGE_MAX_CHARS = 4000, PAGE_MIN_CHARS = 40;
  var PAGE_SKIP = { NAV: 1, HEADER: 1, FOOTER: 1, ASIDE: 1, SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, FORM: 1, 'DB-ASSISTANT': 1 };
  var PAGE_BLOCK = /^(P|DIV|LI|UL|OL|DL|DT|DD|TABLE|TR|TD|TH|SECTION|ARTICLE|BLOCKQUOTE|PRE|FIGURE|FIGCAPTION|H4|H5|H6|BR|HR|MAIN)$/;

  // Root: content-selector, else the first of main, article, [role=main], else body.
  function pageRoot(doc, selector) {
    var r = null;
    if (selector) { try { r = doc.querySelector(selector); } catch (e) { r = null; } }
    return r || doc.querySelector('main') || doc.querySelector('article') || doc.querySelector('[role="main"]') || doc.body;
  }
  function pageSkipped(el, win) {
    if (PAGE_SKIP[el.tagName] || el.id === 'db-assistant-skip') return true;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
    try { return win.getComputedStyle(el).display === 'none'; } catch (e) { return false; }
  }
  // A text fragment for a heading without an id (Chrome/Edge/Safari support "#:~:text=").
  function textFragment(title) {
    var t = String(title || '').slice(0, 60);
    if (String(title).length > 60 && t.lastIndexOf(' ') > 20) t = t.slice(0, t.lastIndexOf(' '));
    return encodeURIComponent(t.trim()).replace(/-/g, '%2D').replace(/,/g, '%2C');
  }
  // Returns [{ id, title, text, url, lang, source: 'page' }] (SDS 1.8).
  function readPage(root, ctx) {
    var doc = ctx.doc, win = ctx.win, loc = ctx.loc;
    var norm = function (t) { return String(t || '').replace(/\s+/g, ' ').trim(); };
    var htmlLang = (doc.documentElement.getAttribute('lang') || '').toLowerCase();
    var langOf = function (el) { var a = el && el.closest ? el.closest('[lang]') : null; return ((a && a.getAttribute('lang')) || htmlLang || 'en').toLowerCase(); };
    var h1 = root.querySelector('h1') || doc.querySelector('h1');
    var pageTitle = norm(h1 && h1.textContent) || norm(doc.title) || loc.pathname;
    var sections = [];
    var cur = { title: pageTitle, heading: null, parts: [] };
    var push = function () {
      var text = norm(cur.parts.join('')).slice(0, PAGE_MAX_CHARS);
      if (text.length < PAGE_MIN_CHARS || sections.length >= PAGE_MAX_SECTIONS) return;
      var hd = cur.heading, id;
      if (hd && hd.id) id = hd.id; else id = hd ? 'page-section-' + (sections.length + 1) : 'page-intro';
      sections.push({
        id: id,
        title: cur.title,
        text: text,
        url: hd ? (hd.id ? loc.pathname + '#' + hd.id : loc.pathname + '#:~:text=' + textFragment(cur.title)) : loc.pathname,
        lang: langOf(hd || root),
        source: 'page'
      });
    };
    var walk = function (node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { cur.parts.push(c.nodeValue); continue; }
        if (c.nodeType !== 1 || pageSkipped(c, win)) continue;
        if (c.tagName === 'H1') { cur.parts.push(' '); continue; } // the h1 is the page title, not body text
        if (c.tagName === 'H2' || c.tagName === 'H3') {
          push();
          cur = { title: norm(c.textContent) || pageTitle, heading: c, parts: [] };
          continue;
        }
        walk(c);
        if (PAGE_BLOCK.test(c.tagName)) cur.parts.push(' ');
      }
    };
    walk(root);
    push();
    return sections;
  }
  // SDS 1.8 / FR-AD4 order: content file, then server sections for this page, then page reading.
  // server: 'none' (no api attribute) | 'unreachable' | 'hasSections' | 'noSections'
  function decidePageReading(mode, fileOk, server) {
    if (mode === 'off') return false;
    if (mode !== 'fallback') return true; // the default: read the page, unless the developer turned it off
    if (fileOk) return false; // "fallback": only when nothing else is available
    return server !== 'hasSections';
  }
  // A page section in the search index's bilingual shape (Amharic page text goes to the _am fields).
  function pageToIndex(sec) {
    var am = /^am/.test(sec.lang || '');
    return { id: sec.id, url: sec.url, source: 'page', type: 'page', lang: sec.lang,
      title_en: am ? '' : sec.title, text_en: am ? '' : sec.text, title_am: am ? sec.title : '', text_am: am ? sec.text : '',
      keywords_en: [], keywords_am: [] };
  }

  /* developer portal: <db-assistant site="pk_..">. Settings from GET /v1/sites/{key}/config fill in only the
     attributes the tag does not already have, so attributes written on the tag always win. */
  var SITE_ATTRS = [['lang', 'lang'], ['mode', 'mode'], ['position', 'position'], ['theme', 'theme'], ['primary', 'primary'],
    ['content', 'content'], ['content-selector', 'content_selector'], ['read-page', 'read_page']];
  function applySite(cfg, hasAttr) {
    var out = [];
    if (!cfg || typeof cfg !== 'object') return out;
    SITE_ATTRS.forEach(function (pair) {
      var v = cfg[pair[1]];
      if (typeof v === 'string' && v && !hasAttr(pair[0])) out.push([pair[0], v]);
    });
    return out;
  }

  /* voice input routes (FR-T7). The browser's own recognition (Chrome, free, needs the network) is used for the languages it
     handles; Afaan Oromo, Tigrinya and any language the browser refuses are recorded and sent to the server's speech-to-text
     (Addis AI, Gemini, Groq: POST /v1/voice/transcribe), which needs the learner's consent because audio leaves the phone. */
  var NATIVE_NAMES = { en: 'English', am: 'አማርኛ', ar: 'العربية', om: 'Afaan Oromoo', ti: 'ትግርኛ', so: 'Soomaali' };
  var BETA_LANGS = ['om', 'ti', 'so']; // interface text is a draft that needs a native reader check
  var BROWSER_STT = { en: 'en-US', am: 'am-ET', ar: 'ar-SA', so: 'so-SO' };
  var RECORD_MAX_MS = 30000;
  function micRoute(lang, hasBrowser, hasRecorder, hasApi) {
    if (hasBrowser && BROWSER_STT[lang]) return 'browser';
    if (hasRecorder && hasApi) return 'server';
    return 'none';
  }
  // Browser errors that mean "this browser cannot recognise this language or reach its service": use the server instead.
  function browserCannot(error) { return error === 'language-not-supported' || error === 'network' || error === 'service-not-allowed'; }

  /* --------------------------------------------------------------- styles */
  var CSS = [
    ':host{all:initial;display:block;font-family:var(--bs-body-font-family,system-ui),"Noto Sans Ethiopic","Noto Naskh Arabic",sans-serif;font-size:1rem;line-height:1.5;}',
    ':host([mode="panel"]),:host(:not([mode])){display:contents;}',
    '*{box-sizing:border-box;}',
    '[hidden]{display:none !important;}',
    '.root{--c-bg:#FFFFFF;--c-bg2:#F2F2F2;--c-text:#111111;--c-muted:#4A4A4A;--c-border:#767676;--c-btn-text:#FFFFFF;--c-focus:#F5A300;color:var(--c-text);font:inherit;}',
    '.root.dark{--c-bg:#1B1B1B;--c-bg2:#2A2A2A;--c-text:#F2F2F2;--c-muted:#CFCFCF;--c-border:#8C8C8C;--c-btn:#9CC9FF;--c-btn-text:#111111;}',
    '[lang|="am"]{line-height:1.7;letter-spacing:normal;text-transform:none;}',
    'button,select,textarea{font:inherit;color:inherit;}',
    ':focus-visible{outline:3px solid var(--c-focus);outline-offset:2px;box-shadow:0 0 0 2px var(--c-text);}',
    '.btn{min-height:2.75rem;min-width:2.75rem;padding:0.5rem 1rem;border-radius:0.5rem;border:2px solid var(--c-border);background:var(--c-bg);color:var(--c-text);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;font-size:1rem;text-align:center;}',
    '.btn.primary{background:var(--c-btn);border-color:var(--c-btn);color:var(--c-btn-text);font-weight:600;}',
    '.btn[aria-pressed="true"]{background:var(--c-text);color:var(--c-bg);border-color:var(--c-text);}',
    '.btn[aria-pressed="true"]::before{content:"✓";content:"✓" / "";}',
    '.btn svg,.icon{inline-size:1.25rem;block-size:1.25rem;flex:none;vertical-align:-0.2em;}',
    '[dir="rtl"] .icon.flip{transform:scaleX(-1);}',
    '.emoji{margin-inline-end:0.375rem;font-style:normal;}',
    '.who .icon{inline-size:1rem;block-size:1rem;}',
    '.sources h3,.note,.intro p,.consent h3,.form h3,.share p,details.data summary{display:flex;align-items:center;gap:0.375rem;flex-wrap:wrap;}',
    '.head h2{display:flex;align-items:center;gap:0.5rem;}',
    '.head h2 .icon{inline-size:1.5rem;block-size:1.5rem;}',
    '.logo{inline-size:1.75rem;block-size:1.75rem;flex:none;}',
    '.lg-a{fill:var(--logo-a,#000000);}.lg-b{fill:var(--logo-b,#FFFFFF);}.lg-bars{fill:none;stroke:var(--logo-a,#000000);stroke-width:12;stroke-linecap:round;}',
    '.head{--logo-a:var(--c-text);--logo-b:var(--c-bg);}',
    '.launcher{--logo-a:#FFFFFF;--logo-b:var(--c-btn);}',
    '.launcher .logo{inline-size:1.75rem;block-size:1.75rem;}',
    '.launcher{position:fixed;inset-inline-end:0;inset-block-start:50%;transform:translateY(-50%);z-index:2147483000;border-radius:999px;border-start-end-radius:0;border-end-end-radius:0;border:2px solid #FFFFFF;border-inline-end:0;background:var(--c-btn);color:var(--c-btn-text);font-weight:600;padding:0.5rem 1rem;box-shadow:0 0.125rem 0.5rem rgba(0,0,0,0.35);}',
    '.root.pos-start .launcher{inset-inline-end:auto;inset-inline-start:0;border-radius:999px;border-start-start-radius:0;border-end-start-radius:0;border-inline-end:2px solid #FFFFFF;border-inline-start:0;}',
    '.root.pos-start dialog.panel{inset-inline-end:auto;inset-inline-start:0;border-inline-start:0;border-inline-end:1px solid var(--c-border);}',
    'dialog.panel{position:fixed;inset-block:0;inset-inline-end:0;inset-inline-start:auto;margin:0;padding:0;inline-size:min(26rem,100vw);max-inline-size:100vw;block-size:100vh;block-size:100dvh;max-block-size:none;border:0;border-inline-start:1px solid var(--c-border);background:var(--c-bg);color:var(--c-text);flex-direction:column;overflow:hidden;}',
    'dialog.panel[open]{display:flex;}',
    'dialog.panel{inline-size:min(var(--panel-w,26rem),100vw);}',
    '.rz{position:absolute;inset-block:0;inset-inline-start:0;inline-size:0.75rem;cursor:col-resize;touch-action:none;z-index:3;display:flex;align-items:center;justify-content:center;}',
    '.root.pos-start .rz{inset-inline-start:auto;inset-inline-end:0;}',
    '.root[dir=rtl].pos-start .rz{inset-inline-end:auto;inset-inline-start:0;}',
    '.rz::before{content:"";inline-size:0.25rem;block-size:3rem;border-radius:999px;background:var(--c-border);transition:background 0.15s,block-size 0.15s;}',
    '.rz:hover::before,.rz.drag::before{background:var(--c-focus);block-size:5rem;}',
    '.rz:focus-visible{outline-offset:-3px;}',
    'dialog.panel.resizing{user-select:none;-webkit-user-select:none;}',
    '@media (max-width:899.98px){.rz{display:none;}}',
    'dialog.panel::backdrop{background:rgba(0,0,0,0.2);}',
    '@media (max-width:899.98px){dialog.panel{inline-size:100vw;border:0;}}',
    '.head{padding:0.75rem 1rem;border-block-end:1px solid var(--c-border);display:flex;flex-direction:column;gap:0.5rem;}',
    '.head-row{display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;justify-content:space-between;}',
    '.head h2{margin:0;font-size:1.25rem;line-height:1.3;}',
    '.tools{display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;}',
    '.field{display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;}',
    'select{min-height:2.75rem;padding:0.25rem 0.5rem;border:2px solid var(--c-border);border-radius:0.5rem;background:var(--c-bg);}',
    '.body{flex:1 1 auto;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:0.75rem;}',
    '.intro p{margin:0 0 0.5rem;}',
    '.examples{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0.5rem;}',
    '.examples .btn{inline-size:100%;justify-content:flex-start;text-align:start;}',
    '.log{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0.75rem;}',
    '.msg{padding:0.75rem 1rem;border-radius:1rem;max-inline-size:100%;overflow-wrap:anywhere;}',
    '.msg.you{background:var(--c-btn);color:var(--c-btn-text);margin-inline-start:2rem;}',
    '.msg.bot,.msg.tutor{background:var(--c-bg2);margin-inline-end:1rem;}',
    '.msg.tutor{border-inline-start:0.375rem solid var(--c-text);}',
    '.who{display:flex;flex-wrap:wrap;gap:0.5rem;font-size:0.875rem;margin-block-end:0.25rem;}',
    '.who time{opacity:1;}',
    '.msg.bot .who time,.msg.tutor .who time,.note{color:var(--c-muted);}',
    '.msg p{margin:0 0 0.5rem;}',
    '.msg p:last-child{margin-block-end:0;}',
    '.msg a{color:inherit;text-decoration:underline;text-underline-offset:0.15em;}',
    '.sources{margin:0.5rem 0;}',
    '.sources h3{font-size:0.875rem;margin:0 0 0.25rem;}',
    '.sources ul{margin:0;padding-inline-start:1.25rem;}',
    '.sources li{margin-block:0.25rem;}',
    '.note{font-size:0.875rem;margin:0.25rem 0 0.5rem;}',
    '.actions{display:flex;flex-wrap:wrap;gap:0.5rem;margin-block-start:0.5rem;}',
    '.head-btns{display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:flex-end;}',
    '.trans{display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-block:0.5rem;font-size:0.875rem;}',
    '.trans label{display:inline-flex;align-items:center;gap:0.375rem;font-weight:600;}',
    '.trans select{min-block-size:2.75rem;max-inline-size:100%;padding:0.25rem 0.5rem;border:2px solid var(--c-border);border-radius:0.5rem;background:var(--c-bg);color:var(--c-text);font-size:1rem;}',
    '.status{margin:0;padding:0.5rem 1rem;font-size:0.9375rem;border-block-start:1px solid var(--c-border);}',
    '.status:empty{display:none;}',
    '.consent{border:2px solid var(--c-border);border-radius:0.75rem;padding:1rem;}',
    '.consent h3{margin:0 0 0.5rem;font-size:1.125rem;}',
    '.consent p{margin:0 0 0.75rem;}',
    '.consent .actions{flex-direction:column;}',
    '.consent .actions .btn{inline-size:100%;}',
    '.linkbtn{background:none;border:0;padding:0.5rem 0;min-height:2.75rem;text-decoration:underline;cursor:pointer;color:inherit;font:inherit;}',
    '.composer{padding:0.75rem 1rem 1rem;border-block-start:1px solid var(--c-border);display:flex;flex-direction:column;gap:0.5rem;background:var(--c-bg);}',
    '.composer label{font-weight:600;}',
    'textarea{inline-size:100%;min-block-size:3.25rem;padding:0.5rem 0.75rem;border:2px solid var(--c-border);border-radius:0.5rem;background:var(--c-bg);resize:vertical;font-size:1rem;}',
    '.hint{margin:0;font-size:0.875rem;color:var(--c-muted);}',
    '.row{display:flex;flex-wrap:wrap;gap:0.5rem;}',
    '.row .grow{flex:1 1 8rem;}',
    '.inline{border:2px solid var(--c-border);border-radius:0.75rem;background:var(--c-bg);overflow:hidden;}',
    '.inline .composer{border-block-start:0;}',
    '.inline .body{max-block-size:none;overflow:visible;}',
    '.inline .status{border-block-start:1px solid var(--c-border);}',
    '.share{display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;padding:0.75rem 1rem;background:var(--c-text);color:var(--c-bg);}',
    '.share p{margin:0;font-weight:600;flex:1 1 10rem;}',
    '.share .btn{background:var(--c-bg);color:var(--c-text);border-color:var(--c-bg);}',
    'details.data{inline-size:100%;}',
    'details.data summary{min-height:2.75rem;display:flex;align-items:center;cursor:pointer;text-decoration:underline;}',
    'details.data p{margin:0.25rem 0 0.5rem;font-size:0.875rem;color:var(--c-muted);}',
    '.form{border:2px solid var(--c-border);border-radius:0.75rem;padding:1rem;}',
    '.form h3{margin:0 0 0.25rem;font-size:1.125rem;}',
    '.form h4{margin:0.75rem 0 0.5rem;font-size:1rem;}',
    '.form fieldset{border:0;margin:0;padding:0;}',
    '.form legend{font-weight:600;padding:0;margin-block-end:0.5rem;}',
    '.check{display:flex;align-items:center;gap:0.75rem;min-height:2.75rem;padding:0.25rem 0;}',
    '.check input{inline-size:1.5rem;block-size:1.5rem;flex:none;margin:0;}',
    '.form input[type="text"],.form textarea{inline-size:100%;min-height:2.75rem;padding:0.5rem 0.75rem;border:2px solid var(--c-border);border-radius:0.5rem;background:var(--c-bg);font:inherit;}',
    '.error{color:#B00020;font-weight:600;margin:0.5rem 0;}',
    '.root.dark .error{color:#FFB4AB;}',
    '.form dl{margin:0;}',
    '.form dt{font-weight:600;margin-block-start:0.5rem;}',
    '.form dd{margin:0;}',
    '.filebtn{position:relative;}',
    '.filebtn input{position:absolute;inset:0;opacity:0;inline-size:100%;block-size:100%;cursor:pointer;}',
    '.filebtn:focus-within{outline:3px solid var(--c-focus);outline-offset:2px;box-shadow:0 0 0 2px var(--c-text);}'
  ].join('\n');

  // SYLY voice-bubble logo (traced from .claude/assets/SYLY-voice-icon-bw.png, demo/assets/syly-logo.svg).
  // Colours come from --logo-a (square, bars) and --logo-b (bubble, dot), so it fits any background.
  var LOGO = '<svg class="logo" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
    '<rect class="lg-a" width="200" height="200" rx="46"/><rect class="lg-b" x="28" y="52" width="143" height="83" rx="9"/>' +
    '<path class="lg-b" d="M72 134H104L72 163Z"/><circle class="lg-a" cx="164" cy="40" r="16"/><circle class="lg-b" cx="164" cy="40" r="12"/>' +
    '<path class="lg-bars" d="M55.5 84V103M77.5 72V115M99.5 62V125M121.5 72V115M143.5 84V103"/></svg>';

  /* --------------------------------------------------------------- element */
  class DbAssistant extends HTMLElement {
    static get observedAttributes() { return ['lang', 'theme', 'position', 'primary']; }

    constructor() {
      super();
      this._t = I18N.en || {};
      this._lang = 'en';
      this._index = null;
      this._history = [];
      this._pending = null;
      this._ticket = null;
      this._afterId = 0;
      this._recognizer = null;
      this._audio = null;
      this._config = null;
      this._onOnline = this._online.bind(this);
      this._onOffline = this._setStatusNetwork.bind(this);
      // Same id for this browser so the learner can export or delete their data (NFR-S4).
      this._sessionId = load('cid', null) || uid();
      save('cid', this._sessionId);
    }

    connectedCallback() {
      if (this.shadowRoot || this._siteWait) return;
      if (this.hasAttribute('site') && !this._siteDone) {
        // Developer portal: fetch this site's settings first (4 s at most), then start as usual. Any failure: attributes and defaults.
        var host = this;
        this._siteWait = true;
        this._loadSite().then(function (cfg) {
          host._siteWait = false; host._siteDone = true;
          if (cfg) {
            host._siteKey = (host.getAttribute('site') || '').trim();
            host._siteSimple = !!cfg.simple;
            applySite(cfg, function (a) { return host.hasAttribute(a); }).forEach(function (kv) { host.setAttribute(kv[0], kv[1]); });
          }
          if (host.isConnected) host.connectedCallback();
        });
        return;
      }
      this.attachShadow({ mode: 'open' });
      this._mode = this.getAttribute('mode') === 'inline' ? 'inline' : 'panel';
      this._simple = !!load('simple', !!this._siteSimple);
      this._consent = load('consent', null); // 'yes' | 'no' | null
      this._render();
      this._applyTheme();
      window.addEventListener('online', this._onOnline);
      window.addEventListener('offline', this._onOffline);
      this._setLang(this.getAttribute('lang') || 'am', true);
      var self = this;
      // Content sources (FR-AD4): 1. content file, 2. server sections for this page, 3. page reading.
      Promise.all([this._loadContent(), this._loadConfig()]).then(function (r) {
        var mode = (self.getAttribute('read-page') || '').toLowerCase();
        if (decidePageReading(mode, r[0], r[1])) self._startPageReading(mode === 'fallback');
      });
    }

    disconnectedCallback() {
      window.removeEventListener('online', this._onOnline);
      window.removeEventListener('offline', this._onOffline);
      clearInterval(this._poll);
      this._stopVoice();
      if (this._pageObserver) { this._pageObserver.disconnect(); this._pageObserver = null; }
      clearTimeout(this._pageTimer);
    }

    /* page reading (FR-AD4, SDS 1.8) */
    _startPageReading(pageOnly) {
      var self = this;
      this._pageOnly = pageOnly; // "fallback": the page is the only local content; otherwise it is added to the file
      this._pageReading = true;
      this._readPageNow();
      if (!window.MutationObserver) return;
      var own = function (n) {
        var el = n && (n.nodeType === 1 ? n : n.parentElement);
        return !!el && (el === self || self.contains(el) || !!(el.closest && el.closest('db-assistant, #db-assistant-skip')));
      };
      var firstChange = 0;
      this._pageObserver = new MutationObserver(function (list) {
        var relevant = list.some(function (m) {
          if (own(m.target)) return false;
          var nodes = Array.prototype.slice.call(m.addedNodes).concat(Array.prototype.slice.call(m.removedNodes));
          return !nodes.length || !nodes.every(own);
        });
        if (!relevant) return;
        // Single-page apps (React ...) draw the lesson after this script starts: re-read soon after a change,
        // but never wait more than 4 seconds even if the page keeps changing (carousels, animations).
        clearTimeout(self._pageTimer);
        if (!firstChange) firstChange = Date.now();
        var wait = Math.max(0, Math.min(800, 4000 - (Date.now() - firstChange)));
        self._pageTimer = setTimeout(function () { firstChange = 0; self._readPageNow(); }, wait);
      });
      // The whole body, not only the root found now: <main> may not exist yet.
      this._pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    // Reads the page as it is now (the root is looked up again each time: it can appear later).
    _readPageNow() {
      if (!this._pageReading) return;
      var root = pageRoot(document, this.getAttribute('content-selector'));
      this._pageSections = readPage(root, { doc: document, win: window, loc: location });
      this._rebuildIndex();
    }
    _rebuildIndex() {
      var file = this._pageOnly ? [] : (this._fileSections || []);
      var page = (this._pageSections || []).map(pageToIndex);
      this._index = new Index(file.concat(page));
      this._renderExamples();
    }

    // "Try one of these": built from the headings of the page being read (or, without page reading, from the content
    // file), so they always match what is really there and change when the page changes.
    _renderExamples() {
      if (!this.$examples) return;
      var self = this, t = this._t, lang = this._lang;
      var secs = this._pageSections && this._pageSections.length
        ? this._pageSections.map(function (s) { return s.title; })
        : (this._fileSections || []).map(function (s) { return (lang === 'am' && s.title_am) || s.title_en || s.title_am || s.title; });
      var titles = [], seen = {};
      secs.forEach(function (ti) {
        ti = String(ti || '').replace(/\s+/g, ' ').trim();
        if (ti.length < 3 || seen[ti.toLowerCase()]) return;
        seen[ti.toLowerCase()] = 1;
        titles.push(ti.length > 70 ? ti.slice(0, ti.lastIndexOf(' ', 70) > 20 ? ti.lastIndexOf(' ', 70) : 70).trim() : ti);
      });
      var pick = titles.length <= 3 ? titles : [0, 1, 2].map(function (i) { return titles[Math.round(i * (titles.length - 1) / 2)]; });
      var questions = pick.map(function (ti) { return /[?؟፧]$/.test(ti) ? ti : fmt(t.exampleAbout || '{title}', { title: ti }); });
      var key = lang + '|' + questions.join('|');
      if (key === this._exKey) return;
      this._exKey = key;
      this.$examples.textContent = '';
      questions.forEach(function (q) {
        self.$examples.appendChild(h('li', null, [h('button', { type: 'button', class: 'btn', text: q, onclick: function () { self.$q.value = q; self._submit(); } })]));
      });
      this.$exTitle.hidden = !questions.length;
    }

    attributeChangedCallback(name, oldV, newV) {
      if (!this.shadowRoot || oldV === newV) return;
      if (name === 'lang') this._setLang(newV || 'en');
      else this._applyTheme();
    }

    /* public API */
    open() {
      if (this._mode === 'inline') { this.$q.focus(); return; }
      var d = this.$dialog;
      if (!d.open) {
        this.$launcher.hidden = true;
        if (MODAL_ALWAYS || window.innerWidth < MODAL_BELOW_PX) d.showModal(); else d.show();
      }
      this._readPageNow();
      if (this._needsConsent() && !this.$consent.hidden) this.$consentTitle.focus();
      else this.$q.focus();
    }
    close(opts) {
      if (this._mode === 'inline') return;
      var d = this.$dialog;
      this._stopVoice();
      if (d.open) d.close();
      this.$launcher.hidden = false;
      if (!opts || opts.returnFocus !== false) this.$launcher.focus();
    }
    /** Ask a question as if typed (hosts: "Ask about this job"). */
    ask(text) {
      if (!text) return;
      this.open();
      this.$q.value = text;
      this._submit();
    }
    /** Interview support request for a job (FR-J4): goes to a person, never to the employer. */
    openAccommodation(job) {
      this.open();
      this._accStart(job || {});
    }
    /** Explain how to get alerts for jobs like this one (FR-J3). */
    showJobAlerts(keyword) {
      this.open();
      var t = this._t, msg = { role: 'bot', text: fmt(t.alertsHow, { keyword: keyword || '' }) };
      var bot = this._config && this._config.telegram_bot;
      if (bot) msg.link = { href: 'https://t.me/' + encodeURIComponent(bot) + '?start=alerts_' + encodeURIComponent(String(keyword || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40)), text: t.openTelegram };
      this._addMessage(msg);
    }
    getText(key, lang) {
      var dict = lang ? (I18N[lang] || this._t) : this._t;
      return dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
    }

    /* rendering */
    _render() {
      var root = this.shadowRoot;
      var style = h('style');
      style.textContent = CSS;
      var wrap = this.$root = h('div', { class: 'root' });
      var me = this;
      wrap.addEventListener('dba-error', function () { me._status(me._t.genericError); });
      root.appendChild(style);
      root.appendChild(wrap);

      var self = this;
      var tx = function (key, attrs) { var a = attrs || {}; a['data-t'] = key; return a; };

      // composer (shared)
      this.$q = h('textarea', { id: 'q', rows: '2', 'aria-describedby': 'hint', autocomplete: 'off' });
      this.$q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); self._submit(); }
      });
      this.$hint = h('p', tx('questionHint', { id: 'hint', class: 'hint' }));
      this.$mic = h('button', { type: 'button', class: 'btn grow', 'aria-pressed': 'false', onclick: function () { self._toggleMic(); } }, iconText('mic', tx('mic')));
      this.$send = h('button', { type: 'button', class: 'btn primary grow', onclick: function () { self._submit(); } }, iconText('send', tx('send'), 'flip'));
      this.$talk = h('button', { type: 'button', class: 'btn', onclick: function () { self._escalate(); } }, iconText('talk', tx('talk')));
      var composer = h('div', { class: 'composer' }, [
        h('label', tx(this._mode === 'inline' ? 'inlineLabel' : 'questionLabel', { for: 'q' })),
        this.$q, this.$hint,
        h('div', { class: 'row' }, [this.$mic, this.$send]),
        this.$talk
      ]);

      // intro + examples
      this.$examples = h('ul', { class: 'examples' });
      this.$exTitle = h('p', { hidden: true }, [emoji('💡'), h('span', tx('examplesTitle'))]);
      this.$intro = h('div', { class: 'intro' }, [
        h('p', null, [emoji('👋'), h('span', tx('emptyIntro'))]),
        this.$exTitle,
        this.$examples
      ]);
      this._renderExamples();

      // consent card (NFR-S2)
      this.$consentTitle = h('h3', { tabindex: '-1', id: 'consent-title' }, [emoji('🔒'), h('span', tx('consentTitle'))]);
      this.$consentDetails = h('p', tx('consentDetails', { id: 'consent-details', hidden: true }));
      this.$consent = h('section', { class: 'consent', 'aria-labelledby': 'consent-title', hidden: true }, [
        this.$consentTitle,
        h('p', tx('consentText')),
        h('button', tx('consentWhat', { type: 'button', class: 'linkbtn', 'aria-expanded': 'false', 'aria-controls': 'consent-details', onclick: function (e) {
          var open = self.$consentDetails.hidden;
          self.$consentDetails.hidden = !open;
          e.currentTarget.setAttribute('aria-expanded', String(open));
        } })),
        this.$consentDetails,
        h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn primary', onclick: function () { self._setConsent('yes'); } }, iconText('online', tx('consentAllow'))),
          h('button', { type: 'button', class: 'btn', onclick: function () { self._setConsent('no'); } }, iconText('sources', tx('consentDeny')))
        ])
      ]);

      // role="log" sits on a wrapper so the <ol> keeps its list semantics (axe: listitem).
      this.$log = h('ol', { class: 'log' });
      this.$logBox = h('div', { class: 'logbox', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-labelledby': 'title' }, [this.$log]);
      this.$status = h('p', { class: 'status', role: 'status' });
      this.$acc = h('section', { class: 'form', 'aria-labelledby': 'acc-title', hidden: true });
      var body = this.$body = h('div', { class: 'body' }, [this.$intro, this.$consent, this.$logBox, this.$acc]);
      // Persistent bar while the screen is shared (FR-H4, NFR-S5)
      this.$shareStop = h('button', { type: 'button', class: 'btn', onclick: function () { self._stopShare(); } }, iconText('shareOff', tx('shareStop')));
      this.$share = h('div', { class: 'share', hidden: true }, [h('p', null, [icon('share'), h('span', tx('sharing'))]), this.$shareStop]);

      if (this._mode === 'inline') {
        wrap.classList.add('inline');
        wrap.appendChild(h('h2', tx('title', { id: 'title', class: 'visually-title', style: 'margin:0;padding:0.75rem 1rem 0;font-size:1.125rem;' })));
        wrap.appendChild(this.$share);
        wrap.appendChild(composer);
        wrap.appendChild(this.$status);
        wrap.appendChild(body);
        return;
      }

      // panel mode: launcher + dialog
      this.$launcher = h('button', { type: 'button', class: 'btn launcher', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'panel', onclick: function () { self.open(); } });
      this.$launcher.innerHTML = LOGO;
      this.$launcher.appendChild(h('span', tx('launcher')));

      this.$langSel = h('select', { id: 'lang', onchange: function (e) { self.setAttribute('lang', e.target.value); } });
      this.$simpleBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': String(this._simple), onclick: function () { self._toggleSimple(); } }, iconText('simple', tx('simpleMode')));
      this.$onlineBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', hidden: true, onclick: function () {
        self._setConsent(self._consent === 'yes' ? 'no' : 'yes', true);
      } }, iconText('online', tx('onlineAnswers')));
      var head = h('div', { class: 'head' }, [
        h('div', { class: 'head-row' }, [
          h('h2', { id: 'title' }, [logoEl(), h('span', tx('title'))]),
          h('div', { class: 'head-btns' }, [
            h('button', { type: 'button', class: 'btn', onclick: function () { self._refresh(); } }, iconText('refresh', tx('refresh'))),
            h('button', { type: 'button', class: 'btn', onclick: function () { self.close(); } }, iconText('close', tx('close')))
          ])
        ]),
        h('div', { class: 'tools' }, [
          h('span', { class: 'field' }, [h('label', { for: 'lang' }, iconText('language', tx('language'))), this.$langSel]),
          this.$simpleBtn, this.$onlineBtn,
          h('details', { class: 'data' }, [
            h('summary', null, iconText('data', tx('yourData'))),
            h('p', tx('dataNote')),
            h('div', { class: 'row' }, [
              h('button', { type: 'button', class: 'btn', onclick: function () { self._exportData(); } }, iconText('download', tx('exportData'))),
              h('button', { type: 'button', class: 'btn', onclick: function () { self._deleteData(); } }, iconText('trash', tx('deleteData')))
            ])
          ])
        ])
      ]);
      this.$rz = h('div', { class: 'rz', role: 'separator', 'aria-orientation': 'vertical', tabindex: '0' });
      this.$dialog = h('dialog', { id: 'panel', class: 'panel', 'aria-labelledby': 'title' }, [this.$rz, head, this.$share, body, this.$status, composer]);
      this._initResize();
      this.$dialog.addEventListener('cancel', function (e) { e.preventDefault(); if (self._sharing) self._stopShare(); else self.close(); });
      this.$dialog.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.preventDefault();
        if (self._sharing) self._stopShare(); else self.close(); // "Stop sharing (Esc)" first
      });
      this.$dialog.addEventListener('close', function () { self.$launcher.hidden = false; });
      window.addEventListener('resize', function () {
        var d = self.$dialog;
        if (MODAL_ALWAYS || !d.open) return;
        var shouldModal = window.innerWidth < MODAL_BELOW_PX;
        if (shouldModal !== d.matches(':modal')) { d.close(); self.$launcher.hidden = true; shouldModal ? d.showModal() : d.show(); }
      });
      wrap.appendChild(this.$launcher);
      wrap.appendChild(this.$dialog);
    }

    // The learner can drag the panel's inner edge (mouse, touch or pen) or use the arrow keys to make it wider or
    // narrower. Home/End jump to the limits, Enter or a double click restores the default. The width is remembered.
    _initResize() {
      var self = this, d = this.$dialog, rz = this.$rz, DEFAULT = 416, MIN = 320, STEP = 24;
      function max() { return Math.max(MIN, Math.min(960, Math.round(window.innerWidth * 0.9))); }
      function clamp(w) { return Math.max(MIN, Math.min(max(), Math.round(w))); }
      function onRight() { return d.getBoundingClientRect().left > 1; }
      function set(w, persist) {
        w = clamp(w);
        d.style.setProperty('--panel-w', w + 'px');
        rz.setAttribute('aria-valuemin', String(MIN)); rz.setAttribute('aria-valuemax', String(max())); rz.setAttribute('aria-valuenow', String(w));
        if (persist) save('panelWidth', w);
      }
      var saved = load('panelWidth', null);
      set(typeof saved === 'number' ? saved : DEFAULT, false);
      this._rzLabel = function () { rz.setAttribute('aria-label', self._t.resize); };
      this._rzLabel();
      var dragging = false;
      rz.addEventListener('pointerdown', function (e) {
        if (e.button > 0) return;
        dragging = true; rz.setPointerCapture(e.pointerId); rz.classList.add('drag'); d.classList.add('resizing'); e.preventDefault();
      });
      rz.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        set(onRight() ? window.innerWidth - e.clientX : e.clientX, false);
      });
      function end(e) {
        if (!dragging) return;
        dragging = false; rz.classList.remove('drag'); d.classList.remove('resizing');
        try { rz.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
        save('panelWidth', clamp(parseInt(rz.getAttribute('aria-valuenow'), 10) || DEFAULT));
      }
      rz.addEventListener('pointerup', end);
      rz.addEventListener('pointercancel', end);
      rz.addEventListener('dblclick', function () { set(DEFAULT, true); });
      rz.addEventListener('keydown', function (e) {
        var cur = parseInt(rz.getAttribute('aria-valuenow'), 10) || DEFAULT, w = null;
        // the edge being moved is on the inner side: toward the page grows a right-hand panel, shrinks a left-hand one
        var grow = (e.key === 'ArrowLeft') === onRight();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') w = cur + (grow ? STEP : -STEP) * (e.shiftKey ? 4 : 1);
        else if (e.key === 'Home') w = MIN;
        else if (e.key === 'End') w = max();
        else if (e.key === 'Enter') w = DEFAULT;
        if (w === null) return;
        e.preventDefault(); e.stopPropagation(); set(w, true);
      });
      window.addEventListener('resize', function () { set(parseInt(rz.getAttribute('aria-valuenow'), 10) || DEFAULT, false); });
    }

    _applyTheme() {
      var theme = this.getAttribute('theme') || 'auto';
      var pos = this.getAttribute('position') || 'end';
      var root = this.$root;
      root.classList.toggle('dark', theme === 'dark');
      root.classList.toggle('pos-start', pos === 'start');
      if (theme === 'dark') { root.style.removeProperty('--c-btn'); return; }
      var btn = FALLBACK_BUTTON;
      var own = parseColor((this.getAttribute('primary') || '').trim());
      if (own && contrast(own, [255, 255, 255]) >= 4.5) { root.style.setProperty('--c-btn', this.getAttribute('primary').trim()); return; }
      if (theme === 'auto') {
        var host = getComputedStyle(this).getPropertyValue('--bs-primary');
        var rgb = parseColor(host);
        if (rgb && contrast(rgb, [255, 255, 255]) >= 4.5) btn = host.trim();
      }
      root.style.setProperty('--c-btn', btn);
    }

    _setLang(lang, first) {
      var self = this;
      lang = String(lang || 'en').toLowerCase().split('-')[0];
      var done = function (dict) {
        self._t = Object.assign({}, I18N.en, dict || {});
        self._lang = dict ? lang : 'en';
        self._applyTexts();
        if (!first) self._emit('language', { language: self._lang });
      };
      this._langWanted = lang;
      // Inlined dictionaries equal module/i18n/*.json (tested), so no extra request on 3G.
      if (I18N[lang]) { done(I18N[lang]); return; }
      // Any other language: the JSON file next to the script (NFR-E5).
      fetch(new URL('i18n/' + lang + '.json', SCRIPT_URL).href)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (dict) { if (self._langWanted === lang) done(dict); })
        .catch(function () { if (self._langWanted === lang) done(null); });
    }

    _applyTexts() {
      var t = this._t, root = this.$root;
      root.setAttribute('lang', this._lang);
      root.setAttribute('dir', t.dir || 'ltr');
      if (this.$dialog) { this.$dialog.setAttribute('lang', this._lang); this.$dialog.setAttribute('dir', t.dir || 'ltr'); }
      root.querySelectorAll('[data-t]').forEach(function (el) {
        var v = t[el.getAttribute('data-t')];
        if (v !== undefined) el.textContent = v;
      });
      if (this._rzLabel) this._rzLabel();
      this._renderExamples();
      if (this._recognizer || this._recording) this._setBtn(this.$mic, 'stop', 'micStop');
      if (this.$langSel) {
        var sel = this.$langSel, cur = this._lang;
        var langs = ['en', 'am', 'ar', 'om', 'ti', 'so'];
        if (langs.indexOf(cur) < 0) langs.push(cur);
        sel.textContent = '';
        langs.forEach(function (l) {
          sel.appendChild(h('option', { value: l, lang: l, selected: l === cur, text: (NATIVE_NAMES[l] || l) + (BETA_LANGS.indexOf(l) >= 0 ? ' (' + t.langBeta + ')' : '') }));
        });
      }
      this._setStatusNetwork();
    }

    _setBtn(btn, iconName, key) {
      btn.textContent = '';
      btn.appendChild(icon(iconName));
      btn.appendChild(h('span', { 'data-t': key, text: this._t[key] }));
    }

    _emit(name, detail) {
      this.dispatchEvent(new CustomEvent('db-assistant:' + name, { bubbles: true, composed: true, detail: detail }));
    }

    _status(text) { this.$status.textContent = text || ''; }
    _setStatusNetwork() {
      if (!navigator.onLine) this._status(this._t.statusOffline);
      else if (this._apiBase() && this._config) this._status(this._t.statusOnline);
      else this._status('');
    }

    _toggleSimple() {
      this._simple = !this._simple;
      save('simple', this._simple);
      this.$simpleBtn.setAttribute('aria-pressed', String(this._simple));
    }

    /* consent (NFR-S2) */
    _needsConsent() { return !!(this._config && this._config.ai) && this._consent === null; }
    _showConsentIfNeeded() {
      var need = this._needsConsent();
      this.$consent.hidden = !need;
      if (this.$onlineBtn) {
        this.$onlineBtn.hidden = !(this._config && this._config.ai);
        this.$onlineBtn.setAttribute('aria-pressed', String(this._consent === 'yes'));
      }
      return need;
    }
    _setConsent(value, fromToggle) {
      this._consent = value;
      save('consent', value);
      this._showConsentIfNeeded();
      if (!fromToggle) this.$q.focus();
      var pending = this._pending;
      this._pending = null;
      var pendingLang = this._pendingLang;
      this._pendingLang = null;
      if (pending) this._ask(pending, true, pendingLang);
    }

    /* content */
    // Resolves to true when the content attribute's file gave sections (fresh or cached).
    _loadContent() {
      var self = this;
      var src = this.getAttribute('content');
      var url = src ? new URL(src, document.baseURI).href : (this._apiBase() ? this._apiBase() + '/v1/content' : null);
      if (!url) return Promise.resolve(false);
      var cacheKey = 'content:' + url;
      var use = function (data) {
        var list = Array.isArray(data) ? data : (data && (data.sections || data.items)) || [];
        self._fileSections = list.filter(function (s) { return s && s.url; });
        self._contentBase = url; // section links are relative to the content file, not to the host page
        self._rebuildIndex();
      };
      var cached = load(cacheKey, null);
      if (cached) use(cached);
      return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { use(data); save(cacheKey, data); return !!src && self._fileSections.length > 0; })
        .catch(function () {
          if (!self._index) self._contentFailed = true; // else the cached copy stays in use
          return !!src && !!cached;
        });
    }

    /* api */
    _apiOrigin() { var b = this._apiBase(); try { return b ? new URL(b, document.baseURI).href : document.baseURI; } catch (e) { return document.baseURI; } }
    _apiBase() { var a = (this.getAttribute('api') || '').trim(); return a ? a.replace(/\/+$/, '') : ''; }
    _loadSite() {
      var key = (this.getAttribute('site') || '').trim();
      if (!key || !this._apiBase() || !window.fetch) return Promise.resolve(null);
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = ctl && setTimeout(function () { ctl.abort(); }, 4000);
      return fetch(this._apiBase() + '/v1/sites/' + encodeURIComponent(key) + '/config', ctl ? { signal: ctl.signal } : {})
        .then(function (r) { clearTimeout(timer); return r.ok ? r.json() : null; })
        .catch(function () { clearTimeout(timer); return null; });
    }
    // The site key travels with every API call, so the server can check the page's origin against the site's list.
    _keyed(headers) { return this._siteKey ? Object.assign({}, headers, { 'X-Site-Key': this._siteKey }) : headers; }
    _fetchJson(path, opts) {
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = ctl && setTimeout(function () { ctl.abort(); }, 15000); // network only, never a user time-out
      var o = Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {});
      o.headers = this._keyed(o.headers);
      if (ctl) o.signal = ctl.signal;
      return fetch(this._apiBase() + path, o).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) { var err = new Error('HTTP ' + r.status); err.status = r.status; throw err; }
        return r.status === 204 ? null : r.json();
      }, function (e) { clearTimeout(timer); throw e; });
    }
    // Resolves to 'none' | 'unreachable' | 'hasSections' | 'noSections' (FR-AD4 fallback order).
    _loadConfig() {
      var self = this;
      if (!this._apiBase()) return Promise.resolve('none');
      return this._fetchJson('/v1/config?page_url=' + encodeURIComponent(location.href)).then(function (cfg) {
        self._config = cfg || {};
        self._showConsentIfNeeded();
        self._setStatusNetwork();
        self._flushQueue();
        return self._config.page_sections > 0 ? 'hasSections' : 'noSections';
      }).catch(function () { self._config = null; return 'unreachable'; });
    }

    /* asking */
    _submit() {
      var text = this.$q.value.trim();
      if (!text) {
        this._status(this._t.emptyQuestion);
        this.$q.focus();
        return;
      }
      this._stopMic();
      this.$q.value = '';
      this._ask(text);
    }

    _ask(text, resumed, forceLang) {
      var self = this;
      if (!resumed) {
        this._addMessage({ role: 'you', text: text, lang: detectLang(text, this._lang) });
        this._emit('question', { text: text, language: this._lang });
        // "reply in Amharic", "translate to Arabic": the learner names the language of the reply
        var req = parseLangRequest(text);
        if (req) {
          forceLang = req.lang;
          if (req.only) { this._translateLast(req.lang); return; }
          text = req.text;
        }
      }
      var replyLang = forceLang || this._lang;
      if (this._showConsentIfNeeded()) {
        this._pending = text;
        this._pendingLang = forceLang || null;
        this.$consentTitle.focus();
        return;
      }
      this._readPageNow(); // the page may have changed since it was last read
      var local = this._index ? this._index.search(text) : null;
      if (NO_ADVICE.test(text)) { this._addMessage({ role: 'bot', text: this._t.noAdvice, offerHelp: true }); return; }

      if (this._apiBase() && navigator.onLine) {
        this._status(this._t.statusSending);
        this._fetchJson('/v1/ask', { method: 'POST', body: JSON.stringify({
          question: text, language: replyLang, page_url: location.href, conversation_id: this._sessionId,
          allow_ai: this._consent === 'yes', simple: this._simple,
          // Page sections leave the browser only after "Allow online answers" (FR-AD4, NFR-S2).
          sections: this._consent === 'yes' && this._pageSections && this._pageSections.length ? this._pageSections : undefined
        }) }).then(function (res) {
          self._setStatusNetwork();
          var sources = (res && res.sources || []).filter(function (s) { return s && s.url; });
          if (res && res.reason === 'no_advice') { self._addMessage({ role: 'bot', text: self._t.noAdvice, offerHelp: true }); return; }
          // Server found nothing, but the browser's own search did (page read without consent): answer locally.
          if ((!res || !res.answer || !sources.length) && local && local.found) { self._answerLocal(text, local, forceLang); return; }
          if (!res || !res.answer || !sources.length) { self._notFound(); return; } // FR-T5: no source, no answer
          var pageUrls = (self._pageSections || []).map(function (ps) { return ps.url; });
          sources = sources.map(function (src) {
            return { title: src.title, url: pageUrls.indexOf(src.url) >= 0 ? src.url : absUrl(src.url, self._apiOrigin()) };
          });
          self._deliver({ role: 'bot', text: res.answer, lang: res.language || replyLang, sources: sources,
            note: res.provider && res.provider !== 'none' ? self._t.answeredAi : self._t.answeredLocal, ai: res.provider && res.provider !== 'none', audio: res.audio || [] }, replyLang);
        }).catch(function () {
          self._setStatusNetwork();
          self._answerLocal(text, local, forceLang);
        });
        return;
      }
      this._answerLocal(text, local, forceLang);
    }

    _answerLocal(text, local, forceLang) {
      if (!this._index && this._contentFailed) {
        this._addMessage({ role: 'bot', emoji: '⚠️', text: this._t.contentUnavailable, offerHelp: true });
        return;
      }
      if (!local || !local.found) {
        if (!navigator.onLine && this._apiBase()) {
          this._enqueue({ type: 'ask', text: text });
          this._addMessage({ role: 'bot', text: this._t.queued });
        }
        this._notFound();
        return;
      }
      var s = local.best.section;
      // Answer in the learner's language when the section has it; Arabic falls back to English text.
      var lang = this._lang === 'am' || local.lang === 'am' ? 'am' : 'en';
      if (s.source === 'page') lang = s.text_am ? 'am' : 'en'; // page text has one language only
      var title = s['title_' + lang] || s.title_en;
      var n = this._simple ? 1 : 3;
      var idx = this._index.excerptIndices(text, s, lang, n);
      var body = this._index.excerpt(text, s, lang, n);
      // Pre-generated Amharic audio (api/scripts/gen_audio.py): title + each chosen sentence, offline.
      var audio = lang === 'am' && s.type !== 'job' && s.type !== 'page'
        ? ['sections/' + s.id + '/title.am.mp3'].concat(idx.map(function (i) { return 'sections/' + s.id + '/' + i + '.am.mp3'; }))
        : [];
      this._deliver({
        role: 'bot', lang: lang,
        text: fmt(this.getText('fromSection', lang), { title: title }) + '\n' + body + this._jobNotes(s, lang),
        sources: [{ title: title, url: s.source === 'page' ? s.url : absUrl(s.url, this._contentBase) }],
        note: this.getText('answeredLocal', lang),
        audio: audio,
        section: s.id
      }, forceLang || this._lang);
    }

    /* translation of answers (needs "Allow online answers": the text goes to the server's AI) */
    _canTranslate() { return !!this._apiBase() && navigator.onLine && this._consent === 'yes'; }
    _translate(text, target, source) {
      return this._fetchJson('/v1/translate', { method: 'POST', body: JSON.stringify({ text: text, target: target, source: source || null, allow_ai: true }) })
        .then(function (res) { if (!res || !res.text) throw new Error('no translation'); return res.text; });
    }
    _langName(code) { return this._t['langName_' + code] || code; }
    // Shows an answer in the wanted language: as it is, or translated first when the text is in another language.
    _deliver(spec, target) {
      var self = this, t = this._t;
      spec.canTranslate = true;
      if (!spec.lang || spec.lang === target || spec.role !== 'bot') { this._addMessage(spec); return; }
      if (!this._canTranslate()) {
        spec.note = (spec.note ? spec.note + ' ' : '') + fmt(t.translateHint, { language: this._langName(target) });
        this._addMessage(spec);
        return;
      }
      this._status(t.translating);
      this._translate(spec.text, target, spec.lang).then(function (tr) {
        self._status('');
        self._addMessage(Object.assign({}, spec, { text: tr, lang: target, orig: { text: spec.text, lang: spec.lang, audio: spec.audio || [] }, audio: [],
          note: fmt(t.translatedNote, { from: self._langName(spec.lang) }), ai: true }));
      }, function () {
        self._status(t.translateFailed);
        self._addMessage(spec);
      });
    }
    // "translate to Amharic" on its own: the last answer again, in that language.
    _translateLast(target) {
      var last = this._lastAnswer;
      if (!last) { this._addMessage({ role: 'bot', text: this._t.noAnswerToTranslate }); return; }
      var m = last.m, src = m.orig || m;
      if (!this._canTranslate() && src.lang !== target) { this._addMessage({ role: 'bot', text: this._t.translateNeedsConsent }); return; }
      this._deliver({ role: 'bot', text: src.text, lang: src.lang, sources: m.sources, note: m.orig ? '' : m.note, audio: src.audio || [], section: m.section }, target);
    }
    // The dropdown under an answer.
    _translateMessage(m, li, target, sel) {
      var self = this, t = this._t;
      var orig = m.orig || (m.orig = { text: m.text, lang: m.lang, audio: m.audio || [] });
      var box = li.querySelector('.txt');
      var show = function (text, lang, audio, translated) {
        m.text = text; m.lang = lang; m.audio = audio;
        li.setAttribute('lang', lang);
        box.textContent = '';
        String(text).split(/\n+/).forEach(function (para) { if (para.trim()) box.appendChild(h('p', { dir: 'auto', text: para })); });
        var old = li.querySelector('.trnote');
        if (old) old.remove();
        if (translated) box.insertAdjacentElement('afterend', h('p', { class: 'note trnote' }, [icon('ai'), h('span', { text: fmt(t.translatedNote, { from: self._langName(orig.lang) }) })]));
      };
      if (target === orig.lang) { show(orig.text, orig.lang, orig.audio, false); self._status(''); return; }
      if (!this._canTranslate()) { sel.value = m.lang; this._status(t.translateNeedsConsent); return; }
      this._status(t.translating);
      sel.disabled = true;
      this._translate(orig.text, target, orig.lang).then(function (tr) {
        show(tr, target, [], true);
        self._status('');
      }, function () {
        sel.value = m.lang;
        self._status(t.translateFailed);
      }).then(function () { sel.disabled = false; });
    }

    /* the reload button: read the page again and start a fresh conversation */
    _refresh() {
      var t = this._t;
      this._stopVoice();
      this._readPageNow();
      this._loadContent();
      if (this._ticket) { this._status(t.refreshedPage); return; } // a person is helping: keep the conversation
      this.$log.textContent = '';
      this._history = [];
      this._lastSection = null;
      this._lastAnswer = null;
      this._pending = null;
      this._sessionId = uid();
      save('cid', this._sessionId);
      this.$intro.hidden = false;
      this._exKey = null;
      this._renderExamples();
      this._status(t.refreshedChat);
      this.$body.scrollTo({ top: 0 });
      this.$q.focus();
    }

    _jobNotes(s, lang) {
      if (s.type !== 'job') return '';
      var notes = [];
      if (s.deadline) {
        var passed = s.deadline < new Date().toISOString().slice(0, 10);
        notes.push(fmt(this.getText(passed ? 'jobDeadlinePassed' : 'jobDeadline', lang), { date: formatDate(s.deadline, lang) }));
      }
      notes.push(this.getText('jobTrust', lang));
      return '\n' + notes.join(' ');
    }

    _notFound() {
      this._addMessage({ role: 'bot', emoji: '🔍', text: this._t.notFound + '\n' + this._t.notFoundOffer, offerHelp: true,
        audio: this._lang === 'am' ? ['phrases/notFound.am.mp3', 'phrases/notFoundOffer.am.mp3'] : [] });
    }

    _addMessage(m) {
      var self = this, t = this._t;
      m.lang = m.lang || this._lang;
      m.ts = m.ts || new Date();
      this._history.push({ role: m.role, text: m.text, lang: m.lang, sources: m.sources || [], section: m.section || null, ts: m.ts.toISOString() });
      if (m.section) this._lastSection = m.section;
      this.$intro.hidden = true;

      var who = m.role === 'you' ? t.you : m.role === 'tutor' ? (m.name || t.tutor) : t.assistant;
      var li = h('li', { class: 'msg ' + m.role, lang: m.lang, dir: 'auto' });
      li.appendChild(h('p', { class: 'who' }, [icon(m.role === 'you' ? 'you' : m.role === 'tutor' ? 'tutor' : 'bot'), h('strong', { text: who, dir: 'auto' }), h('time', { datetime: m.ts.toISOString(), text: formatTime(m.ts, this._lang) })]));
      if (m.emoji) li.appendChild(emoji(m.emoji));
      var txtBox = h('div', { class: 'txt' });
      String(m.text).split(/\n+/).forEach(function (para) { if (para.trim()) txtBox.appendChild(h('p', { dir: 'auto', text: para })); });
      li.appendChild(txtBox);

      if (m.sources && m.sources.length) {
        var ul = h('ul');
        m.sources.forEach(function (s) {
          var a = h('a', { href: s.url }, [h('bdi', { text: s.title || s.url })]);
          a.addEventListener('click', safe(function (e) { self._followSource(e, a); }));
          ul.appendChild(h('li', null, [a]));
        });
        li.appendChild(h('div', { class: 'sources' }, [h('h3', null, [icon('sources'), h('span', { text: this.getText('sources', m.lang) })]), ul]));
      }
      if (m.link) li.appendChild(h('p', null, [h('a', { href: m.link.href, target: '_blank', rel: 'noopener', text: m.link.text })]));
      if (m.note) li.appendChild(h('p', { class: 'note trnote' }, [icon(m.ai ? 'ai' : 'check'), h('span', { text: m.note })]));
      if (m.canTranslate) {
        var selId = 'tr' + uid();
        var sel = h('select', { id: selId });
        ['en', 'am', 'ar', 'om', 'ti', 'so'].forEach(function (l) { sel.appendChild(h('option', { value: l, lang: l, selected: l === m.lang, text: self._langName(l) })); });
        sel.addEventListener('change', safe(function () { self._translateMessage(m, li, sel.value, sel); }));
        li.appendChild(h('div', { class: 'trans' }, [h('label', { for: selId }, [icon('language'), h('span', { 'data-t': 'translateLabel', text: t.translateLabel })]), sel]));
        this._lastAnswer = { m: m, li: li };
      }
      if (m.role !== 'you') {
        var actions = h('div', { class: 'actions' });
        var listen = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false' }, iconText('listen', { 'data-t': 'listen', text: t.listen }));
        listen.addEventListener('click', safe(function () { self._listen(m, listen); }));
        actions.appendChild(listen);
        if (m.offerHelp) actions.appendChild(h('button', { type: 'button', class: 'btn primary', onclick: function () { self._escalate(); } }, iconText('talk', { 'data-t': 'talk', text: t.talk })));
        (m.extra || []).forEach(function (el) { actions.appendChild(el); });
        li.appendChild(actions);
      }
      this.$log.appendChild(li);
      if (this._mode === 'panel') {
        // Show the start of the new message, not the end of a long answer.
        var body = this.$body;
        body.scrollTo({ top: Math.max(0, li.offsetTop - body.offsetTop - 8), behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      return li;
    }

    /* links (SDS 1.4, FR-T5): scroll to the host section and move focus to its heading */
    _followSource(e, link) {
      var raw = link.getAttribute('href') || '';
      var tf = raw.indexOf('#:~:text=');
      if (tf >= 0) { this._followTextFragment(e, raw, tf); return; }
      var url = new URL(raw, document.baseURI);
      if (url.pathname !== location.pathname || !url.hash) return; // other page: normal navigation
      var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      // The starter puts each id on an empty, aria-hidden <a> inside the <h4>: focus the heading instead.
      // A job card (<article id>) holds its heading inside.
      var H = 'h1,h2,h3,h4,h5,h6';
      var heading = target.closest(H) || target.querySelector(H) || target;
      if (this._mode === 'panel' && this.$dialog.open && (MODAL_ALWAYS || this.$dialog.matches(':modal'))) this.close({ returnFocus: false });
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      heading.focus({ preventScroll: true });
      flashSection(heading, target);
      try { history.replaceState(null, '', url.hash); } catch (err) { /* sandboxed */ }
    }

    // Page sections whose heading has no id use "#:~:text=": find the heading by its text, then do the
    // same as for an id (SDS 1.4). Not found: let the browser navigate (it highlights the text itself).
    _followTextFragment(e, raw, at) {
      var path = new URL(raw.slice(0, at) || location.pathname, document.baseURI).pathname;
      if (path !== location.pathname) return;
      var want;
      try { want = decodeURIComponent(raw.slice(at + 9).split('&')[0].split(',')[0]).replace(/\s+/g, ' ').trim().toLowerCase(); } catch (err) { return; }
      if (!want) return;
      var heading = null, all = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
      for (var i = 0; i < all.length && !heading; i++) {
        if (all[i].closest('db-assistant')) continue;
        if (all[i].textContent.replace(/\s+/g, ' ').trim().toLowerCase().indexOf(want) === 0) heading = all[i];
      }
      if (!heading) return;
      e.preventDefault();
      if (this._mode === 'panel' && this.$dialog.open && (MODAL_ALWAYS || this.$dialog.matches(':modal'))) this.close({ returnFocus: false });
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      heading.focus({ preventScroll: true });
      flashSection(heading, heading);
    }

    /* human help (FR-H1, FR-H2) */
    _escalate() {
      var self = this, t = this._t;
      var payload = {
        conversation: this._history.slice(-20).map(function (m) {
          return { role: m.role === 'you' ? 'learner' : m.role === 'bot' ? 'assistant' : m.role, text: m.text, lang: m.lang };
        }),
        page_url: location.href, section: this._lastSection || null, language: this._lang
      };
      if (!this._apiBase() || !navigator.onLine) {
        this._enqueue({ type: 'escalate', payload: payload });
        this._addMessage({ role: 'bot', text: t.escalateQueued });
        return;
      }
      this._status(t.escalating);
      this.$talk.setAttribute('aria-busy', 'true');
      this._fetchJson('/v1/escalations', { method: 'POST', body: JSON.stringify(Object.assign({ conversation_id: this._sessionId }, payload)) }).then(function (res) {
        self.$talk.removeAttribute('aria-busy');
        self._ticketOpened(res);
      }).catch(function () {
        self.$talk.removeAttribute('aria-busy');
        self._enqueue({ type: 'escalate', payload: payload });
        self._addMessage({ role: 'bot', text: t.escalateQueued });
        self._setStatusNetwork();
      });
    }
    _ticketOpened(res) {
      var t = this._t, self = this;
      this._ticket = res.ticketId;
      this._ticketToken = res.token || '';
      this._afterId = 0;
      // FR-H2: say honestly what happens next, in words.
      this._status(res.helper_online ? t.escalatedOnline : t.escalatedLater);
      this._addMessage({ role: 'bot', emoji: '🙋', text: (res.helper_online ? t.escalatedOnline : t.escalatedLater) + '\n' + fmt(t.ticketNumber, { id: res.ticketId }),
        link: res.telegram_link ? { href: res.telegram_link, text: t.telegramOption } : null,
        extra: this._helpTools(),
        audio: this._lang === 'am' ? [res.helper_online ? 'phrases/escalatedOnline.am.mp3' : 'phrases/escalatedLater.am.mp3'] : [] });
      this._emit('escalated', { ticketId: res.ticketId });
      clearInterval(this._poll);
      this._poll = setInterval(function () { self._pollTicket(); }, POLL_MS);
    }
    _pollTicket() {
      var self = this;
      if (!this._ticket || !navigator.onLine || document.hidden) return;
      this._fetchJson('/v1/escalations/' + encodeURIComponent(this._ticket) + '/messages?after=' + this._afterId + '&token=' + encodeURIComponent(this._ticketToken || '')).then(function (list) {
        (list || []).forEach(function (m) {
          self._afterId = Math.max(self._afterId, m.id || 0);
          if (m.author === 'system' && m.text === 'screen_request') {
            self._addMessage({ role: 'bot', text: self._t.shareAsked, extra: self._helpTools() });
            return;
          }
          if (m.author !== 'helper') return;
          if (!self._helperName) { self._helperName = m.name || self._t.tutor; self._status(fmt(self._t.tutorJoined, { name: self._helperName })); }
          self._addMessage({ role: 'tutor', name: m.name, text: m.text, lang: m.lang || undefined });
        });
      }).catch(function () { /* keep polling quietly */ });
    }

    /* screen share (desktop) and screenshot (Android fallback) (FR-H4, FR-H5) */
    _helpTools() {
      var self = this, t = this._t, tools = [];
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        tools.push(h('button', { type: 'button', class: 'btn', onclick: function () { self._startShare(); } }, iconText('share', { text: t.shareScreen })));
      }
      var file = h('input', { type: 'file', accept: 'image/*' });
      file.addEventListener('change', safe(function () { if (file.files && file.files[0]) self._sendScreenshot(file.files[0]); file.value = ''; }));
      tools.push(h('label', { class: 'btn filebtn' }, [icon('screenshot'), h('span', { text: t.sendScreenshot }), file]));
      return tools;
    }
    _ticketPath(suffix) {
      return '/v1/escalations/' + encodeURIComponent(this._ticket) + suffix + (suffix.indexOf('?') < 0 ? '?' : '&') + 'token=' + encodeURIComponent(this._ticketToken || '');
    }
    _toJpeg(source, w, hgt, max) {
      var scale = Math.min(1, max / Math.max(w, hgt));
      var c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(hgt * scale);
      c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
      return c;
    }
    _sendScreenshot(fileObj) {
      var self = this, t = this._t;
      if (!this._ticket) return;
      if (fileObj.size > 8 * 1024 * 1024) { this._status(t.screenshotTooBig); return; }
      var img = new Image(), url = URL.createObjectURL(fileObj);
      img.onload = function () {
        var data = self._toJpeg(img, img.naturalWidth, img.naturalHeight, 1280).toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        self._fetchJson(self._ticketPath('/screenshot'), { method: 'POST', body: JSON.stringify({ screenshot: data }) })
          .then(function () { self._status(t.screenshotSent); })
          .catch(function (err) { self._status(err && err.status === 400 ? t.screenshotTooBig : t.screenshotFailed); });
      };
      img.onerror = function () { self._status(t.screenshotTooBig); };
      img.src = url;
    }
    _startShare() {
      var self = this, t = this._t;
      if (this._sharing || !this._ticket) return;
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (stream) {
        var video = document.createElement('video');
        video.muted = true; video.srcObject = stream; video.play();
        self._sharing = { stream: stream, video: video };
        stream.getVideoTracks()[0].addEventListener('ended', function () { self._stopShare(); });
        self.$share.hidden = false;
        self._status(t.sharing);
        self.$shareStop.focus();
        var send = function () {
          if (!self._sharing || !video.videoWidth) return;
          self._toJpeg(video, video.videoWidth, video.videoHeight, 1280).toBlob(function (blob) {
            if (!blob || !self._sharing) return;
            fetch(self._apiBase() + self._ticketPath('/screen'), { method: 'POST', headers: self._keyed({ 'Content-Type': 'image/jpeg' }), body: blob }).catch(function () {});
          }, 'image/jpeg', 0.6);
        };
        self._sharing.timer = setInterval(send, 2000);
      }).catch(function (err) {
        // NotAllowedError = the learner cancelled the browser's picker: nothing to say.
        if (!err || err.name !== 'NotAllowedError') self._status(t.shareFailed);
      });
    }
    _stopShare() {
      if (!this._sharing) return;
      clearInterval(this._sharing.timer);
      this._sharing.stream.getTracks().forEach(function (tr) { tr.stop(); });
      this._sharing = null;
      this.$share.hidden = true;
      this._status(this._t.shareStopped);
      this.$q.focus();
    }

    /* learner data: export and delete (NFR-S4) */
    _exportData() {
      var self = this;
      var local = { conversation_id: this._sessionId, on_this_phone: this._history };
      var save = function (server) {
        var blob = new Blob([JSON.stringify(Object.assign(local, { on_the_server: server }), null, 2)], { type: 'application/json' });
        var a = h('a', { href: URL.createObjectURL(blob), download: 'syly-my-data.json' });
        self.shadowRoot.appendChild(a); a.click(); a.remove();
      };
      if (!this._apiBase()) { save(null); return; }
      this._fetchJson('/v1/data/' + encodeURIComponent(this._sessionId)).then(save).catch(function () { save(null); });
    }
    _deleteData() {
      var self = this, old = this._sessionId;
      var finish = function (serverFailed) {
        self._history = [];
        self.$log.textContent = '';
        self.$intro.hidden = false;
        self._ticket = null; clearInterval(self._poll);
        save('queue', []);
        self._sessionId = uid(); save('cid', self._sessionId);
        self._status(serverFailed === true ? self._t.dataDeleteFailed : self._t.dataDeleted);
      };
      if (!this._apiBase()) { finish(); return; }
      this._fetchJson('/v1/data/' + encodeURIComponent(old), { method: 'DELETE' })
        .then(function () { finish(false); }, function () { finish(true); });
    }

    /* interview support request (FR-J4): one question per step, review, then a person */
    _accStart(job) {
      this._acc = { job: job, step: 1, needs: [], note: '', channel: 'none', contact: '', error: '' };
      this.$intro.hidden = true;
      this.$acc.hidden = false;
      this._accRender();
    }
    _accClose(message) {
      this.$acc.hidden = true;
      this.$acc.textContent = '';
      this._acc = null;
      if (message) this._addMessage({ role: 'bot', emoji: '✅', text: message });
      this.$q.focus();
    }
    _accRender() {
      var self = this, t = this._t, st = this._acc, form = this.$acc;
      var NEEDS = ['interpreter', 'extra_time', 'written_questions', 'accessible_venue', 'other'];
      var CHANNELS = ['none', 'telegram', 'sms', 'email'];
      form.textContent = '';
      var title = h('h3', { id: 'acc-title', tabindex: '-1' }, [emoji('🤝'), h('span', { text: t.accTitle })]);
      form.appendChild(title);
      form.appendChild(h('p', { text: fmt(t.accFor, { title: st.job.title || st.job.id || '' }) }));
      form.appendChild(h('p', { class: 'note', text: fmt(t.accStep, { n: st.step, total: 4 }) }));
      var err = h('p', { id: 'acc-err', class: 'error', role: 'alert', text: st.error || '' });
      var buttons = h('div', { class: 'actions' });
      var ICON_FOR = { accCancel: 'close', accNext: 'next', accBack: 'back', accSend: 'send' };
      var btn = function (key, primary, fn) {
        return h('button', { type: 'button', class: 'btn' + (primary ? ' primary' : ''), onclick: fn },
          iconText(ICON_FOR[key], { text: t[key] }, key === 'accNext' || key === 'accBack' || key === 'accSend' ? 'flip' : ''));
      };
      var go = function (step) { st.error = ''; st.step = step; self._accRender(); };

      if (st.step === 1) {
        var fs = h('fieldset', { 'aria-describedby': 'acc-hint' + (st.error ? ' acc-err' : '') }, [h('legend', { text: t.accQ1 }), h('p', { id: 'acc-hint', class: 'note', text: t.accHint1 })]);
        NEEDS.forEach(function (k) {
          var box = h('input', { type: 'checkbox', value: k, checked: st.needs.indexOf(k) >= 0 });
          box.addEventListener('change', function () {
            st.needs = NEEDS.filter(function (x) { return x === k ? box.checked : st.needs.indexOf(x) >= 0; });
          });
          fs.appendChild(h('label', { class: 'check' }, [box, h('span', { text: t['need_' + k] })]));
        });
        form.appendChild(fs);
        buttons.appendChild(btn('accCancel', false, function () { self._accClose(); }));
        buttons.appendChild(btn('accNext', true, function () {
          if (!st.needs.length) { st.error = t.accChooseOne; self._accRender(); return; }
          go(2);
        }));
      } else if (st.step === 2) {
        var note = h('textarea', { id: 'acc-note', rows: '3' });
        note.value = st.note;
        note.addEventListener('input', function () { st.note = note.value; });
        form.appendChild(h('label', { for: 'acc-note', text: t.accQ2 }));
        form.appendChild(note);
        buttons.appendChild(btn('accBack', false, function () { go(1); }));
        buttons.appendChild(btn('accNext', true, function () { go(3); }));
      } else if (st.step === 3) {
        var fs3 = h('fieldset', st.error ? { 'aria-describedby': 'acc-err' } : null, [h('legend', { text: t.accQ3 })]);
        var contact = h('input', { type: 'text', id: 'acc-contact', autocomplete: 'off', 'aria-invalid': st.error ? 'true' : null, 'aria-describedby': st.error ? 'acc-err' : null });
        contact.value = st.contact;
        contact.addEventListener('input', function () { st.contact = contact.value; });
        var contactWrap = h('div', { hidden: st.channel === 'none' }, [h('label', { for: 'acc-contact', text: t.accContact }), contact]);
        CHANNELS.forEach(function (k) {
          var r = h('input', { type: 'radio', name: 'acc-channel', value: k, checked: st.channel === k });
          r.addEventListener('change', function () { st.channel = k; contactWrap.hidden = k === 'none'; });
          fs3.appendChild(h('label', { class: 'check' }, [r, h('span', { text: t['copy_' + k] })]));
        });
        form.appendChild(fs3);
        form.appendChild(contactWrap);
        buttons.appendChild(btn('accBack', false, function () { go(2); }));
        buttons.appendChild(btn('accNext', true, function () {
          if (st.channel !== 'none' && !st.contact.trim()) { st.error = t.accNeedContact; self._accRender(); contact = self.$acc.querySelector('#acc-contact'); if (contact) contact.focus(); return; }
          go(4);
        }));
      } else {
        form.appendChild(h('h4', { text: t.accReview }));
        form.appendChild(h('dl', null, [
          h('dt', { text: t.accNeeds }), h('dd', { text: st.needs.map(function (k) { return t['need_' + k]; }).join(', ') }),
          h('dt', { text: t.accNote }), h('dd', { text: st.note.trim() || t.accNone }),
          h('dt', { text: t.accCopy }), h('dd', { text: t['copy_' + st.channel] + (st.channel !== 'none' ? ': ' + st.contact : '') })
        ]));
        buttons.appendChild(btn('accBack', false, function () { go(3); }));
        buttons.appendChild(btn('accSend', true, function () { self._accSend(); }));
      }
      form.appendChild(err);
      form.appendChild(buttons);
      if (!(st.step === 3 && st.error)) title.focus();
    }
    _accSend() {
      var self = this, st = this._acc;
      if (!this._apiBase()) { st.error = this._t.accFailed; this._accRender(); return; }
      this._fetchJson('/v1/accommodations', { method: 'POST', body: JSON.stringify({
        job_id: st.job.id, needs: st.needs, note: st.note.trim() || null,
        contact_channel: st.channel, contact: st.channel === 'none' ? null : st.contact.trim(), language: this._lang
      }) }).then(function () { self._accClose(self._t.accSent); })
        .catch(function () { st.error = self._t.accFailed; self._accRender(); });
    }

    /* offline queue (FR-C5) */
    _enqueue(item) { var q = load('queue', []); q.push(item); save('queue', q); }
    _online() { this._setStatusNetwork(); this._flushQueue(); }
    _flushQueue() {
      var self = this, q = load('queue', []);
      if (!q.length || !navigator.onLine || !this._apiBase()) return;
      save('queue', []);
      q.forEach(function (item) {
        if (item.type === 'ask') self._ask(item.text, true);
        if (item.type === 'escalate') {
          self._fetchJson('/v1/escalations', { method: 'POST', body: JSON.stringify(item.payload) })
            .then(function (res) { self._ticketOpened(res); })
            .catch(function () { self._enqueue(item); });
        }
      });
      this._status(this._t.queuedSent);
    }

    /* voice: input (FR-T7) */
    _toggleMic() {
      if (this._recognizer || this._recording) { this._stopMic(); return; }
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
      var route = micRoute(this._lang, !!SR, canRecord, !!this._apiBase());
      if (route === 'browser') this._micBrowser(SR);
      else if (route === 'server') this._micServer();
      else this._status(this._t.micUnsupported);
    }
    _micReset() {
      this.$mic.setAttribute('aria-pressed', 'false');
      this._setBtn(this.$mic, 'mic', 'mic');
    }
    _micBrowser(SR) {
      var self = this, rec = new SR(), base = this.$q.value ? this.$q.value.trim() + ' ' : '', retried = false;
      rec.lang = BROWSER_STT[this._lang] || this._t.speechLang || 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = function (e) {
        var text = '';
        for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        self.$q.value = base + text;
      };
      rec.onerror = function (e) {
        var code = e && e.error;
        // This browser cannot do this language (or cannot reach its service): the server can, if the learner allowed it.
        if (browserCannot(code) && self._apiBase() && window.MediaRecorder && !retried) { retried = true; self._retryOnServer = true; return; }
        var denied = code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture';
        self._status(denied ? self._t.micDenied : self._t.micError);
      };
      rec.onend = function () {
        self._recognizer = null;
        self._micReset();
        if (self._retryOnServer) { self._retryOnServer = false; self._micServer(); return; }
        if (self.$q.value.trim()) self._status(self._t.micDone);
        self.$q.focus();
      };
      try { rec.start(); } catch (err) { this._status(this._t.micError); return; }
      this._recognizer = rec;
      this.$mic.setAttribute('aria-pressed', 'true');
      this._setBtn(this.$mic, 'stop', 'micStop');
      this._status(this._t.micListening);
    }
    // Record, then send to the server's speech to text. Audio leaves the phone, so only with consent (NFR-S2).
    _micServer() {
      var self = this, t = this._t;
      if (this._consent !== 'yes') { this._status(t.micNeedsConsent); return; }
      if (!navigator.onLine) { this._status(t.micError); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var rec = new MediaRecorder(stream), chunks = [], timer = null;
        var release = function () { stream.getTracks().forEach(function (tr) { tr.stop(); }); };
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = function () { release(); clearTimeout(timer); self._recording = null; self._micReset(); self._status(t.micError); };
        rec.onstop = function () {
          release(); clearTimeout(timer);
          self._recording = null;
          self._micReset();
          if (!chunks.length) { self._status(t.micError); self.$q.focus(); return; }
          self._transcribe(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        };
        rec.start();
        timer = setTimeout(function () { if (rec.state === 'recording') rec.stop(); }, RECORD_MAX_MS);
        self._recording = rec;
        self.$mic.setAttribute('aria-pressed', 'true');
        self._setBtn(self.$mic, 'stop', 'micStop');
        self._status(t.micRecording);
      }).catch(function () { self._status(t.micDenied); });
    }
    _transcribe(blob) {
      var self = this, t = this._t, base = this.$q.value ? this.$q.value.trim() + ' ' : '';
      var form = new FormData();
      form.append('file', blob, 'voice.' + (/mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm'));
      form.append('language', this._lang);
      this._status(t.micTranscribing);
      fetch(this._apiBase() + '/v1/voice/transcribe', { method: 'POST', headers: this._keyed({}), body: form })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (res) {
          var text = res && res.text ? String(res.text).trim() : '';
          if (!text) { self._status(t.micServerFailed); self.$q.focus(); return; }
          self.$q.value = base + text; // not sent: the learner checks it first
          self._status(t.micDone);
          self.$q.focus();
        })
        .catch(function () { self._status(t.micServerFailed); self.$q.focus(); });
    }
    _stopMic() {
      if (this._recognizer) { try { this._recognizer.stop(); } catch (e) { /* already stopped */ } }
      if (this._recording) { try { this._recording.stop(); } catch (e) { /* already stopped */ } }
    }

    /* voice: output (FR-T8) pre-generated audio -> system voice -> server TTS -> text only */
    _stopVoice() {
      this._stopMic();
      if (this._audio) { this._audio.pause(); this._audio = null; }
      if (window.speechSynthesis) speechSynthesis.cancel();
      if (this._listenBtn) { this._listenBtn.setAttribute('aria-pressed', 'false'); this._setBtn(this._listenBtn, 'listen', 'listen'); this._listenBtn = null; }
    }
    _listen(m, btn) {
      var self = this, t = this._t;
      if (this._listenBtn === btn) { this._stopVoice(); return; }
      this._stopVoice();
      this._listenBtn = btn;
      btn.setAttribute('aria-pressed', 'true');
      this._setBtn(btn, 'stop', 'stopListening');
      var done = function () { if (self._listenBtn === btn) self._stopVoice(); };
      var fail = function () { done(); self._status(m.lang === 'am' ? t.noVoiceAm : t.noVoice); };
      var playUrl = function (url, onError) {
        var a = new Audio(url), failed = false;
        var once = function () { if (failed || self._audio !== a) return; failed = true; self._audio = null; onError(); };
        self._audio = a;
        a.onended = done;
        a.onerror = once;
        a.play().catch(once);
      };
      var speakSystem = function () {
        var voice = findVoice(m.lang);
        if (!voice) return false;
        var u = new SpeechSynthesisUtterance(m.text);
        u.lang = voice.lang; u.voice = voice;
        u.onend = done; u.onerror = done;
        speechSynthesis.speak(u);
        return true;
      };
      var system = function () { if (!speakSystem()) fail(); };
      var server = function () {
        // Server TTS sends text to an online voice service: only with consent (NFR-S2).
        if (!self._apiBase() || !navigator.onLine || self._consent !== 'yes') { system(); return; }
        fetch(self._apiBase() + '/v1/voice/speak', { method: 'POST', headers: self._keyed({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ text: m.text, language: m.lang }) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
          .then(function (b) { if (self._listenBtn === btn) playUrl(URL.createObjectURL(b), system); })
          .catch(system);
      };
      // Order (FR-T8): saved audio files -> server voice (with consent) -> browser voice -> words.
      var files = (Array.isArray(m.audio) ? m.audio : (m.audio ? [m.audio] : [])).map(function (a) { return new URL('audio/' + a, SCRIPT_URL).href; });
      var playList = function (i) {
        if (i >= files.length) { done(); return; }
        var a = new Audio(files[i]), failed = false;
        var bad = function () { if (failed || self._audio !== a) return; failed = true; self._audio = null; server(); };
        self._audio = a;
        a.onended = function () { if (self._audio === a) playList(i + 1); };
        a.onerror = bad;
        a.play().catch(bad);
      };
      if (files.length) playList(0); else server();
    }
  }

  function findVoice(lang) {
    if (!window.speechSynthesis) return null;
    var voices = speechSynthesis.getVoices() || [];
    for (var i = 0; i < voices.length; i++) if (voices[i].lang && voices[i].lang.toLowerCase().indexOf(lang) === 0) return voices[i];
    return null;
  }
  if (window.speechSynthesis) speechSynthesis.getVoices(); // warm up the async voice list

  /* ----------------------------------------------------------------- dates */
  // Ethiopian calendar for Amharic (NFR-E3), Gregorian otherwise.
  function formatDate(iso, lang) {
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    try {
      var opts = { day: 'numeric', month: 'long', year: 'numeric' };
      if (lang === 'am') return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', opts).format(d) + ' (' + new Intl.DateTimeFormat('am-ET', opts).format(d) + ')';
      return new Intl.DateTimeFormat(lang, opts).format(d);
    } catch (e) { return iso; }
  }
  function formatTime(d, lang) {
    try { return new Intl.DateTimeFormat(lang === 'am' ? 'am-ET' : lang, { hour: '2-digit', minute: '2-digit' }).format(d); } catch (e) { return d.toTimeString().slice(0, 5); }
  }

  // Exposed for tests only through the element class (no globals).
  DbAssistant._internals = { parseLangRequest: parseLangRequest, readPage: readPage, pageRoot: pageRoot, decidePageReading: decidePageReading, pageToIndex: pageToIndex, textFragment: textFragment, formatDate: formatDate, Index: Index, splitSentences: splitSentences, detectLang: detectLang, NO_ADVICE: NO_ADVICE, parseColor: parseColor, contrast: contrast, applySite: applySite, micRoute: micRoute, browserCannot: browserCannot, BROWSER_STT: BROWSER_STT, I18N: I18N };
  customElements.define('db-assistant', DbAssistant);
})();
