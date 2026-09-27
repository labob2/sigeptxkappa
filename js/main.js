/* Sigma Phi Epsilon — Texas Kappa | site behavior */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Search index (site-wide) ---------- */
  var SEARCH_INDEX = [
    { label: 'Home', tag: 'Page', href: 'index.html' },
    { label: 'About the Chapter', tag: 'Section', href: 'index.html#about' },
    { label: 'Our Programs', tag: 'Section', href: 'index.html#programs' },
    { label: 'Gallery', tag: 'Section', href: 'index.html#gallery' },
    { label: 'Annual Golf Tournament', tag: 'Page', href: 'golf-tournament.html' },
    { label: 'Tri-State Tournament', tag: 'Page', href: 'tri-state-tournament.html' },
    { label: 'AVC Board', tag: 'Page', href: 'avc-board.html' },
    { label: 'Alumni & Volunteer Corporation', tag: 'Page', href: 'avc-board.html' },
    { label: 'Exec Board', tag: 'Page', href: 'exec-board.html' },
    { label: 'Executive Board', tag: 'Page', href: 'exec-board.html' },
    { label: 'Philanthropy', tag: 'Page', href: 'philanthropy.html' },
    { label: 'Contact Us', tag: 'Page', href: 'contact.html' },
    { label: 'Brother Login', tag: 'Portal', href: '#brother-login' },
    { label: 'Exec Login', tag: 'Portal', href: '#exec-login' }
  ];

  /* ---------- Navbar scroll state ---------- */
  var nav = document.querySelector('[data-nav]');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile drawer ---------- */
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var drawer = document.querySelector('[data-drawer]');
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    menuToggle && menuToggle.classList.remove('is-open');
    menuToggle && menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  function toggleDrawer() {
    if (!drawer) return;
    var open = drawer.classList.toggle('is-open');
    menuToggle.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleDrawer);
  }
  if (drawer) {
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });
  }

  /* ---------- Generic overlay open/close (search + modals) ---------- */
  function openOverlay(el, focusTarget) {
    if (!el) return;
    el.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    el.setAttribute('aria-hidden', 'false');
    window.setTimeout(function () {
      (focusTarget || el.querySelector('input, button, [href]')) && (focusTarget || el.querySelector('input, button, [href]')).focus();
    }, 60);
  }
  function closeOverlay(el) {
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.is-open.modal-overlay, .is-open.search-overlay')) {
      document.body.style.overflow = '';
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.is-open, .search-overlay.is-open').forEach(closeOverlay);
      closeDrawer();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      var search = document.querySelector('[data-search-overlay]');
      if (search) {
        search.classList.contains('is-open') ? closeOverlay(search) : openOverlay(search, search.querySelector('input'));
      }
    }
  });

  document.querySelectorAll('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.querySelector(btn.getAttribute('data-open'));
      openOverlay(target, target && target.querySelector('input'));
    });
  });
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeOverlay(btn.closest('.modal-overlay, .search-overlay'));
    });
  });
  document.querySelectorAll('.modal-overlay, .search-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay(overlay);
    });
  });

  /* ---------- Search behavior ---------- */
  var searchInput = document.querySelector('[data-search-input]');
  var searchResults = document.querySelector('[data-search-results]');

  function renderResults(query) {
    if (!searchResults) return;
    var q = query.trim().toLowerCase();
    var matches = q
      ? SEARCH_INDEX.filter(function (item) { return item.label.toLowerCase().indexOf(q) !== -1; })
      : SEARCH_INDEX.slice(0, 6);

    searchResults.innerHTML = '';
    if (!matches.length) {
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = 'No matches for "' + query + '". Try “golf,” “philanthropy,” or “contact.”';
      searchResults.appendChild(empty);
      return;
    }
    matches.forEach(function (item, i) {
      var a = document.createElement('a');
      a.href = item.href;
      if (i === 0) a.classList.add('is-selected');
      a.innerHTML = '<span>' + item.label + '</span><span class="tag">' + item.tag + '</span>';
      searchResults.appendChild(a);
    });
  }

  if (searchInput) {
    renderResults('');
    searchInput.addEventListener('input', function () { renderResults(searchInput.value); });
    searchInput.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(searchResults.querySelectorAll('a'));
      if (!items.length) return;
      var idx = items.findIndex(function (i) { return i.classList.contains('is-selected'); });
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[idx] && items[idx].classList.remove('is-selected');
        idx = (idx + 1) % items.length;
        items[idx].classList.add('is-selected');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[idx] && items[idx].classList.remove('is-selected');
        idx = (idx - 1 + items.length) % items.length;
        items[idx].classList.add('is-selected');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var target = items[idx] || items[0];
        if (target) window.location.href = target.getAttribute('href');
      }
    });
  }

  /* ---------- Login portal modals (placeholder — future functionality) ---------- */
  document.querySelectorAll('[data-portal-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('[data-form-status]');
      if (status) {
        status.textContent = 'Member login is coming soon. Check back once brother and exec accounts are live.';
        status.classList.add('is-visible', 'success');
      }
    });
  });

  /* ---------- Contact form (placeholder — no backend yet) ---------- */
  var contactForm = document.querySelector('[data-contact-form]');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = contactForm.elements;
      var subject = f['c-subject'].value.trim() || 'Message from the Texas Kappa website';
      var body = 'Name: ' + f['c-name'].value.trim() + '\nEmail: ' + f['c-email'].value.trim() + '\n\n' + f['c-message'].value.trim();
      var status = contactForm.querySelector('[data-form-status]');
      if (status) {
        status.textContent = 'Opening your email app with your message ready to send to sigep.texaskappa.uta@gmail.com. If nothing opens, please email us directly at that address.';
        status.classList.add('is-visible', 'success');
      }
      window.location.href = 'mailto:sigep.texaskappa.uta@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Hero video: pause when offscreen / reduced motion ---------- */
  var heroVideo = document.querySelector('[data-hero-video]');
  if (heroVideo) {
    if (reduceMotion.matches) {
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            heroVideo.play().catch(function () {});
          } else {
            heroVideo.pause();
          }
        });
      }, { threshold: 0.1 });
      io.observe(heroVideo);
    }
  }

  /* ---------- Scroll reveal (GSAP if available, CSS fallback otherwise) ---------- */
  function fallbackReveal() {
    var els = document.querySelectorAll('.reveal, .stagger-grid > *');
    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !seen.has(entry.target)) {
          seen.add(entry.target);
          entry.target.style.transition = 'opacity 600ms cubic-bezier(.16,1,.3,1), transform 600ms cubic-bezier(.16,1,.3,1)';
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'none';
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      io.observe(el);
    });
  }

  function gsapReveal() {
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll('.reveal').forEach(function (el) {
      gsap.from(el, {
        opacity: 0,
        y: 24,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' }
      });
    });
    document.querySelectorAll('.stagger-grid').forEach(function (grid) {
      gsap.from(grid.children, {
        opacity: 0,
        y: 24,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: grid, start: 'top 85%' }
      });
    });
  }

  if (reduceMotion.matches) {
    // Respect reduced motion: content is visible by default (see CSS), do nothing.
  } else if (window.gsap && window.ScrollTrigger) {
    gsapReveal();
  } else {
    fallbackReveal();
  }
})();
