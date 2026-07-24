/* tabs.js — tab navigation + coffee/QRIS modal */
(function () {
  'use strict';

  // --- tab switching ---
  const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));

  function activateTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle('active', p.id === tabId));
    // let other modules know a tab became visible (e.g. refresh stats)
    window.dispatchEvent(new CustomEvent('geostamp:tabchange', { detail: { tab: tabId } }));
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // --- coffee / QRIS modal ---
  const coffeeBtn = document.getElementById('coffeeBtn');
  const coffeeModal = document.getElementById('coffeeModal');
  const coffeeClose = document.getElementById('coffeeClose');

  function openCoffee() { coffeeModal.classList.remove('hidden'); }
  function closeCoffee() { coffeeModal.classList.add('hidden'); }

  if (coffeeBtn) coffeeBtn.addEventListener('click', openCoffee);
  if (coffeeClose) coffeeClose.addEventListener('click', closeCoffee);
  if (coffeeModal) {
    coffeeModal.addEventListener('click', (e) => {
      if (e.target === coffeeModal) closeCoffee();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && coffeeModal && !coffeeModal.classList.contains('hidden')) {
      closeCoffee();
    }
  });

  // exposed globally so the post-generate "Traktir Kopi" CTA in
  // main.js / attach.js / geotag.js's done-messages can open the same
  // modal without duplicating the open/close logic in each file
  window.openCoffeeModal = openCoffee;
  window.coffeeCtaHtml = function () {
    // kept fully inline (no block-level tags) so it stays inside the
    // same flex item as the rest of .done-msg's content instead of
    // wrapping onto its own row next to the checkmark icon
    return '<br><span class="coffee-cta">Kalau tool ini bermanfaat buat pekerjaanmu, boleh '
      + '<button type="button" class="coffee-cta-link">traktir kopi</button> supaya saya tetap semangat '
      + 'membagikan tools yang mempermudah pekerjaanmu ke depannya.</span>';
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('.coffee-cta-link')) openCoffee();
  });

  // --- guide / onboarding banner: single toggle, collapsed state persists ---
  const GUIDE_KEY = 'geostamp_guide_collapsed';
  const guideBanner = document.getElementById('guideBanner');
  const guideToggleBtn = document.getElementById('guideToggleBtn');

  function setGuideCollapsed(collapsed) {
    if (!guideBanner) return;
    guideBanner.classList.toggle('collapsed', collapsed);
    if (guideToggleBtn) guideToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    try { localStorage.setItem(GUIDE_KEY, collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  if (guideBanner) {
    let collapsed = false;
    try { collapsed = localStorage.getItem(GUIDE_KEY) === '1'; } catch (e) { /* ignore */ }
    setGuideCollapsed(collapsed);
  }
  if (guideToggleBtn) {
    guideToggleBtn.addEventListener('click', () => {
      setGuideCollapsed(!guideBanner.classList.contains('collapsed'));
    });
  }
})();
