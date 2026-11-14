/* Golf tournament donation: amount + details -> Stripe Checkout (via Apps Script) -> thank-you page */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkz-9usy95-SHPOHU33SwZUxk0MTxKbgfPiRwzSTGq7yeqmOjw0MR3JJn6boWR7E9y4A/exec';
  var MIN = 1, MAX = 100000;
  var DRAFT_KEY = 'sigepGolfDonationDraft';

  var form = document.querySelector('[data-donate-form]');
  if (!form) return;

  var statusEl = form.querySelector('[data-donate-status]');
  var submitBtn = form.querySelector('[data-donate-submit]');
  var chips = form.querySelectorAll('[data-amount]');
  var amountInput = form.elements.amount;

  function parseAmount(raw) {
    var s = String(raw || '').replace(/[$,\s]/g, '');
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
    var n = parseFloat(s);
    return n >= MIN && n <= MAX ? Math.round(n * 100) / 100 : null;
  }
  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function syncAmount() {
    var a = parseAmount(amountInput.value);
    submitBtn.textContent = a ? 'Continue to payment · ' + money(a) : 'Continue to payment';
    chips.forEach(function (c) {
      c.setAttribute('aria-pressed', String(a !== null && a === Number(c.getAttribute('data-amount'))));
    });
  }

  function setError(name, msg) {
    var input = form.elements[name];
    var wrap = input.closest('.field');
    var err = wrap.querySelector('.field-error');
    wrap.classList.toggle('has-error', !!msg);
    if (err) err.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err && err.id) input.setAttribute('aria-describedby', err.id);
  }

  function validate() {
    var f = form.elements;
    var checks = [
      ['amount', function (v) {
        if (!String(v).trim()) return 'Please enter a donation amount.';
        return parseAmount(v) ? '' : 'Enter an amount between $1 and $100,000 (up to two decimal places).';
      }],
      ['name', function (v) { return v.trim() ? '' : 'Please enter your full name.'; }],
      ['phone', function (v) { return v.replace(/\D/g, '').length >= 7 ? '' : 'Please enter a valid phone number.'; }]
    ];
    var first = null;
    checks.forEach(function (c) {
      var msg = c[1](f[c[0]].value);
      setError(c[0], msg);
      if (msg && !first) first = f[c[0]];
    });
    if (first) first.focus();
    return !first;
  }

  function showStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'form-status is-visible ' + (kind || '');
  }

  function payload() {
    var f = form.elements;
    return {
      action: 'donate',
      amount: parseAmount(f.amount.value),
      name: f.name.value, phone: f.phone.value, note: f.note.value,
      website: f.website.value
    };
  }

  /* Keep their answers if they back out of the Stripe page */
  function saveDraft() {
    try {
      var d = {};
      ['amount', 'name', 'phone', 'note'].forEach(function (n) { d[n] = form.elements[n].value; });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* storage unavailable */ }
  }
  function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return false;
      ['amount', 'name', 'phone', 'note'].forEach(function (n) { if (typeof d[n] === 'string') form.elements[n].value = d[n]; });
      return true;
    } catch (e) { return false; }
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      amountInput.value = c.getAttribute('data-amount');
      setError('amount', '');
      syncAmount();
      saveDraft();
    });
  });
  form.addEventListener('input', function (e) { if (e.target === amountInput) syncAmount(); saveDraft(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.className = 'form-status';
    if (!validate()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Taking you to secure payment…';
    fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload())
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok && data.url) { window.location.href = data.url; return; }
        throw new Error((data && data.error) || 'Something went wrong.');
      })
      .catch(function (err) {
        submitBtn.disabled = false;
        syncAmount();
        showStatus((err && err.message ? err.message : 'Something went wrong.') + ' Your answers are saved — please try again.', 'error');
      });
  });

  if (restoreDraft() && window.location.hash === '#donate') {
    showStatus('Welcome back — your details are still here. Continue to payment whenever you’re ready.', 'success');
  }
  syncAmount();
})();
