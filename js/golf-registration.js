/* Golf tournament registration: details -> Stripe Checkout (via Apps Script) -> confirmation */
(function () {
  'use strict';

  // Paste the deployed Apps Script web-app URL here (ends in /exec).
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkz-9usy95-SHPOHU33SwZUxk0MTxKbgfPiRwzSTGq7yeqmOjw0MR3JJn6boWR7E9y4A/exec';
  var PRICES = { individual: 135, team: 400, sponsor: 1500 };
  var DRAFT_KEY = 'sigepGolfDraft';

  var form = document.querySelector('[data-reg-form]');
  if (!form) return;

  var teamFields = form.querySelector('[data-team-fields]');
  var sponsorFields = form.querySelector('[data-sponsor-fields]');
  var sponsorInterestField = form.querySelector('[data-sponsor-interest-field]');
  var statusEl = form.querySelector('[data-reg-status]');
  var submitBtn = form.querySelector('[data-reg-submit]');

  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function type() { return form.elements.type.value; }
  function needsFoursome(t) { return t === 'team' || t === 'sponsor'; }

  function syncType() {
    var t = type();
    teamFields.hidden = !needsFoursome(t);
    sponsorFields.hidden = t !== 'sponsor';
    sponsorInterestField.hidden = t === 'sponsor';
    submitBtn.textContent = 'Continue to payment · ' + money(PRICES[t]);
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
    var t = type();
    var checks = [
      ['name', function (v) { return v.trim() ? '' : 'Please enter your full name.'; }],
      ['email', function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) ? '' : 'Please enter a valid email address.'; }],
      ['phone', function (v) { return v.replace(/\D/g, '').length >= 7 ? '' : 'Please enter a valid phone number.'; }],
      ['shirt', function (v) { return v ? '' : 'Please choose a shirt size.'; }]
    ];
    if (needsFoursome(t)) {
      ['player1', 'player2', 'player3'].forEach(function (n) {
        checks.push([n, function (v) { return v.trim() ? '' : 'Please enter this player’s name.'; }]);
      });
    }
    if (t === 'sponsor') {
      checks.push(['companyName', function (v) { return v.trim() ? '' : 'Please enter your company or organization name.'; }]);
    }
    var first = null;
    checks.forEach(function (c) {
      var msg = c[1](form.elements[c[0]].value);
      setError(c[0], msg);
      if (msg && !first) first = form.elements[c[0]];
    });
    ['player1', 'player2', 'player3'].forEach(function (n) { if (!needsFoursome(t)) setError(n, ''); });
    if (t !== 'sponsor') setError('companyName', '');
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
      action: 'checkout',
      type: type(),
      name: f.name.value, email: f.email.value, phone: f.phone.value, shirt: f.shirt.value,
      teamName: f.teamName.value, companyName: f.companyName.value,
      players: needsFoursome(type()) ? [f.player1.value, f.player2.value, f.player3.value] : [],
      dietary: f.dietary.value, heard: f.heard.value, sponsor: f.sponsor.checked,
      comments: f.comments.value, website: f.website.value
    };
  }

  /* Draft persistence, so a cancelled Stripe visit doesn't lose their answers */
  function saveDraft() {
    try {
      var d = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.name === 'website') return;
        if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
        else if (el.type === 'checkbox') d[el.name] = el.checked;
        else d[el.name] = el.value;
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* storage unavailable */ }
  }
  function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return false;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || !(el.name in d) || el.name === 'website') return;
        if (el.type === 'radio') el.checked = el.value === d[el.name];
        else if (el.type === 'checkbox') el.checked = !!d[el.name];
        else el.value = d[el.name];
      });
      return true;
    } catch (e) { return false; }
  }

  form.addEventListener('input', saveDraft);
  form.addEventListener('change', function (e) { if (e.target.name === 'type') syncType(); saveDraft(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.className = 'form-status';
    if (!validate()) return;

    if (!SCRIPT_URL) {
      showStatus('Online payment isn’t switched on yet, so we can’t take registrations here just now. Please check back soon or reach out through Contact Us.', 'error');
      return;
    }

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
        syncType();
        showStatus((err && err.message ? err.message : 'Something went wrong.') + ' Your answers are saved — please try again.', 'error');
      });
  });

  if (restoreDraft() && window.location.hash === '#register') {
    showStatus('Welcome back — your details are still here. Continue to payment whenever you’re ready.', 'success');
  }
  syncType();
})();
