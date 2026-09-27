/**
 * SigEp Texas Kappa — Golf Tournament registration backend (Google Apps Script)
 *
 * Flow: site form -> doPost(checkout) creates a Stripe Checkout Session and logs a "Pending" row
 *       -> Stripe hosted payment -> success page calls doGet(confirm) -> paid rows are moved to "Registrations".
 * A 5-minute trigger (reconcilePending) also confirms anyone who paid but closed the tab.
 * Prices are set HERE (never trusted from the browser). The Stripe secret key lives in Script Properties only.
 *
 * Script Properties required:  STRIPE_SECRET_KEY (sk_test_... / sk_live_...)   SITE_URL (e.g. https://yoursite.com, no trailing slash)
 */
const CONFIG = {
  EVENT_NAME: '40th Annual SigEp Golf Tournament',
  PRICES: {
    individual: { cents: 40000, label: 'Individual Golfer' },
    team: { cents: 150000, label: 'Team of 4 (Foursome)' }
  },
  REG_SHEET: 'Registrations',
  PENDING_SHEET: 'Pending'
};
const COLUMNS = ['Submitted', 'Stripe Session', 'Status', 'Type', 'Name', 'Email', 'Phone', 'Team Name',
  'Other Players', 'Shirt Size', 'Dietary', 'Sponsor Interest', 'Heard About', 'Comments'];
const REG_EXTRA = ['Paid At', 'Amount Paid', 'Payment Intent'];

/** Run once from the editor: creates both tabs and the 5-minute reconcile trigger. */
function setup() {
  getSheet_(CONFIG.PENDING_SHEET, COLUMNS);
  getSheet_(CONFIG.REG_SHEET, COLUMNS.concat(REG_EXTRA));
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'reconcilePending') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('reconcilePending').timeBased().everyMinutes(5).create();
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'checkout') return json_(createCheckout_(body));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doGet(e) {
  try {
    if (e.parameter.action === 'confirm') return json_(confirmSession_(e.parameter.session_id));
    return json_({ ok: true, service: 'sigep-golf-registration' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function createCheckout_(b) {
  if (b.website) return { ok: false, error: 'Rejected' }; // honeypot
  const plan = CONFIG.PRICES[b.type];
  if (!plan) throw new Error('Choose individual or team registration.');
  const name = safe_(b.name, 100), email = safe_(b.email, 120), phone = safe_(b.phone, 30);
  if (!name) throw new Error('Name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is required.');
  if (phone.replace(/\D/g, '').length < 7) throw new Error('A valid phone number is required.');
  const players = (b.players || []).slice(0, 3).map(function (p) { return safe_(p, 100); }).filter(String);
  if (b.type === 'team' && players.length < 3) throw new Error('List all 3 other team members.');

  const siteUrl = prop_('SITE_URL');
  const params = {
    'mode': 'payment',
    'success_url': siteUrl + '/golf-registration-success.html?session_id={CHECKOUT_SESSION_ID}',
    'cancel_url': siteUrl + '/golf-tournament.html#register',
    'customer_email': email,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(plan.cents),
    'line_items[0][price_data][product_data][name]': CONFIG.EVENT_NAME + ' — ' + plan.label,
    'metadata[type]': b.type,
    'metadata[name]': name
  };
  const session = stripe_('post', '/v1/checkout/sessions', params);

  const row = [new Date(), session.id, 'Pending', b.type, name, email, phone, safe_(b.teamName, 100),
    players.join('; '), safe_(b.shirt, 10), safe_(b.dietary, 200), b.sponsor ? 'Yes' : 'No',
    safe_(b.heard, 60), safe_(b.comments, 500)];
  withLock_(function () { getSheet_(CONFIG.PENDING_SHEET, COLUMNS).appendRow(row); });
  return { ok: true, url: session.url };
}

function confirmSession_(sessionId) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId || '')) throw new Error('Invalid session.');
  const session = stripe_('get', '/v1/checkout/sessions/' + sessionId);
  if (session.payment_status !== 'paid') return { ok: true, status: 'unpaid' };

  let result;
  withLock_(function () {
    const reg = getSheet_(CONFIG.REG_SHEET, COLUMNS.concat(REG_EXTRA));
    const pend = getSheet_(CONFIG.PENDING_SHEET, COLUMNS);
    const regRows = reg.getDataRange().getValues();
    const already = regRows.some(function (r, i) { return i > 0 && r[1] === sessionId; });

    const pRows = pend.getDataRange().getValues();
    let pIdx = -1;
    for (let i = 1; i < pRows.length; i++) if (pRows[i][1] === sessionId) { pIdx = i; break; }
    const src = pIdx > -1 ? pRows[pIdx] : null;
    const paidAmount = session.amount_total / 100;

    if (!already) {
      const base = src ? src.slice(0, COLUMNS.length) : [new Date(), sessionId, '', (session.metadata || {}).type || '',
        (session.metadata || {}).name || '', session.customer_email || '', '', '', '', '', '', '', '', ''];
      base[2] = 'Paid';
      reg.appendRow(base.concat([new Date(), paidAmount, session.payment_intent || '']));
    }
    if (pIdx > -1) pend.getRange(pIdx + 1, 3).setValue('Paid');

    const info = src || [];
    result = { ok: true, status: 'paid', name: info[4] || (session.metadata || {}).name || '',
      type: info[3] || (session.metadata || {}).type || '', teamName: info[7] || '', amount: paidAmount };
  });
  return result;
}

/** Time-driven: confirms anyone who paid but never reached the success page. */
function reconcilePending() {
  const rows = getSheet_(CONFIG.PENDING_SHEET, COLUMNS).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] !== 'Pending') continue;
    try { confirmSession_(rows[i][1]); } catch (err) { console.error(rows[i][1], err); }
  }
}

/* ---------- helpers ---------- */
function stripe_(method, path, params) {
  const opts = { method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + prop_('STRIPE_SECRET_KEY') } };
  if (params) {
    opts.contentType = 'application/x-www-form-urlencoded';
    opts.payload = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
  }
  const res = UrlFetchApp.fetch('https://api.stripe.com' + path, opts);
  const data = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 300) throw new Error((data.error && data.error.message) || 'Stripe error');
  return data;
}
function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Missing script property: ' + k);
  return v;
}
/** Trims, caps length, and neutralises spreadsheet formulas (=, +, -, @ prefixes). */
function safe_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { fn(); } finally { lock.releaseLock(); }
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
