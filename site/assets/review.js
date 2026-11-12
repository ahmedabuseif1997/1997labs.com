/* Lia 97 AI chat: understands what the customer needs, checks their website and suggests a plan.
   Set REVIEW_API (and TURNSTILE_SITE_KEY) after the worker is deployed; until then the chat stays hidden. */
(() => {
  const REVIEW_API = '';          // e.g. https://lia97-review.<your-subdomain>.workers.dev
  const TURNSTILE_SITE_KEY = '';  // Cloudflare Turnstile site key
  const cfg = window.REVIEW_CONFIG || { api: REVIEW_API, turnstile: TURNSTILE_SITE_KEY };
  if (!cfg.api) return;
  const API = cfg.api.replace(/\/$/, '');
  const WA = (typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '').replace(/\D/g, '');

  const T = {
    en: {
      launch: 'Chat with our AI · free review', short: 'AI chat', title: 'Lia 97 AI', sub: 'AI assistant · replies in seconds', toggle: 'ع', close: 'Close',
      hi: "Hi! I'm the Lia 97 AI assistant. Tell me about your business and what you need, and I'll suggest the right solution. I can also check your website for free: just send its address.",
      ideas: ['Check my website', 'I need a new website', 'I need a mobile app', 'Automate my work with AI', 'Get more customers'],
      ph: 'Type your message…', send: 'Send', typing: 'Typing…', checking: 'Checking your website…',
      human: 'Please complete the quick check below, then send your message.',
      score: 'Website score', cats: { mobile: 'Mobile', google: 'Google', speed: 'Speed', trust: 'Trust', customers: 'Contact' },
      unreachable: (s) => `I couldn't open ${s}.`, limited: 'This site is built with JavaScript, so some checks were limited.',
      rec: 'Recommended plan & estimate', recHidden: 'Recommended plan', total: 'Estimated total (excl. 5% VAT)', weeks: (a, b) => `Delivery: ${a}–${b} weeks`,
      monthly: (n) => `Optional hosting & maintenance: ${n} AED/month`, extras: 'Optional extras (not in the total)', extrasHidden: 'Optional extras',
      note: 'Estimate in AED, excl. 5% VAT. Your final price is confirmed after a free call.',
      getQuote: 'Send me my quote', quoteAsk: 'Our team checks every quote and sends it to you directly. Where should we send it?',
      quoteSent: 'Thanks! We will send your quote to you directly. You can keep chatting here.',
      call: 'Get a call back', callAsk: 'Leave your name and number and our team will contact you.', sent: "Thanks! We'll contact you within one working day.",
      wa: 'WhatsApp us', name: 'Your name', contact: 'Phone or email', submit: 'Send', back: 'Back to chat', newChat: 'Start a new chat',
      waPlan: (s) => `Hi Lia 97, I chatted with your AI assistant.\n${s.business ? `Business: ${s.business}\n` : ''}${s.site ? `Website: ${s.site}\n` : ''}Recommended: ${s.plan.items.map((i) => i.label).join(', ')}\nPlease send me a quote.`,
      waPrice: (s) => `Hi Lia 97, I chatted with your AI assistant.\n${s.site ? `Website: ${s.site}\n` : ''}Estimate: ${fmt(s.plan.total.from)}–${fmt(s.plan.total.to)} AED (excl. 5% VAT)\nPlan: ${s.plan.items.map((i) => i.label).join(', ')}`,
      waHello: (s) => `Hi Lia 97, I chatted with your AI assistant${s.business ? ` about my business (${s.business})` : ''}. Can you help me?`,
      errLimit: "Today's chat limit is reached. Please message us on WhatsApp and we'll help you.",
      errChatLimit: 'This chat is getting long, so our team will take it from here. WhatsApp us or ask for a call back.',
      errBot: 'The human check failed. Please try again.', err: 'Something went wrong. Please try again, or message us on WhatsApp.',
      expired: 'This chat expired, so I started a new one. Please send your message again.',
    },
    ar: {
      launch: 'تحدث مع مساعدنا الذكي · مراجعة مجانية', short: 'مساعد ذكي', title: 'مساعد Lia 97', sub: 'مساعد ذكي · يرد خلال ثوانٍ', toggle: 'EN', close: 'إغلاق',
      hi: 'مرحبًا! أنا المساعد الذكي لـ Lia 97. أخبرني عن نشاطك التجاري وما تحتاجه، وسأقترح عليك الحل المناسب. يمكنني أيضًا فحص موقعك مجانًا: فقط أرسل عنوانه.',
      ideas: ['افحص موقعي', 'أحتاج موقعًا جديدًا', 'أحتاج تطبيق جوال', 'أتمتة عملي بالذكاء الاصطناعي', 'عملاء أكثر'],
      ph: 'اكتب رسالتك…', send: 'إرسال', typing: 'يكتب…', checking: 'جارٍ فحص موقعك…',
      human: 'أكمل التحقق السريع أدناه، ثم أرسل رسالتك.',
      score: 'تقييم الموقع', cats: { mobile: 'الجوال', google: 'جوجل', speed: 'السرعة', trust: 'الثقة', customers: 'التواصل' },
      unreachable: (s) => `لم أتمكن من فتح ${s}.`, limited: 'هذا الموقع مبني بجافاسكربت، لذلك كانت بعض الفحوصات محدودة.',
      rec: 'الخطة المقترحة والتقدير', recHidden: 'الخطة المقترحة', total: 'الإجمالي التقديري (غير شامل ضريبة القيمة المضافة 5%)', weeks: (a, b) => `مدة التنفيذ: ${a}–${b} أسابيع`,
      monthly: (n) => `استضافة وصيانة اختيارية: ${n} درهم شهريًا`, extras: 'إضافات اختيارية (غير محسوبة في الإجمالي)', extrasHidden: 'إضافات اختيارية',
      note: 'تقدير بالدرهم الإماراتي، غير شامل ضريبة القيمة المضافة 5%. يتم تأكيد السعر النهائي بعد مكالمة مجانية.',
      getQuote: 'أرسلوا لي عرض السعر', quoteAsk: 'يراجع فريقنا كل عرض سعر ويرسله إليك مباشرة. إلى أين نرسله؟',
      quoteSent: 'شكرًا! سنرسل لك عرض السعر مباشرة. يمكنك متابعة المحادثة هنا.',
      call: 'اطلب اتصالًا', callAsk: 'اترك اسمك ورقمك وسيتواصل معك فريقنا.', sent: 'شكرًا! سنتواصل معك خلال يوم عمل واحد.',
      wa: 'راسلنا على واتساب', name: 'اسمك', contact: 'الهاتف أو البريد', submit: 'إرسال', back: 'العودة إلى المحادثة', newChat: 'ابدأ محادثة جديدة',
      waPlan: (s) => `مرحبًا Lia 97، تحدثت مع مساعدكم الذكي.\n${s.business ? `النشاط: ${s.business}\n` : ''}${s.site ? `الموقع: ${s.site}\n` : ''}الخطة المقترحة: ${s.plan.items.map((i) => i.label).join('، ')}\nأرجو إرسال عرض السعر.`,
      waPrice: (s) => `مرحبًا Lia 97، تحدثت مع مساعدكم الذكي.\n${s.site ? `الموقع: ${s.site}\n` : ''}التقدير: ${fmt(s.plan.total.from)}–${fmt(s.plan.total.to)} درهم (غير شامل ضريبة القيمة المضافة 5%)\nالخطة: ${s.plan.items.map((i) => i.label).join('، ')}`,
      waHello: () => 'مرحبًا Lia 97، تحدثت مع مساعدكم الذكي. هل يمكنكم مساعدتي؟',
      errLimit: 'وصلنا إلى حد المحادثات اليوم. راسلنا على واتساب وسنساعدك.',
      errChatLimit: 'أصبحت المحادثة طويلة، وسيتابع فريقنا معك. راسلنا على واتساب أو اطلب اتصالًا.',
      errBot: 'فشل التحقق. حاول مرة أخرى.', err: 'حدث خطأ. حاول مرة أخرى أو راسلنا على واتساب.',
      expired: 'انتهت صلاحية المحادثة، فبدأت محادثة جديدة. أرسل رسالتك مرة أخرى من فضلك.',
    },
  };
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ltr = (e) => { e.dir = 'ltr'; return e; };
  const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>';
  const HAS_SITE = /\b[\w-]+\.(ae|com|net|org|io|co|ai|app|shop|store|online|site)\b/i;

  let lang = (document.documentElement.lang || navigator.language || 'en').startsWith('ar') ? 'ar' : 'en';
  let s = {};
  const launch = el('button', 'rv-launch'); launch.type = 'button';
  const panel = el('div', 'rv-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  const OWN_BUTTONS = !!document.querySelector('[data-open-chat]'); // the page has its own AI chat buttons
  document.body.append(...(OWN_BUTTONS ? [panel] : [launch, panel]));

  function render() {
    const t = T[lang];
    launch.innerHTML = `${SPARK}<span class="rv-full">${t.launch}</span><span class="rv-short">${t.short}</span>`;
    panel.dir = lang === 'ar' ? 'rtl' : 'ltr'; panel.lang = lang; panel.setAttribute('aria-label', t.launch);
    panel.innerHTML = `<div class="rv-head"><span class="rv-orb" aria-hidden="true"></span><div><b>${t.title}</b><small>${t.sub}</small></div>
      <div class="rv-head-actions"><button type="button" class="rv-lang" aria-label="${lang === 'ar' ? 'English' : 'العربية'}">${t.toggle}</button><button type="button" class="rv-close" aria-label="${t.close}">×</button></div></div>
      <div class="rv-body" aria-live="polite"></div><div class="rv-foot"></div>`;
    panel.querySelector('.rv-lang').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; render(); start(); };
    panel.querySelector('.rv-close').onclick = close;
  }
  const body = () => panel.querySelector('.rv-body');
  const foot = () => panel.querySelector('.rv-foot');
  const scroll = () => { body().scrollTop = body().scrollHeight; };
  const say = (text, who = 'bot') => { const m = el('div', `rv-msg rv-${who}`, text); body().append(m); scroll(); return m; };
  const waLink = (text, primary) => { const a = el('a', primary ? 'rv-btn primary' : 'rv-btn', T[lang].wa); a.href = `https://wa.me/${WA}?text=${encodeURIComponent(text)}`; a.target = '_blank'; a.rel = 'noopener'; return a; };

  function start() {
    const t = T[lang]; s = { chatId: null, token: null, busy: false, business: '', site: null, plan: null };
    body().replaceChildren(); say(t.hi);
    const ideas = el('div', 'rv-chips rv-ideas');
    t.ideas.forEach((txt) => { const b = el('button', '', txt); b.type = 'button'; b.onclick = () => trySend(txt); ideas.append(b); });
    body().append(ideas); composer();
  }

  /** The message box. Before the first message it also shows the human check, if one is configured. */
  function composer() {
    const t = T[lang]; const parts = [];
    if (!s.chatId && cfg.turnstile) parts.push(humanCheck());
    const row = el('div', 'rv-row'); const input = el('input'); input.id = 'rv-text'; input.type = 'text'; input.maxLength = 600; input.autocomplete = 'off';
    input.placeholder = t.ph; input.setAttribute('aria-label', t.ph);
    const go = el('button', 'rv-btn primary', t.send); go.type = 'button';
    const submit = () => { const v = input.value.trim(); if (v && trySend(v)) input.value = ''; };
    go.onclick = submit; input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    row.append(input, go); parts.push(row);
    if (s.chatId) { const n = el('button', 'rv-link', t.newChat); n.type = 'button'; n.onclick = start; parts.push(n); }
    foot().replaceChildren(...parts); input.focus();
  }
  function humanCheck() {
    const box = el('div', 'rv-turnstile');
    const draw = () => {
      if (!box.isConnected) return;
      if (!window.turnstile) { setTimeout(draw, 300); return; }
      window.turnstile.render(box, { sitekey: cfg.turnstile, callback: (tok) => { s.token = tok; }, 'expired-callback': () => { s.token = null; } });
    };
    setTimeout(draw, 0); return box;
  }

  /** Send now if possible; returns false when the visitor must wait or finish the human check first. */
  function trySend(text) {
    if (s.busy) return false;
    if (!s.chatId && cfg.turnstile && !s.token) { say(T[lang].human); return false; }
    send(text); return true;
  }
  async function send(text) {
    const t = T[lang]; s.busy = true;
    const ideas = body().querySelector('.rv-ideas'); if (ideas) ideas.remove();
    say(text, 'user');
    const wait = say(HAS_SITE.test(text) ? t.checking : t.typing); wait.classList.add('rv-typing');
    let res, data;
    try {
      res = await fetch(API + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chatId: s.chatId, text, lang, token: s.token }) });
      data = await res.json();
    } catch { wait.remove(); s.busy = false; say(t.err); return; }
    wait.remove(); s.busy = false;
    if (!res.ok) {
      if (data.error === 'chat_expired') { s.chatId = null; s.token = null; say(t.expired); composer(); return; }
      if (res.status === 429) { say(data.error === 'chat_limit' ? t.errChatLimit : t.errLimit); helpCard(); return; }
      if (res.status === 403) { s.token = null; say(t.errBot); composer(); return; }
      say(t.err); return;
    }
    const first = !s.chatId;
    s.chatId = data.chatId; s.token = null; s.business = data.business || s.business; s.site = data.site || s.site;
    if (data.check) scoreCard(data.check);
    say(data.reply);
    if (data.plan) { s.plan = data.plan; planCard(data.plan); }
    if (data.handoff) helpCard();
    if (first) composer(); // drops the human check and adds "Start a new chat"
  }

  function scoreCard(c) {
    const t = T[lang];
    if (!c.reachable || !c.scores) { say(t.unreachable(c.site)).classList.add('rv-note'); return; }
    const card = el('div', 'rv-msg rv-result'); const sc = el('div', 'rv-score');
    const ring = el('div', 'rv-ring'); ring.style.setProperty('--v', c.scores.overall); ring.append(el('span', '', String(c.scores.overall)));
    const bars = el('div', 'rv-bars'); bars.append(el('span', 'rv-h', `${t.score} · ${c.site}`));
    Object.entries(t.cats).forEach(([k, label]) => { const b = el('div', 'rv-bar'); const bar = el('i'); bar.style.setProperty('--w', c.scores[k] + '%'); b.append(el('span', '', label), bar, el('span', '', String(c.scores[k]))); bars.append(b); });
    sc.append(ring, bars); card.append(sc);
    if (c.limitedCheck) card.append(el('p', 'rv-note', t.limited));
    body().append(card); scroll();
  }

  function planCard(p) {
    const t = T[lang]; const hidden = !!p.pricesHidden;
    const card = el('div', 'rv-msg rv-result'); card.append(el('span', 'rv-h', hidden ? t.recHidden : t.rec));
    const q = el('div', 'rv-quote');
    const row = (i) => { const r = el('div', 'rv-item'); r.append(el('span', '', i.label)); if (!hidden) r.append(ltr(el('strong', '', `${fmt(i.from)}–${fmt(i.to)} AED`))); if (i.why) r.append(el('small', '', i.why)); return r; };
    p.items.forEach((i) => q.append(row(i)));
    if (!hidden) { const total = el('div', 'rv-total'); total.append(el('span', '', t.total), ltr(el('strong', '', `${fmt(p.total.from)}–${fmt(p.total.to)} AED`))); q.append(total); }
    if (p.weeks) q.append(el('span', 'rv-note', t.weeks(p.weeks[0], p.weeks[1])));
    if (p.optional && p.optional.length) { q.append(el('span', 'rv-h', hidden ? t.extrasHidden : t.extras)); p.optional.forEach((i) => q.append(row(i))); }
    if (!hidden) q.append(el('span', 'rv-note', t.monthly(fmt(p.monthly))), el('span', 'rv-note', t.note));
    card.append(q);
    const actions = el('div', 'rv-actions');
    const quote = el('button', 'rv-btn primary', t.getQuote); quote.type = 'button'; quote.onclick = () => contactForm(true); actions.append(quote);
    if (WA) actions.append(waLink(hidden ? t.waPlan(s) : t.waPrice(s)));
    card.append(actions); body().append(card); scroll();
  }

  /** Ways to reach a person: WhatsApp, and a call back once the chat exists. */
  function helpCard() {
    const t = T[lang]; const actions = el('div', 'rv-actions');
    if (WA) actions.append(waLink(t.waHello(s), true));
    if (s.chatId) { const b = el('button', 'rv-btn', t.call); b.type = 'button'; b.onclick = () => contactForm(false); actions.append(b); }
    if (actions.children.length) { body().append(actions); scroll(); }
  }

  function contactForm(quoteMode) {
    const t = T[lang]; say(quoteMode ? t.quoteAsk : t.callAsk);
    const name = el('input'); name.id = 'rv-name'; name.placeholder = t.name; name.setAttribute('aria-label', t.name); name.maxLength = 80;
    const contact = el('input'); contact.id = 'rv-contact'; contact.placeholder = t.contact; contact.setAttribute('aria-label', t.contact); contact.maxLength = 120;
    const btn = el('button', 'rv-btn primary', quoteMode ? t.getQuote : t.submit); btn.type = 'button';
    const back = el('button', 'rv-link', t.back); back.type = 'button'; back.onclick = composer;
    btn.onclick = async () => {
      if (!name.value.trim() || !contact.value.trim()) return;
      btn.disabled = true;
      try {
        const res = await fetch(API + '/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chatId: s.chatId, name: name.value, contact: contact.value }) });
        if (res.ok) { say(quoteMode ? t.quoteSent : t.sent); composer(); } else { say(t.err); btn.disabled = false; }
      } catch { say(t.err); btn.disabled = false; }
    };
    const row = el('div', 'rv-row'); row.append(contact, btn); foot().replaceChildren(name, row, back); name.focus();
  }

  function open() {
    panel.hidden = false; launch.setAttribute('aria-expanded', 'true');
    if (!body().children.length) start();
    if (cfg.turnstile && !window.turnstile && !document.querySelector('script[data-rv-turnstile]')) {
      const sc = el('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; sc.async = true; sc.dataset.rvTurnstile = '1'; document.head.append(sc);
    }
  }
  function close() { panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); if (!OWN_BUTTONS) launch.focus(); }
  render();
  launch.onclick = () => (panel.hidden ? open() : close());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  document.querySelectorAll('[data-open-review],[data-open-chat]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (panel.hidden) open(); else close(); }));
  // Lets the page open the chat and keep its language in step with the site's language switch.
  window.RV = { open, close, setLang(l) { l = l === 'ar' ? 'ar' : 'en'; if (l === lang) return; lang = l; render(); if (!panel.hidden) start(); } };
})();
