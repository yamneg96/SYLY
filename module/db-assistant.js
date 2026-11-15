/**
 * SYLY Assistant - Web Component (<db-assistant>)
 * File: module/db-assistant.js
 *
 * Single-file, zero-dependency vanilla JavaScript custom element.
 * Compliant with WCAG 2.2 AA accessibility guidelines.
 *
 * Implements:
 * - Open Shadow DOM with encapsulated layout and styling.
 * - Dual layout modes: 'panel' (modal < 900px, docked >= 900px) and 'inline'.
 * - Accessible message log (<ol role="log" aria-live="polite">).
 * - ChatGPT-style composer (auto-growing textarea, Mic button with aria-pressed, Send).
 * - JavaScript runtime contrast check for host CSS vars (--bs-primary vs #FFFFFF >= 4.5:1).
 * - Inline fallback i18n dictionaries for 'en', 'am', and 'ar' with dynamic external fetch.
 * - Shadow DOM citation links with focus-safe host navigation.
 * - Character 3-gram bilingual search fallback.
 */

(function () {
  'use strict';

  // Capture script base URL for resolving relative assets (i18n, audio)
  const CURRENT_SCRIPT_SRC = (function () {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.includes('db-assistant.js')) {
        return scripts[i].src;
      }
    }
    return window.location.href;
  })();

  // Inlined fallback dictionaries (en, am, ar)
  const I18N_DICTIONARIES = {
    en: {
      launcher: 'Ask SYLY',
      title: 'SYLY Tutor & Assistant',
      close: 'Close assistant panel',
      languageLabel: 'Select language',
      inputPlaceholder: 'Ask a question about this lesson...',
      askInputLabel: 'Your question',
      micLabel: 'Voice input (Speech to text)',
      sendLabel: 'Send your question',
      talkToPerson: 'Talk to a person',
      sources: 'Sources',
      listen: 'Listen',
      online: 'Online',
      offline: 'Offline',
      queued: 'Saved on this phone. It will send when you are online.',
      notFound: 'I could not find this in the course. Would you like to talk to a person?',
      escalatedNotice: 'A tutor has been notified. You are in the queue for live assistance.',
      you: 'You',
      assistant: 'SYLY Tutor',
      simpleMode: 'Simple mode',
      statusReady: 'Ready for questions',
      skipToPanel: 'Skip to assistant'
    },
    am: {
      launcher: 'ጠይቅ',
      title: 'ሲሊ ረዳት እና አስተማሪ',
      close: 'ረዳቱን ዝጋ',
      languageLabel: 'ቋንቋ ይምረጡ',
      inputPlaceholder: 'ስለዚህ ትምህርት ጥያቄ ይጠይቁ...',
      askInputLabel: 'የእርስዎ ጥያቄ',
      micLabel: 'በድምጽ ይናገሩ',
      sendLabel: 'ጥያቄውን ላክ',
      talkToPerson: 'ከሰው ጋር ይነጋገሩ',
      sources: 'ምንጮች',
      listen: 'አዳምጥ',
      online: 'መስመር ላይ',
      offline: 'ከመስመር ውጭ',
      queued: 'በዚህ ስልክ ላይ ተቀምጧል። መስመር ላይ ሲሆኑ ይላካል።',
      notFound: 'ይህንን በትምህርቱ ውስጥ ማግኘት አልቻልኩም። ከሰው ጋር መነጋገር ይፈልጋሉ?',
      escalatedNotice: 'ለአስተማሪ ማሳወቂያ ተልኳል፤ በቅርቡ ያነጋግሩዎታል።',
      you: 'እርስዎ',
      assistant: 'ሲሊ አስተማሪ',
      simpleMode: 'ቀላል ሁነታ',
      statusReady: 'ጥያቄ ለመቀበል ዝግጁ ነው',
      skipToPanel: 'ወደ ረዳቱ ይዝለሉ'
    },
    ar: {
      launcher: 'اسأل سيلي',
      title: 'مساعد سيلي التعليمي',
      close: 'إغلاق نافذة المساعد',
      languageLabel: 'اختر اللغة',
      inputPlaceholder: 'اطرح سؤالاً حول هذا الدرس...',
      askInputLabel: 'سؤالك',
      micLabel: 'إدخال صوتي',
      sendLabel: 'إرسال السؤال',
      talkToPerson: 'تحدث إلى شخص',
      sources: 'المصادر',
      listen: 'استمع',
      online: 'متصل',
      offline: 'غير متصل',
      queued: 'تم الحفظ على هذا الهاتف. سيتم الإرسال فور اتصالك بالإنترنت.',
      notFound: 'لم أتمكن من العثور على هذا في الدرس. هل ترغب في التحدث إلى معلم؟',
      escalatedNotice: 'تم إخطار المعلم وطلب المساعدة المباشرة.',
      you: 'أنت',
      assistant: 'معلم سيلي',
      simpleMode: 'الوضع البسيط',
      statusReady: 'جاهز للإجابة على الأسئلة',
      skipToPanel: 'الانتقال إلى المساعد'
    }
  };

  /**
   * Color and WCAG 2.2 contrast utilities
   */
  function parseCssColor(colorString) {
    if (!colorString) return null;
    const str = colorString.trim();

    // Hex syntax
    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      if (hex.length >= 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    // rgb/rgba syntax
    const rgbMatch = str.match(/rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (rgbMatch) {
      return [
        Math.round(parseFloat(rgbMatch[1])),
        Math.round(parseFloat(rgbMatch[2])),
        Math.round(parseFloat(rgbMatch[3]))
      ];
    }

    // Computed style fallback for named colors/hsl
    try {
      const probe = document.createElement('div');
      probe.style.color = str;
      probe.style.display = 'none';
      (document.body || document.documentElement).appendChild(probe);
      const computed = window.getComputedStyle(probe).color;
      probe.remove();
      const match = computed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (match) {
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
      }
    } catch (_) {}

    return null;
  }

  function getChannelLuminance(value) {
    const norm = value / 255;
    return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  }

  function getRelativeLuminance(r, g, b) {
    return 0.2126 * getChannelLuminance(r) +
           0.7152 * getChannelLuminance(g) +
           0.0722 * getChannelLuminance(b);
  }

  function getContrastRatio(rgb1, rgb2) {
    const l1 = getRelativeLuminance(...rgb1);
    const l2 = getRelativeLuminance(...rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Character 3-Gram generator for Amharic bilingual retrieval
   */
  function extractCharacter3Grams(text) {
    if (!text) return new Set();
    const clean = text.toLowerCase().replace(/[^\w\u1200-\u137F]/g, '');
    const grams = new Set();
    if (clean.length < 3) {
      if (clean.length > 0) grams.add(clean);
      return grams;
    }
    for (let i = 0; i <= clean.length - 3; i++) {
      grams.add(clean.slice(i, i + 3));
    }
    return grams;
  }

  function calculateDiceOverlap(setA, setB) {
    if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0;
    let overlap = 0;
    for (const item of setA) {
      if (setB.has(item)) overlap++;
    }
    return (2 * overlap) / (setA.size + setB.size);
  }

  class DbAssistant extends HTMLElement {
    static get observedAttributes() {
      return ['lang', 'mode', 'theme', 'position', 'content', 'api'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });

      // State
      this.messages = [];
      this.isModal = false;
      this.isOpenState = false;
      this.contentData = null;
      this.speechRecognition = null;
      this.isRecognizing = false;

      // Bind handlers
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.handleFormSubmit = this.handleFormSubmit.bind(this);
      this.handleMicToggle = this.handleMicToggle.bind(this);
      this.handleEscalate = this.handleEscalate.bind(this);
      this.handleSourceClick = this.handleSourceClick.bind(this);
    }

    // Properties mapped to attributes
    get lang() {
      return this.getAttribute('lang') || 'en';
    }
    set lang(value) {
      this.setAttribute('lang', value);
    }

    get mode() {
      return this.getAttribute('mode') || 'panel';
    }
    set mode(value) {
      this.setAttribute('mode', value);
    }

    get theme() {
      return this.getAttribute('theme') || 'auto';
    }
    set theme(value) {
      this.setAttribute('theme', value);
    }

    get position() {
      return this.getAttribute('position') || 'end';
    }
    set position(value) {
      this.setAttribute('position', value);
    }

    get api() {
      return this.getAttribute('api') || '';
    }
    set api(value) {
      this.setAttribute('api', value);
    }

    get content() {
      return this.getAttribute('content') || '';
    }
    set content(value) {
      this.setAttribute('content', value);
    }

    connectedCallback() {
      this.render();
      this.loadI18n(this.lang);
      this.resolveThemeColor();
      this.fetchContentData();
      this.setupSpeechRecognition();

      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('resize', this.handleResize);
    }

    disconnectedCallback() {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('resize', this.handleResize);
      if (this.speechRecognition) {
        try { this.speechRecognition.abort(); } catch (_) {}
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.shadowRoot) return;

      if (name === 'lang') {
        this.loadI18n(newValue).then(() => this.updateLocalizedStrings());
      } else if (name === 'mode') {
        this.render();
      } else if (name === 'theme') {
        this.resolveThemeColor();
      } else if (name === 'content') {
        this.fetchContentData();
      }
    }

    /**
     * Contrast check: probes --bs-primary and validates >= 4.5:1 against #FFFFFF.
     * Fallback: #002B56 (ratio against white is ~14:1).
     */
    resolveThemeColor() {
      const FALLBACK_COLOR = '#002B56';
      const WHITE_RGB = [255, 255, 255];
      let primaryColor = FALLBACK_COLOR;

      try {
        const computed = window.getComputedStyle(this);
        const hostPrimary = computed.getPropertyValue('--bs-primary').trim();
        if (hostPrimary) {
          const parsedRgb = parseCssColor(hostPrimary);
          if (parsedRgb) {
            const contrast = getContrastRatio(parsedRgb, WHITE_RGB);
            if (contrast >= 4.5) {
              primaryColor = hostPrimary;
            } else {
              console.warn(`[db-assistant] Host --bs-primary (${hostPrimary}) contrast against white is ${contrast.toFixed(2)}:1 (< 4.5:1). Falling back to ${FALLBACK_COLOR}.`);
            }
          }
        }
      } catch (err) {
        primaryColor = FALLBACK_COLOR;
      }

      this.style.setProperty('--db-primary', primaryColor);
    }

    /**
     * Loads external i18n JSON relative to script origin, falling back to inlined dictionary.
     */
    async loadI18n(lang) {
      if (!I18N_DICTIONARIES[lang]) {
        I18N_DICTIONARIES[lang] = { ...I18N_DICTIONARIES.en };
      }

      if (CURRENT_SCRIPT_SRC) {
        try {
          const url = new URL(`i18n/${lang}.json`, CURRENT_SCRIPT_SRC).href;
          const res = await fetch(url);
          if (res.ok) {
            const externalDict = await res.json();
            I18N_DICTIONARIES[lang] = { ...I18N_DICTIONARIES[lang], ...externalDict };
          }
        } catch (_) {
          // Gracefully fallback to inline dictionary
        }
      }
      return I18N_DICTIONARIES[lang];
    }

    getTranslations() {
      return I18N_DICTIONARIES[this.lang] || I18N_DICTIONARIES.en;
    }

    async fetchContentData() {
      if (!this.content) return;
      try {
        const res = await fetch(this.content);
        if (res.ok) {
          this.contentData = await res.json();
        }
      } catch (err) {
        console.warn('[db-assistant] Could not load content JSON:', err);
      }
    }

    setupSpeechRecognition() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) return;

      try {
        this.speechRecognition = new SpeechRec();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = true;

        this.speechRecognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          const textarea = this.shadowRoot.getElementById('q');
          if (textarea) {
            textarea.value = transcript;
            this.adjustTextareaHeight(textarea);
          }
        };

        this.speechRecognition.onend = () => {
          this.setMicActive(false);
        };

        this.speechRecognition.onerror = () => {
          this.setMicActive(false);
        };
      } catch (_) {}
    }

    setMicActive(active) {
      this.isRecognizing = active;
      const micBtn = this.shadowRoot.getElementById('mic-btn');
      if (micBtn) {
        micBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        micBtn.classList.toggle('active', active);
      }
    }

    handleMicToggle() {
      if (!this.speechRecognition) {
        alert('Speech recognition is not supported in this browser.');
        return;
      }

      if (this.isRecognizing) {
        this.speechRecognition.stop();
        this.setMicActive(false);
      } else {
        this.speechRecognition.lang = this.lang === 'am' ? 'am-ET' : (this.lang === 'ar' ? 'ar-SA' : 'en-US');
        try {
          this.speechRecognition.start();
          this.setMicActive(true);
        } catch (_) {
          this.setMicActive(false);
        }
      }
    }

    /**
     * Public Methods
     */
    open() {
      if (this.mode === 'inline') {
        const textarea = this.shadowRoot.getElementById('q');
        if (textarea) textarea.focus();
        return;
      }

      const panel = this.shadowRoot.getElementById('panel');
      const launcher = this.shadowRoot.getElementById('launcher');
      if (!panel) return;

      const isMobile = window.innerWidth < 900;
      if (isMobile) {
        panel.showModal();
        this.isModal = true;
      } else {
        panel.show();
        this.isModal = false;
      }

      if (launcher) launcher.hidden = true;
      this.isOpenState = true;

      const textarea = this.shadowRoot.getElementById('q');
      if (textarea) {
        setTimeout(() => textarea.focus(), 50);
      }
    }

    close(options = { returnFocus: true }) {
      if (this.mode === 'inline') return;

      const panel = this.shadowRoot.getElementById('panel');
      const launcher = this.shadowRoot.getElementById('launcher');
      if (panel && this.isOpen()) {
        panel.close();
      }

      if (launcher) launcher.hidden = false;
      this.isOpenState = false;
      this.isModal = false;

      if (options.returnFocus && launcher) {
        launcher.focus();
      }
    }

    isOpen() {
      if (this.mode === 'inline') return true;
      const panel = this.shadowRoot.getElementById('panel');
      return Boolean(panel && panel.open);
    }

    handleKeyDown(event) {
      if (event.key === 'Escape' && this.mode === 'panel' && this.isOpen()) {
        event.preventDefault();
        this.close({ returnFocus: true });
      }
    }

    handleResize() {
      if (this.mode !== 'panel' || !this.isOpen()) return;

      const panel = this.shadowRoot.getElementById('panel');
      if (!panel) return;

      const shouldBeModal = window.innerWidth < 900;
      if (shouldBeModal !== this.isModal) {
        const activeEl = this.shadowRoot.activeElement;
        panel.close();
        if (shouldBeModal) {
          panel.showModal();
          this.isModal = true;
        } else {
          panel.show();
          this.isModal = false;
        }
        if (activeEl && typeof activeEl.focus === 'function') {
          activeEl.focus();
        }
      }
    }

    adjustTextareaHeight(textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 120;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }

    handleFormSubmit(event) {
      if (event) event.preventDefault();
      const textarea = this.shadowRoot.getElementById('q');
      if (!textarea) return;

      const questionText = textarea.value.trim();
      if (!questionText) return;

      textarea.value = '';
      this.adjustTextareaHeight(textarea);
      this.ask(questionText);
    }

    /**
     * Submits a question, dispatches event, and queries offline or online retrieval
     */
    async ask(questionText) {
      const t = this.getTranslations();

      // Append user message
      this.addMessage({
        sender: 'user',
        senderLabel: t.you,
        text: questionText,
        lang: this.lang
      });

      // Dispatch custom question event
      this.dispatchEvent(new CustomEvent('db-assistant:question', {
        detail: { text: questionText, language: this.lang },
        bubbles: true,
        composed: true
      }));

      this.setStatus(t.statusReady);

      // Retrieval strategy
      if (this.api) {
        try {
          const res = await fetch(`${this.api}/v1/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: questionText, language: this.lang })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.answer) {
              this.addMessage({
                sender: 'assistant',
                senderLabel: t.assistant,
                text: data.answer,
                sources: data.sources || [],
                lang: this.lang
              });
              return;
            }
          }
        } catch (err) {
          console.warn('[db-assistant] Online API call failed, falling back to local search.');
        }
      }

      // Offline bilingual retrieval
      const localResult = this.searchLocalContent(questionText);
      if (localResult) {
        this.addMessage({
          sender: 'assistant',
          senderLabel: t.assistant,
          text: localResult.text,
          sources: localResult.sources,
          lang: this.lang
        });
      } else {
        this.addMessage({
          sender: 'assistant',
          senderLabel: t.assistant,
          text: t.notFound,
          sources: [],
          isNotFound: true,
          lang: this.lang
        });
      }
    }

    /**
     * Local character 3-gram and token BM25 bilingual search
     */
    searchLocalContent(query) {
      if (!this.contentData) return null;
      const sections = Array.isArray(this.contentData) ? this.contentData : (this.contentData.sections || []);
      if (!sections.length) return null;

      const isEthiopic = /[\u1200-\u137F]/.test(query);
      let bestSection = null;
      let highestScore = 0;

      if (isEthiopic) {
        const queryGrams = extractCharacter3Grams(query);
        for (const sec of sections) {
          const textGrams = extractCharacter3Grams((sec.title_am || '') + ' ' + (sec.text_am || ''));
          const kwGrams = extractCharacter3Grams((sec.keywords_am || []).join(' '));
          const textScore = calculateDiceOverlap(queryGrams, textGrams);
          const kwScore = calculateDiceOverlap(queryGrams, kwGrams) * 1.5;
          const score = textScore + kwScore;

          if (score > highestScore) {
            highestScore = score;
            bestSection = sec;
          }
        }
        if (highestScore < 0.25) return null;
      } else {
        const queryTokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const sec of sections) {
          let score = 0;
          const title = (sec.title_en || sec.title || '').toLowerCase();
          const body = (sec.text_en || sec.text || '').toLowerCase();
          const keywords = (sec.keywords_en || sec.keywords || []).map(k => k.toLowerCase());

          for (const token of queryTokens) {
            if (title.includes(token)) score += 3.0;
            if (keywords.some(k => k.includes(token))) score += 2.0;
            if (body.includes(token)) score += 1.0;
          }

          if (score > highestScore) {
            highestScore = score;
            bestSection = sec;
          }
        }
        if (highestScore < 1.0) return null;
      }

      if (!bestSection) return null;

      const title = this.lang === 'am' ? (bestSection.title_am || bestSection.title_en) : (bestSection.title_en || bestSection.title);
      const text = this.lang === 'am' ? (bestSection.text_am || bestSection.text_en) : (bestSection.text_en || bestSection.text);
      const summary = text.split(/(?<=[.?!።])\s+/).slice(0, 3).join(' ');

      return {
        text: `**${title}**\n\n${summary}`,
        sources: [{
          title: title,
          url: bestSection.url || (`#${bestSection.id}`)
        }]
      };
    }

    handleEscalate() {
      const t = this.getTranslations();
      const ticketId = 'ticket-' + Date.now().toString(36);

      this.dispatchEvent(new CustomEvent('db-assistant:escalated', {
        detail: { ticketId },
        bubbles: true,
        composed: true
      }));

      this.addMessage({
        sender: 'assistant',
        senderLabel: t.assistant,
        text: t.escalatedNotice,
        lang: this.lang
      });
    }

    /**
     * Citation navigation handler (SDS §1.4)
     * Directs focus across Shadow DOM boundary to the host heading
     */
    handleSourceClick(event) {
      const link = event.target.closest('a');
      if (!link) return;

      const url = new URL(link.href, window.location.href);
      if (url.pathname !== window.location.pathname || !url.hash) {
        return; // External page link
      }

      const targetId = decodeURIComponent(url.hash.slice(1));
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return;

      event.preventDefault();

      // If panel is in modal mode, close it to restore inert host document
      if (this.mode === 'panel' && this.isModal) {
        this.close({ returnFocus: false });
      }

      if (!targetElement.hasAttribute('tabindex')) {
        targetElement.setAttribute('tabindex', '-1');
      }

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      targetElement.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });

      targetElement.focus({ preventScroll: true });
      window.history.replaceState(null, '', url.hash);
    }

    addMessage(msg) {
      this.messages.push(msg);
      this.renderMessages();
    }

    setStatus(text) {
      const statusEl = this.shadowRoot.getElementById('status');
      if (statusEl) statusEl.textContent = text;
    }

    renderMessages() {
      const list = this.shadowRoot.getElementById('messages');
      if (!list) return;

      const t = this.getTranslations();
      list.innerHTML = '';

      this.messages.forEach((msg) => {
        const li = document.createElement('li');
        li.className = `db-message db-message-${msg.sender}`;
        li.setAttribute('dir', 'auto');
        li.setAttribute('lang', msg.lang || this.lang);

        const headerDiv = document.createElement('div');
        headerDiv.className = 'db-message-header';

        const senderSpan = document.createElement('span');
        senderSpan.className = 'db-message-sender';
        senderSpan.textContent = msg.senderLabel || (msg.sender === 'user' ? t.you : t.assistant);
        headerDiv.appendChild(senderSpan);

        li.appendChild(headerDiv);

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'db-message-body';
        bodyDiv.textContent = msg.text;
        li.appendChild(bodyDiv);

        // Sources list
        if (msg.sources && msg.sources.length > 0) {
          const sourcesContainer = document.createElement('div');
          sourcesContainer.className = 'db-sources-container';

          const sourcesLabel = document.createElement('span');
          sourcesLabel.className = 'db-sources-title';
          sourcesLabel.textContent = `${t.sources}:`;
          sourcesContainer.appendChild(sourcesLabel);

          const ul = document.createElement('ul');
          ul.className = 'db-sources-list';
          msg.sources.forEach(src => {
            const item = document.createElement('li');
            const a = document.createElement('a');
            a.href = src.url;
            a.className = 'db-source-link';
            a.textContent = src.title || src.url;
            item.appendChild(a);
            ul.appendChild(item);
          });
          sourcesContainer.appendChild(ul);
          li.appendChild(sourcesContainer);
        }

        // Listen button for assistant responses
        if (msg.sender === 'assistant') {
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'db-message-actions';

          const listenBtn = document.createElement('button');
          listenBtn.type = 'button';
          listenBtn.className = 'db-btn-listen';
          listenBtn.setAttribute('aria-label', `${t.listen}: ${msg.text.slice(0, 40)}...`);
          listenBtn.innerHTML = `🔊 <span>${t.listen}</span>`;

          listenBtn.addEventListener('click', () => {
            this.speakText(msg.text, msg.lang || this.lang);
          });

          actionsDiv.appendChild(listenBtn);
          li.appendChild(actionsDiv);
        }

        list.appendChild(li);
      });

      list.scrollTop = list.scrollHeight;
    }

    speakText(text, language) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'am' ? 'am-ET' : (language === 'ar' ? 'ar-SA' : 'en-US');
        window.speechSynthesis.speak(utterance);
      }
    }

    updateLocalizedStrings() {
      const t = this.getTranslations();

      const launcher = this.shadowRoot.getElementById('launcher');
      if (launcher) {
        const textSpan = launcher.querySelector('.db-launcher-text');
        if (textSpan) textSpan.textContent = t.launcher;
      }

      const titleEl = this.shadowRoot.getElementById('dialog-title');
      if (titleEl) titleEl.textContent = t.title;

      const closeBtn = this.shadowRoot.getElementById('close-btn');
      if (closeBtn) closeBtn.setAttribute('aria-label', t.close);

      const textarea = this.shadowRoot.getElementById('q');
      if (textarea) {
        textarea.setAttribute('placeholder', t.inputPlaceholder);
        textarea.setAttribute('aria-label', t.askInputLabel);
      }

      const micBtn = this.shadowRoot.getElementById('mic-btn');
      if (micBtn) micBtn.setAttribute('aria-label', t.micLabel);

      const sendBtn = this.shadowRoot.getElementById('send-btn');
      if (sendBtn) sendBtn.setAttribute('aria-label', t.sendLabel);

      const escalateBtn = this.shadowRoot.getElementById('escalate-btn');
      if (escalateBtn) escalateBtn.innerHTML = `👤 <span>${t.talkToPerson}</span>`;

      const langSelect = this.shadowRoot.getElementById('lang-select');
      if (langSelect) langSelect.value = this.lang;

      this.renderMessages();
    }

    render() {
      const t = this.getTranslations();
      const isPanel = this.mode === 'panel';
      const isRTL = this.lang === 'ar';

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            --db-bg: #FFFFFF;
            --db-text: #111111;
            --db-muted: #4A4A4A;
            --db-border: #767676;
            --db-focus: #F5A300;
            --db-primary-color: var(--db-primary, #002B56);
            --db-user-bg: #EBF3FA;
            --db-user-border: #B0D0E8;
            --db-assistant-bg: #F8F9FA;
            --db-assistant-border: #D1D5DB;

            display: ${isPanel ? 'contents' : 'block'};
            box-sizing: border-box;
            font-family: var(--bs-body-font-family, system-ui), "Noto Sans Ethiopic", -apple-system, sans-serif;
            color: var(--db-text);
          }

          *, *::before, *::after {
            box-sizing: inherit;
          }

          *:focus-visible {
            outline: 3px solid var(--db-focus) !important;
            outline-offset: 2px !important;
          }

          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }

          /* Launcher pill */
          .db-launcher {
            position: fixed;
            top: 50%;
            transform: translateY(-50%);
            inset-inline-end: 0;
            z-index: 9999;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            min-height: 44px;
            min-width: 44px;
            padding: 0.75rem 1rem;
            background-color: var(--db-primary-color);
            color: #FFFFFF;
            border: 2px solid #FFFFFF;
            border-inline-end: none;
            border-radius: 2rem 0 0 2rem;
            box-shadow: -2px 4px 12px rgba(0, 0, 0, 0.25);
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }

          :host([position="start"]) .db-launcher {
            inset-inline-start: 0;
            inset-inline-end: auto;
            border-inline-start: none;
            border-inline-end: 2px solid #FFFFFF;
            border-radius: 0 2rem 2rem 0;
            box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.25);
          }

          .db-launcher:hover {
            transform: translateY(-50%) scale(1.03);
          }

          /* Dialog / Panel container */
          .db-panel {
            box-sizing: border-box;
            background: var(--db-bg);
            color: var(--db-text);
            padding: 0;
            border: none;
            flex-direction: column;
            overflow: hidden;
          }

          /* Panel mode docked (>= 900px) */
          @media (min-width: 900px) {
            .db-panel[open]:not([data-inline="true"]) {
              position: fixed;
              top: 0;
              bottom: 0;
              inset-inline-end: 0;
              width: min(26rem, 40vw);
              height: 100vh;
              max-height: 100vh;
              margin: 0;
              display: flex;
              border-inline-start: 1px solid var(--db-border);
              box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
              z-index: 99999;
            }
          }

          /* Modal mode (< 900px) */
          @media (max-width: 899.98px) {
            .db-panel[open]:not([data-inline="true"]) {
              position: fixed;
              inset: 0;
              width: 100vw;
              height: 100vh;
              max-width: 100vw;
              max-height: 100vh;
              margin: 0;
              display: flex;
              z-index: 99999;
            }
          }

          /* Inline mode */
          .db-inline-wrapper {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 600px;
            max-height: 80vh;
            border: 1px solid var(--db-border);
            border-radius: 8px;
            background: var(--db-bg);
            overflow: hidden;
          }

          /* Header */
          .db-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem 1rem;
            background-color: var(--db-primary-color);
            color: #FFFFFF;
            border-bottom: 1px solid var(--db-border);
            flex-shrink: 0;
          }

          .db-title {
            margin: 0;
            font-size: 1.125rem;
            font-weight: 700;
            line-height: 1.4;
          }

          .db-header-controls {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .db-lang-select {
            background: #FFFFFF;
            color: #111111;
            border: 1px solid var(--db-border);
            border-radius: 4px;
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
            min-height: 36px;
            font-weight: 600;
          }

          .db-btn-close {
            background: transparent;
            color: #FFFFFF;
            border: 1px solid transparent;
            font-size: 1.5rem;
            line-height: 1;
            width: 44px;
            height: 44px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }
          .db-btn-close:hover {
            background: rgba(255, 255, 255, 0.15);
          }

          /* Message list (<ol role="log">) */
          .db-messages {
            list-style: none;
            margin: 0;
            padding: 1rem;
            flex: 1 1 auto;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            background-color: #FAFAFA;
          }

          .db-message {
            display: flex;
            flex-direction: column;
            max-width: 88%;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.9375rem;
            line-height: 1.7;
          }

          .db-message[lang="am"] {
            line-height: 1.8;
          }

          .db-message-user {
            align-self: flex-end;
            background-color: var(--db-user-bg);
            border: 1px solid var(--db-user-border);
            border-bottom-right-radius: 2px;
          }

          .db-message-assistant {
            align-self: flex-start;
            background-color: var(--db-assistant-bg);
            border: 1px solid var(--db-assistant-border);
            border-bottom-left-radius: 2px;
          }

          .db-message-header {
            display: flex;
            align-items: center;
            margin-bottom: 0.25rem;
          }

          .db-message-sender {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--db-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .db-message-body {
            white-space: pre-wrap;
            word-break: break-word;
          }

          .db-sources-container {
            margin-top: 0.5rem;
            padding-top: 0.5rem;
            border-top: 1px dashed var(--db-border);
            font-size: 0.8125rem;
          }

          .db-sources-title {
            font-weight: 700;
            color: var(--db-muted);
          }

          .db-sources-list {
            margin: 0.25rem 0 0 0;
            padding-inline-start: 1.25rem;
          }

          .db-source-link {
            color: var(--db-primary-color);
            font-weight: 600;
            text-decoration: underline;
            cursor: pointer;
          }
          .db-source-link:hover {
            color: #001A33;
          }

          .db-message-actions {
            margin-top: 0.5rem;
          }

          .db-btn-listen {
            background: #FFFFFF;
            border: 1px solid var(--db-border);
            border-radius: 4px;
            padding: 0.35rem 0.65rem;
            font-size: 0.8125rem;
            font-weight: 600;
            color: var(--db-text);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            min-height: 36px;
          }
          .db-btn-listen:hover {
            background: #F0F0F0;
          }

          /* Status */
          .db-status {
            padding: 0.25rem 1rem;
            margin: 0;
            font-size: 0.75rem;
            color: var(--db-muted);
            background: #F0F0F0;
            border-top: 1px solid #E5E7EB;
            flex-shrink: 0;
          }

          /* Composer area */
          .db-composer-container {
            padding: 0.75rem 1rem;
            background: var(--db-bg);
            border-top: 1px solid var(--db-border);
            flex-shrink: 0;
          }

          .db-input-row {
            display: flex;
            align-items: flex-end;
            gap: 0.5rem;
          }

          .db-textarea {
            flex: 1 1 auto;
            min-height: 44px;
            max-height: 120px;
            padding: 0.65rem 0.85rem;
            border: 1.5px solid var(--db-border);
            border-radius: 6px;
            font-family: inherit;
            font-size: 0.9375rem;
            line-height: 1.5;
            resize: none;
            color: var(--db-text);
            background: #FFFFFF;
          }

          .db-btn-icon, .db-btn-send {
            min-height: 44px;
            min-width: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid var(--db-border);
            background: #FFFFFF;
            color: var(--db-text);
            font-size: 1.125rem;
          }

          .db-btn-icon[aria-pressed="true"] {
            background: #FFE5E5;
            border-color: #D32F2F;
            color: #D32F2F;
          }

          .db-btn-send {
            background-color: var(--db-primary-color);
            color: #FFFFFF;
            border-color: var(--db-primary-color);
          }

          .db-composer-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 0.5rem;
          }

          .db-btn-escalate {
            background: transparent;
            color: var(--db-primary-color);
            border: 1.5px solid var(--db-primary-color);
            border-radius: 4px;
            padding: 0.4rem 0.75rem;
            font-size: 0.8125rem;
            font-weight: 700;
            cursor: pointer;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
          }
          .db-btn-escalate:hover {
            background: rgba(0, 43, 86, 0.08);
          }
        </style>

        ${isPanel ? `
          <button type="button" id="launcher" class="db-launcher" aria-expanded="false" aria-controls="panel">
            <span aria-hidden="true">💬</span>
            <span class="db-launcher-text">${t.launcher}</span>
          </button>

          <dialog id="panel" class="db-panel" aria-labelledby="dialog-title">
            <header class="db-header">
              <h2 id="dialog-title" class="db-title">${t.title}</h2>
              <div class="db-header-controls">
                <label for="lang-select" class="sr-only">${t.languageLabel}</label>
                <select id="lang-select" class="db-lang-select" aria-label="${t.languageLabel}">
                  <option value="en" ${this.lang === 'en' ? 'selected' : ''}>EN</option>
                  <option value="am" ${this.lang === 'am' ? 'selected' : ''}>አማ (AM)</option>
                  <option value="ar" ${this.lang === 'ar' ? 'selected' : ''}>عر (AR)</option>
                </select>
                <button type="button" id="close-btn" class="db-btn-close" aria-label="${t.close}">&times;</button>
              </div>
            </header>

            <ol id="messages" role="log" aria-live="polite" class="db-messages"></ol>
            <p id="status" role="status" class="db-status">${t.statusReady}</p>

            <div class="db-composer-container">
              <form id="composer-form">
                <div class="db-input-row">
                  <label for="q" class="sr-only">${t.askInputLabel}</label>
                  <textarea id="q" class="db-textarea" rows="1" placeholder="${t.inputPlaceholder}" aria-label="${t.askInputLabel}"></textarea>
                  <button type="button" id="mic-btn" class="db-btn-icon" aria-pressed="false" aria-label="${t.micLabel}">🎙️</button>
                  <button type="submit" id="send-btn" class="db-btn-send" aria-label="${t.sendLabel}">➤</button>
                </div>
                <div class="db-composer-footer">
                  <button type="button" id="escalate-btn" class="db-btn-escalate">
                    👤 <span>${t.talkToPerson}</span>
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        ` : `
          <div class="db-inline-wrapper" data-inline="true">
            <header class="db-header">
              <h2 id="dialog-title" class="db-title">${t.title}</h2>
              <div class="db-header-controls">
                <label for="lang-select" class="sr-only">${t.languageLabel}</label>
                <select id="lang-select" class="db-lang-select" aria-label="${t.languageLabel}">
                  <option value="en" ${this.lang === 'en' ? 'selected' : ''}>EN</option>
                  <option value="am" ${this.lang === 'am' ? 'selected' : ''}>አማ (AM)</option>
                  <option value="ar" ${this.lang === 'ar' ? 'selected' : ''}>عر (AR)</option>
                </select>
              </div>
            </header>

            <ol id="messages" role="log" aria-live="polite" class="db-messages"></ol>
            <p id="status" role="status" class="db-status">${t.statusReady}</p>

            <div class="db-composer-container">
              <form id="composer-form">
                <div class="db-input-row">
                  <label for="q" class="sr-only">${t.askInputLabel}</label>
                  <textarea id="q" class="db-textarea" rows="1" placeholder="${t.inputPlaceholder}" aria-label="${t.askInputLabel}"></textarea>
                  <button type="button" id="mic-btn" class="db-btn-icon" aria-pressed="false" aria-label="${t.micLabel}">🎙️</button>
                  <button type="submit" id="send-btn" class="db-btn-send" aria-label="${t.sendLabel}">➤</button>
                </div>
                <div class="db-composer-footer">
                  <button type="button" id="escalate-btn" class="db-btn-escalate">
                    👤 <span>${t.talkToPerson}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        `}
      `;

      this.bindEvents();
      this.renderMessages();
    }

    bindEvents() {
      const launcher = this.shadowRoot.getElementById('launcher');
      if (launcher) {
        launcher.addEventListener('click', () => this.open());
      }

      const closeBtn = this.shadowRoot.getElementById('close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close({ returnFocus: true }));
      }

      const panel = this.shadowRoot.getElementById('panel');
      if (panel) {
        panel.addEventListener('cancel', (e) => {
          e.preventDefault();
          this.close({ returnFocus: true });
        });
      }

      const langSelect = this.shadowRoot.getElementById('lang-select');
      if (langSelect) {
        langSelect.addEventListener('change', (e) => {
          this.lang = e.target.value;
        });
      }

      const form = this.shadowRoot.getElementById('composer-form');
      if (form) {
        form.addEventListener('submit', this.handleFormSubmit);
      }

      const textarea = this.shadowRoot.getElementById('q');
      if (textarea) {
        textarea.addEventListener('input', () => this.adjustTextareaHeight(textarea));
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleFormSubmit();
          }
        });
      }

      const micBtn = this.shadowRoot.getElementById('mic-btn');
      if (micBtn) {
        micBtn.addEventListener('click', this.handleMicToggle);
      }

      const escalateBtn = this.shadowRoot.getElementById('escalate-btn');
      if (escalateBtn) {
        escalateBtn.addEventListener('click', this.handleEscalate);
      }

      const messagesList = this.shadowRoot.getElementById('messages');
      if (messagesList) {
        messagesList.addEventListener('click', this.handleSourceClick);
      }
    }
  }

  // Register Custom Element
  if (!customElements.get('db-assistant')) {
    customElements.define('db-assistant', DbAssistant);
  }
})();
