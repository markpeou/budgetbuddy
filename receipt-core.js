/**
 * Receipt parsing, categorisation and spend analysis (no DOM).
 * Shared by the browser app and Node tests.
 *
 * Only data points are ever produced or stored:
 *   { id, date, merchant, amount, currency, category, source, createdAt }
 * The receipt image itself never reaches this module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReceiptCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CATEGORIES = [
    { id: 'groceries', label: 'Groceries', color: '#00B4A0' },
    { id: 'dining', label: 'Dining & cafés', color: '#7B14EF' },
    { id: 'transport', label: 'Transport', color: '#FFC845' },
    { id: 'shopping', label: 'Shopping', color: '#C026D3' },
    { id: 'health', label: 'Health & pharmacy', color: '#0EA5E9' },
    { id: 'bills', label: 'Bills & utilities', color: '#F97316' },
    { id: 'entertainment', label: 'Entertainment', color: '#EC4899' },
    { id: 'travel', label: 'Travel & stays', color: '#14B8A6' },
    { id: 'personal', label: 'Personal care', color: '#A855F7' },
    { id: 'housing', label: 'Rent & home loan', color: '#6366F1' },
    { id: 'other', label: 'Other', color: '#9CA3AF' },
  ];

  /**
   * Known merchants → [display name, category]. Checked first because a brand
   * match is far more reliable than guessing from the top line of OCR text.
   * Keys are lower-case, accent-stripped substrings.
   */
  const KNOWN_MERCHANTS = [
    // Vietnam — convenience & grocery
    ['circle k', 'Circle K', 'groceries'],
    ['circlek', 'Circle K', 'groceries'],
    ['familymart', 'FamilyMart', 'groceries'],
    ['family mart', 'FamilyMart', 'groceries'],
    ['gs25', 'GS25', 'groceries'],
    ['ministop', 'Ministop', 'groceries'],
    ['7-eleven', '7-Eleven', 'groceries'],
    ['7 eleven', '7-Eleven', 'groceries'],
    ['winmart', 'WinMart', 'groceries'],
    ['vinmart', 'WinMart', 'groceries'],
    ['co.opmart', 'Co.opmart', 'groceries'],
    ['coopmart', 'Co.opmart', 'groceries'],
    ['co.op food', 'Co.op Food', 'groceries'],
    ['bach hoa xanh', 'Bách Hóa Xanh', 'groceries'],
    ['lotte mart', 'Lotte Mart', 'groceries'],
    ['aeon', 'AEON', 'groceries'],
    ['emart', 'Emart', 'groceries'],
    ['mm mega', 'MM Mega Market', 'groceries'],
    ['big c', 'GO! / Big C', 'groceries'],
    ['annam', 'Annam Gourmet', 'groceries'],
    // Vietnam — cafés & food
    ['highlands', 'Highlands Coffee', 'dining'],
    ['phuc long', 'Phúc Long', 'dining'],
    ['the coffee house', 'The Coffee House', 'dining'],
    ['katinat', 'Katinat', 'dining'],
    ['cong caphe', 'Cộng Cà Phê', 'dining'],
    ['starbucks', 'Starbucks', 'dining'],
    ['trung nguyen', 'Trung Nguyên', 'dining'],
    ['jollibee', 'Jollibee', 'dining'],
    ['lotteria', 'Lotteria', 'dining'],
    ['kfc', 'KFC', 'dining'],
    ['mcdonald', "McDonald's", 'dining'],
    ['pizza 4p', "Pizza 4P's", 'dining'],
    ['pizza hut', 'Pizza Hut', 'dining'],
    ['domino', "Domino's", 'dining'],
    ['subway', 'Subway', 'dining'],
    ['shopeefood', 'ShopeeFood', 'dining'],
    ['grabfood', 'GrabFood', 'dining'],
    // Vietnam — transport
    ['xanh sm', 'Xanh SM', 'transport'],
    ['grab', 'Grab', 'transport'],
    ['gojek', 'Gojek', 'transport'],
    ['petrolimex', 'Petrolimex', 'transport'],
    ['vietjet', 'Vietjet', 'travel'],
    ['vietnam airlines', 'Vietnam Airlines', 'travel'],
    ['bamboo airways', 'Bamboo Airways', 'travel'],
    // Vietnam — health / shopping / bills
    ['pharmacity', 'Pharmacity', 'health'],
    ['long chau', 'Long Châu', 'health'],
    ['an khang', 'An Khang', 'health'],
    ['guardian', 'Guardian', 'personal'],
    ['watsons', 'Watsons', 'personal'],
    ['uniqlo', 'Uniqlo', 'shopping'],
    ['the gioi di dong', 'Thế Giới Di Động', 'shopping'],
    ['dien may xanh', 'Điện Máy Xanh', 'shopping'],
    ['fpt shop', 'FPT Shop', 'shopping'],
    ['cgv', 'CGV', 'entertainment'],
    ['galaxy cinema', 'Galaxy Cinema', 'entertainment'],
    ['evn', 'EVN', 'bills'],
    ['viettel', 'Viettel', 'bills'],
    ['vinaphone', 'Vinaphone', 'bills'],
    ['mobifone', 'MobiFone', 'bills'],
    // Australia
    ['woolworths', 'Woolworths', 'groceries'],
    ['coles', 'Coles', 'groceries'],
    ['aldi', 'Aldi', 'groceries'],
    ['iga', 'IGA', 'groceries'],
    ['harris farm', 'Harris Farm', 'groceries'],
    ['costco', 'Costco', 'groceries'],
    ['chemist warehouse', 'Chemist Warehouse', 'health'],
    ['priceline', 'Priceline', 'health'],
    ['bunnings', 'Bunnings', 'shopping'],
    ['kmart', 'Kmart', 'shopping'],
    ['target', 'Target', 'shopping'],
    ['jb hi-fi', 'JB Hi-Fi', 'shopping'],
    ['jb hifi', 'JB Hi-Fi', 'shopping'],
    ['officeworks', 'Officeworks', 'shopping'],
    ['big w', 'Big W', 'shopping'],
    ['ikea', 'IKEA', 'shopping'],
    ['uber eats', 'Uber Eats', 'dining'],
    ['ubereats', 'Uber Eats', 'dining'],
    ['menulog', 'Menulog', 'dining'],
    ['doordash', 'DoorDash', 'dining'],
    ['hungry jack', "Hungry Jack's", 'dining'],
    ['guzman', 'Guzman y Gomez', 'dining'],
    ['uber', 'Uber', 'transport'],
    ['didi', 'DiDi', 'transport'],
    ['opal', 'Opal', 'transport'],
    ['myki', 'Myki', 'transport'],
    ['ampol', 'Ampol', 'transport'],
    ['bp ', 'BP', 'transport'],
    ['shell', 'Shell', 'transport'],
    ['7eleven', '7-Eleven', 'groceries'],
    ['qantas', 'Qantas', 'travel'],
    ['jetstar', 'Jetstar', 'travel'],
    ['virgin australia', 'Virgin Australia', 'travel'],
    ['airbnb', 'Airbnb', 'travel'],
    ['booking.com', 'Booking.com', 'travel'],
    ['agoda', 'Agoda', 'travel'],
    ['event cinemas', 'Event Cinemas', 'entertainment'],
    ['hoyts', 'Hoyts', 'entertainment'],
    ['telstra', 'Telstra', 'bills'],
    ['optus', 'Optus', 'bills'],
    ['agl', 'AGL', 'bills'],
    ['origin energy', 'Origin Energy', 'bills'],
  ];

  /** Generic keywords → category, used when no known merchant matches. */
  const CATEGORY_KEYWORDS = {
    dining: [
      'cafe', 'coffee', 'ca phe', 'caphe', 'restaurant', 'nha hang', 'quan ',
      'pho', 'bun ', 'com tam', 'banh mi', 'bistro', 'bar ', 'pub', 'bia',
      'beer', 'tra sua', 'milk tea', 'bakery', 'kitchen', 'grill', 'sushi',
      'bbq', 'lau', 'food', 'gelato', 'ice cream', 'dessert', 'donut', 'juice', 'smoothie', 'dining', 'eatery', 'pizza', 'burger', 'noodle',
    ],
    groceries: [
      'supermarket', 'sieu thi', 'mart', 'grocer', 'market', 'cho ',
      'convenience', 'tap hoa', 'fresh', 'butcher', 'fruit',
    ],
    transport: [
      'taxi', 'xang', 'petrol', 'fuel', 'parking', 'gui xe', 'toll', 'ride',
      'metro', 'bus ', 'train', 'transit',
    ],
    health: [
      'pharmacy', 'nha thuoc', 'chemist', 'clinic', 'phong kham', 'hospital',
      'benh vien', 'dental', 'nha khoa', 'medical', 'doctor',
    ],
    personal: ['salon', 'spa', 'hair', 'toc', 'nail', 'barber', 'massage', 'cat toc'],
    housing: ['rent', 'mortgage', 'home loan', 'strata', 'real estate', 'body corporate', 'lease', 'tien nha', 'thue nha'],
    bills: [
      'electric', 'dien luc', 'water', 'nuoc', 'internet', 'mobile', 'telecom',
      'utility', 'insurance', 'bao hiem',
    ],
    entertainment: ['cinema', 'rap phim', 'karaoke', 'ticket', 've ', 'game', 'concert', 'museum'],
    travel: ['hotel', 'khach san', 'resort', 'hostel', 'homestay', 'airline', 'flight', 'airport'],
    shopping: ['store', 'shop', 'cua hang', 'fashion', 'thoi trang', 'electronics', 'boutique', 'mall'],
  };

  // ---------------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------------

  /** Lower-case and strip Vietnamese diacritics so "Tổng cộng" → "tong cong". */
  function fold(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  /**
   * Parse a money token in any common format.
   * "1,234.56" → 1234.56, "1.234,56" → 1234.56, "125.000" → 125000,
   * "125,000đ" → 125000, "12.50" → 12.5, "4,50" → 4.5
   */
  function parseMoney(token) {
    if (token == null) return NaN;
    let s = String(token).replace(/[^\d.,]/g, '');
    if (!s || !/\d/.test(s)) return NaN;
    s = s.replace(/^[.,]+|[.,]+$/g, '');
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    if (lastDot >= 0 && lastComma >= 0) {
      // OCR often mixes separators ("1,180.521"). Exactly 3 digits after the
      // last one means it's a thousands group too, not decimals.
      if (/[.,]\d{3}$/.test(s)) return Number(s.replace(/[.,]/g, ''));
      // Otherwise whichever comes last is the decimal separator.
      const decSep = lastDot > lastComma ? '.' : ',';
      const thouSep = decSep === '.' ? ',' : '.';
      s = s.split(thouSep).join('').replace(decSep, '.');
      return Number(s);
    }

    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    if (!sep) return Number(s);

    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    // Multiple separators of one kind, or exactly 3 trailing digits → thousands.
    if (parts.length > 2 || tail.length === 3) {
      return Number(parts.join(''));
    }
    // 1–2 trailing digits → decimal.
    return Number(parts.slice(0, -1).join('') + '.' + tail);
  }

  /** All money-looking numbers on a line, in order. */
  function moneyTokens(line) {
    const out = [];
    const re = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
    let m;
    while ((m = re.exec(line))) {
      const n = parseMoney(m[0]);
      if (Number.isFinite(n) && n > 0) out.push(n);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Field extraction
  // ---------------------------------------------------------------------------

  const CURRENCY_HINTS = [
    { code: 'VND', re: /(₫|\bvnd\b|\bvnđ\b|\d\s?đ\b|\bdong\b)/i },
    { code: 'AUD', re: /(a\$|\baud\b|\babn\b|\bgst\b|\beftpos\b)/i },
    { code: 'SGD', re: /(s\$|\bsgd\b)/i },
    { code: 'THB', re: /(฿|\bthb\b|\bbaht\b)/i },
    { code: 'GBP', re: /(£|\bgbp\b|\bvat reg)/i },
    { code: 'EUR', re: /(€|\beur\b)/i },
    { code: 'KRW', re: /(₩|\bkrw\b)/i },
    { code: 'JPY', re: /(\bjpy\b|円)/i },
    { code: 'USD', re: /(us\$|\busd\b)/i },
  ];

  function detectCurrency(text, fallback) {
    const folded = String(text || '');
    for (const hint of CURRENCY_HINTS) {
      if (hint.re.test(folded)) return { code: hint.code, detected: true };
    }
    // Vietnamese receipt words without an explicit symbol → VND.
    const f = fold(text);
    if (/(tong cong|thanh tien|hoa don|thanh toan|tien mat|khach hang)/.test(f)) {
      return { code: 'VND', detected: true };
    }
    return { code: fallback || 'USD', detected: false };
  }

  // Ordered best → weakest. Folded (no diacritics) matching.
  const TOTAL_KEYWORDS = [
    /\b(grand total|amount due|balance due|total due|total payable|amount payable)\b/,
    /\b(khach (can|phai) tra|can thanh toan|tong thanh toan|tong tien thanh toan|so tien thanh toan)\b/,
    /\b(tong cong|tong tien|thanh tien|tong)\b/,
    /\b(total|amount|eftpos|card|visa|mastercard|paid|thanh toan)\b/,
  ];
  const EXCLUDE_LINE = /(sub ?total|tam tinh|tax|gst|vat|thue|change|tien thoi|tien thua|tien khach dua|cash tendered|tendered|rounding|discount|giam gia|so luong|qty|quantity|points|diem|saving|you saved|\*{3,}|x{4,}|auth|approval|ref no|terminal)/;

  /** Footer small print: "access winmart.vn within 60 minutes", hotlines, websites. */
  const FOOTER_NOISE = /(phut|minute|hotline|truy cap|www|http|\.vn\b|\.com|website|xuat hoa don|ma xac thuc|tra cuu)/;

  /** OCR often turns "1,180,521" into "1 180 521". Rejoin digit groups split by spaces. */
  function joinSpacedThousands(line) {
    return line.replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1,');
  }

  /** Reject amounts that can't be a receipt total in this currency (e.g. ₫60). */
  function plausibleTotal(n, currency) {
    if (!Number.isFinite(n) || n <= 0) return false;
    // Smallest believable receipt in high-denomination currencies (rules out "₫60").
    const MIN = { VND: 1000, IDR: 500, LAK: 500, IRR: 1000, UZS: 500, KHR: 100, MMK: 50, KRW: 10, JPY: 10 };
    return n >= (MIN[currency] || 0.01) && n < 1e10;
  }

  function extractTotal(text, currency) {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const pick = (line) => moneyTokens(joinSpacedThousands(line)).filter((n) => plausibleTotal(n, currency));
    for (let rank = 0; rank < TOTAL_KEYWORDS.length; rank++) {
      // Walk from the bottom: totals sit near the end of a receipt.
      for (let i = lines.length - 1; i >= 0; i--) {
        const f = fold(lines[i]);
        if (FOOTER_NOISE.test(f)) continue;
        // "Total incl. GST 45.20" is a total; "GST included in total 4.11" is not.
        const forExclude = f.replace(/\b(inc|incl|including|da bao gom|bao gom)\.? ?(gst|tax|vat|thue)\b/g, '');
        if (!TOTAL_KEYWORDS[rank].test(f) || EXCLUDE_LINE.test(forExclude)) continue;
        let nums = pick(lines[i]);
        // Amount is sometimes on the next line.
        if (!nums.length && lines[i + 1]) nums = pick(lines[i + 1]);
        if (nums.length) {
          return { amount: nums[nums.length - 1], confidence: rank <= 2 ? 'high' : 'medium' };
        }
      }
    }
    // Fallback: the largest plausible amount, ignoring long ID-like digit runs.
    let best = NaN;
    for (const line of lines) {
      if (FOOTER_NOISE.test(fold(line))) continue;
      if (/\d{9,}/.test(line.replace(/[\s.,]/g, '')) && !/[.,]\d{3}\b/.test(line)) continue;
      for (const n of pick(line)) {
        if (!Number.isFinite(best) || n > best) best = n;
      }
    }
    return { amount: best, confidence: Number.isFinite(best) ? 'low' : 'none' };
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Whole-word match so "iga" doesn't hit "gigabyte" or "pho" hit "phone". */
  function hasWord(haystack, word) {
    const w = word.trim();
    return new RegExp(`(^|[^a-z0-9])${escapeRe(w)}([^a-z0-9]|$)`).test(haystack);
  }

  /**
   * OCR confuses look-alike glyphs ("WinMart" → "Wlnrnart"). Compare brand keys
   * and text on the same reduced "skeleton" so those still match.
   */
  function skeleton(str) {
    return fold(str)
      .replace(/rn/g, 'm')
      .replace(/vv/g, 'w')
      .replace(/[l1|!]/g, 'i')
      .replace(/0/g, 'o')
      .replace(/\s+/g, ' ');
  }

  const BRAND_SKELETONS = KNOWN_MERCHANTS.map(([key, name, category]) => ({
    key: skeleton(key).trim(),
    name,
    category,
  }));

  function findKnownMerchant(text) {
    const f = skeleton(text);
    for (const b of BRAND_SKELETONS) {
      if (hasWord(f, b.key)) return { name: b.name, category: b.category };
    }
    return null;
  }

  const DOMAIN_RE = /([a-z0-9-]+)\.(?:com\.vn|com\.au|net\.au|vn|com|au)\b/g;
  const IGNORE_DOMAINS = /^(www|gov|facebook|fb|zalo|google|gmail|youtube|instagram|tiktok|hoadon|einvoice|xuathoadon|tracuu|tracuuhoadon|vnpt|viettel-?invoice|misa|meinvoice|bkav)$/;

  /** Store web addresses usually survive OCR better than stylised logos. */
  function domainLabels(text) {
    const out = [];
    const f = fold(text);
    let m;
    DOMAIN_RE.lastIndex = 0;
    while ((m = DOMAIN_RE.exec(f))) {
      if (!IGNORE_DOMAINS.test(m[1]) && m[1].length >= 3) out.push(m[1]);
    }
    return out;
  }

  /** A line ending in a price: "Phin Sữa Đá x2 78.000", "MILK 2L 3.10". Not times or dates. */
  const PRICE_AT_END = /(?:\d{1,3}(?:[.,\s]\d{3})+|\d+[.,]\d{2})\s*(?:đ|₫|vnd|vnđ|d)?\s*$/i;

  function splitLines(text) {
    return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }

  /**
   * Find the store's brand without being fooled by products: supermarket line
   * items name brands too ("TRUNG NGUYÊN Cafe xay" at WinMart). Only the
   * header, the footer and the store's web address count.
   */
  function findBrandInReceipt(text) {
    const lines = splitLines(text);
    // Header = above the first priced line; footer = below the last one.
    const priced = lines.map((l) => PRICE_AT_END.test(l));
    const first = priced.indexOf(true);
    const last = priced.lastIndexOf(true);
    const header = lines.slice(0, Math.min(first < 0 ? 8 : first, 8)).join('\n');
    const footer = last < 0 ? '' : lines.slice(last + 1).slice(-6).join('\n');
    const inHeader = findKnownMerchant(header);
    if (inHeader) return inHeader;
    const inFooter = findKnownMerchant(footer);
    if (inFooter) return inFooter;
    for (const label of domainLabels(text)) {
      const known = findKnownMerchant(label);
      if (known) return known;
    }
    return null;
  }

  const NOT_MERCHANT = /(^nv\b|mat hang|receipt|tax invoice|invoice|hoa don|phieu|bien nhan|abn|mst|ma so thue|tel|phone|dien thoai|dt:|date|ngay|time|gio|cashier|thu ngan|table|ban so|order|www\.|http|@|address|dia chi|welcome|xin chao|cam on|thank)/;

  function extractMerchant(text) {
    const known = findBrandInReceipt(text);
    if (known) return { name: known.name, knownCategory: known.category };
    const lines = splitLines(text);
    // Only lines above the first priced item can be the shop name. If nothing
    // there looks like a real name, leave it blank rather than guess.
    const firstPriced = lines.findIndex((l) => PRICE_AT_END.test(l));
    const header = lines.slice(0, Math.min(firstPriced < 0 ? 4 : firstPriced, 4));
    for (const line of header) {
      const letters = (line.match(/\p{L}/gu) || []).length;
      if (letters < 4) continue;
      if (NOT_MERCHANT.test(fold(line))) continue;
      if (letters / line.replace(/\s/g, '').length < 0.75) continue; // digits/symbols → address or noise
      if (!/\p{L}{4,}/u.test(line)) continue; // needs at least one real word
      return { name: tidyName(line), knownCategory: null };
    }
    const label = domainLabels(text)[0];
    if (label) return { name: label.charAt(0).toUpperCase() + label.slice(1), knownCategory: null };
    return { name: '', knownCategory: null };
  }

  function tidyName(line) {
    const clean = line.replace(/[|_*=~#"“”‘’`´]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    // Title-case shouty receipt headers: "PHO HOA PASTEUR" → "Pho Hoa Pasteur".
    if (clean === clean.toUpperCase()) {
      return clean.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, s, c) => s + c.toUpperCase());
    }
    return clean;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** Day-first (AU / VN). Returns YYYY-MM-DD or ''. */
  function extractDate(text, today) {
    const s = String(text || '');
    const now = today ? new Date(today) : new Date();
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
    if (m) {
      let y = +m[3];
      if (y < 100) y += 2000;
      return valid(y, +m[2], +m[1]);
    }
    return '';

    function valid(y, mo, d) {
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
      const iso = `${y}-${pad(mo)}-${pad(d)}`;
      // Reject future dates beyond a day of clock skew and anything absurdly old.
      const t = Date.parse(iso);
      if (!Number.isFinite(t) || t > now.getTime() + 86400000 || y < 2000) return '';
      return iso;
    }
  }

  /**
   * @param {string} merchant
   * @param {string} [fullText]
   * @param {Record<string,string>} [learned] merchant(lower) → category id
   */
  function categorise(merchant, fullText, learned) {
    const key = fold(merchant).trim();
    if (key && learned && learned[key]) return learned[key];
    const known = findKnownMerchant(merchant) || findBrandInReceipt(fullText || '');
    if (known) return known.category;
    const pricedLines = splitLines(fullText).filter((l) => moneyTokens(l).length).length;
    const hay = fold(merchant + ' ' + (fullText || '')).replace(/\s+/g, ' ');
    let best = 'other';
    let bestScore = 0;
    for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      // Words in the merchant name count triple: "Phở Hòa" beats a stray "water" line.
      for (const w of words) if (hasWord(hay, w)) score += hasWord(key, w) ? 3 : 1;
      // A long itemised receipt is almost always a supermarket shop.
      if (cat === 'groceries' && pricedLines >= 10) score += 4;
      if (score > bestScore) {
        best = cat;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * Full pipeline for OCR text.
   * @returns {{merchant:string, amount:number, currency:string, date:string, category:string, confidence:string, currencyDetected:boolean}}
   */
  function parseReceiptText(text, options = {}) {
    const currency = detectCurrency(text, options.defaultCurrency);
    const total = extractTotal(text, currency.code);
    const merchant = extractMerchant(text);
    const date = extractDate(text, options.today) || todayIso(options.today);
    const category = categorise(merchant.name, text, options.learned);
    return {
      merchant: merchant.name,
      amount: total.amount,
      currency: currency.code,
      currencyDetected: currency.detected,
      date,
      category,
      confidence: total.confidence,
    };
  }

  function todayIso(today) {
    const d = today ? new Date(today) : new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ---------------------------------------------------------------------------
  // Analysis
  // ---------------------------------------------------------------------------

  /** Inclusive [from, to] YYYY-MM-DD bounds for a named period. */
  function periodBounds(period, today) {
    const d = today ? new Date(today) : new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    switch (period) {
      case 'this-month':
        return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
      case 'last-month':
        return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
      case 'last-3-months':
        return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
      case 'this-year':
        return { from: `${y}-01-01`, to: `${y}-12-31` };
      default:
        return { from: '0000-01-01', to: '9999-12-31' };
    }
  }

  /**
   * @param {Array} receipts
   * @param {{from:string,to:string}} bounds
   * @param {(amount:number, code:string) => number} toReporting  NaN when no rate
   */
  function analyse(receipts, bounds, toReporting) {
    const inRange = (receipts || []).filter((r) => r.date >= bounds.from && r.date <= bounds.to);
    const byCategory = {};
    const byMerchant = {};
    const byMonth = {};
    let total = 0;
    let skipped = 0;

    for (const r of inRange) {
      const v = toReporting(Number(r.amount), r.currency);
      if (!Number.isFinite(v)) {
        skipped++;
        continue;
      }
      total += v;
      byCategory[r.category] = (byCategory[r.category] || 0) + v;
      const mk = r.merchant || 'Unknown';
      if (!byMerchant[mk]) byMerchant[mk] = { total: 0, count: 0, category: r.category };
      byMerchant[mk].total += v;
      byMerchant[mk].count++;
      const month = r.date.slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + v;
    }

    const counted = inRange.length - skipped;
    return {
      total,
      count: counted,
      skipped,
      average: counted ? total / counted : 0,
      categories: Object.entries(byCategory)
        .map(([id, amount]) => ({ id, amount, share: total ? amount / total : 0 }))
        .sort((a, b) => b.amount - a.amount),
      merchants: Object.entries(byMerchant)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total),
      months: Object.entries(byMonth)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => (a.month < b.month ? -1 : 1)),
    };
  }

  /** CSV of data points only (no images, nothing else). */
  function toCsv(receipts) {
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [['date', 'merchant', 'amount', 'currency', 'category']];
    for (const r of receipts) {
      rows.push([r.date, r.merchant, r.amount, r.currency, labelFor(r.category)]);
    }
    return rows.map((row) => row.map(esc).join(',')).join('\n');
  }

  function labelFor(id) {
    const c = CATEGORIES.find((x) => x.id === id);
    return c ? c.label : id;
  }

  return {
    CATEGORIES,
    fold,
    parseMoney,
    moneyTokens,
    detectCurrency,
    extractTotal,
    plausibleTotal,
    extractMerchant,
    extractDate,
    categorise,
    parseReceiptText,
    periodBounds,
    analyse,
    toCsv,
    labelFor,
    todayIso,
  };
});
