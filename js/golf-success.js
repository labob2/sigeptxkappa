/* Confirmation page: verifies the Stripe payment via Apps Script before showing "registered" */
(function () {
  'use strict';
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkz-9usy95-SHPOHU33SwZUxk0MTxKbgfPiRwzSTGq7yeqmOjw0MR3JJn6boWR7E9y4A/exec'; // same Apps Script URL as golf-registration.js
  var box = document.querySelector('[data-result]');
  if (!box) return;

  var sid = new URLSearchParams(window.location.search).get('session_id');
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function render(html) { box.innerHTML = html; }

  var icon = function (path) { return '<span class="value-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg></span>'; };
  var back = '<a class="btn btn-ghost" href="golf-tournament.html">Back to the tournament page</a>';

  function paid(d) {
    try { localStorage.removeItem('sigepGolfDraft'); } catch (e) {}
    var typeLabel = d.type === 'sponsor' ? 'Tournament Sponsor' : d.type === 'team' ? 'Team of 4' : 'Individual Golfer';
    var heading = d.type === 'sponsor' ? 'You’re a sponsor!' : 'You’re registered!';
    var thanksLine = d.type === 'sponsor'
      ? 'Your payment went through and your sponsorship of the 40th Annual Golf Tournament is confirmed — including a foursome for your company. We’ll email you at the address you provided to collect your logo for the hole sign and website. Stripe is emailing you a receipt.'
      : 'Your payment went through and your spot in the 40th Annual Golf Tournament is confirmed. Stripe is emailing you a receipt.';
    render(icon('<path d="M5 12l5 5 9-10"/>') +
      '<h1>' + heading + '</h1>' +
      '<p class="lede">Thank you' + (d.name ? ', ' + esc(d.name) : '') + '. ' + thanksLine + '</p>' +
      '<dl><dt>Registration</dt><dd>' + typeLabel + '</dd>' +
      (d.companyName ? '<dt>Company</dt><dd>' + esc(d.companyName) + '</dd>' : '') +
      (d.teamName ? '<dt>Team</dt><dd>' + esc(d.teamName) + '</dd>' : '') +
      '<dt>Amount paid</dt><dd>$' + Number(d.amount).toLocaleString('en-US') + '</dd>' +
      '<dt>When</dt><dd>Saturday, November 14, 2026 · Iron Horse Golf Course</dd></dl>' +
      '<p class="text-muted">Check-in opens at 12:30 PM with a 2:00 PM shotgun start.</p>' + back);
  }

  function processing(d) {
    try { localStorage.removeItem('sigepGolfDraft'); } catch (e) {}
    var noun = d.type === 'sponsor' ? 'sponsorship' : 'registration';
    render(icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/>') +
      '<h1>Payment processing…</h1>' +
      '<p class="lede">Thanks! Your bank payment (ACH) is being processed. That typically takes 3–5 business days to clear — we’ll finish your ' + noun + ' automatically the moment it does, no need to do anything else. You can safely close this page.</p>' +
      '<p class="text-muted">Questions in the meantime? Reach out through <a href="contact.html" class="link-underline" style="color:inherit">Contact Us</a>.</p>' + back);
  }

  function fail(msg, retry) {
    render(icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>') +
      '<h1>' + esc(msg) + '</h1>' +
      '<p class="lede">If you were charged, don’t pay again — your registration will be confirmed automatically within a few minutes. Questions? Reach out through Contact Us.</p>' +
      (retry ? '<button class="btn btn-primary" type="button" data-retry>Check again</button>' : '') +
      '<a class="btn btn-ghost" href="contact.html">Contact Us</a>');
    var b = box.querySelector('[data-retry]');
    if (b) b.addEventListener('click', function () { attempt(0); });
  }

  function attempt(n) {
    render('<h1>Confirming your payment…</h1><p class="lede">One moment while we verify it with Stripe.</p>');
    if (!sid || !SCRIPT_URL) { fail('We couldn’t verify this payment', false); return; }
    fetch(SCRIPT_URL + '?action=confirm&session_id=' + encodeURIComponent(sid))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && d.status === 'paid') return paid(d);
        if (d.ok && d.status === 'processing') return processing(d);
        if (d.ok && d.status === 'unpaid') {
          render(icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>') +
            '<h1>Payment not completed</h1><p class="lede">No charge was made and you aren’t registered yet. Your details are saved — head back to finish.</p>' +
            '<a class="btn btn-primary" href="golf-tournament.html#register">Return to registration</a>');
          return;
        }
        throw new Error(d.error || 'unknown');
      })
      .catch(function () {
        if (n < 3) setTimeout(function () { attempt(n + 1); }, 3000);
        else fail('We’re still confirming your payment', true);
      });
  }
  attempt(0);
})();
