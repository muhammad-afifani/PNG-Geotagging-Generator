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
  window.GeoStampTabs = {
    activate: (tabId) => {
      activateTab(tabId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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

  // --- range sliders: paint the filled part of the track (CSS reads --p) ---
  function syncRange(r) {
    const min = parseFloat(r.min) || 0;
    const max = parseFloat(r.max) || 100;
    const p = max > min ? ((parseFloat(r.value) - min) / (max - min)) * 100 : 0;
    r.style.setProperty('--p', Math.max(0, Math.min(100, p)) + '%');
  }
  function syncAllRanges() {
    document.querySelectorAll('input[type="range"]').forEach(syncRange);
  }
  document.addEventListener('input', (e) => {
    if (e.target.matches && e.target.matches('input[type="range"]')) syncRange(e.target);
  });
  window.addEventListener('geostamp:settingschange', syncAllRanges);
  window.addEventListener('geostamp:uisync', syncAllRanges);
  syncAllRanges();

  // --- settings groups (<details>): remember which ones are open ---
  const GROUPS_KEY = 'geostamp_groups_open';
  let openGroups = null;
  try { openGroups = JSON.parse(localStorage.getItem(GROUPS_KEY) || 'null'); } catch (e) { /* ignore */ }
  document.querySelectorAll('details.group[data-group]').forEach((d) => {
    if (openGroups && typeof openGroups[d.dataset.group] === 'boolean') d.open = openGroups[d.dataset.group];
    d.addEventListener('toggle', () => {
      openGroups = openGroups || {};
      openGroups[d.dataset.group] = d.open;
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(openGroups)); } catch (e) { /* ignore */ }
    });
  });

  // --- generic collapsible card (e.g. Tab 1's "Data Foto" step) ---
  document.querySelectorAll('.card-collapse-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.collapsible-card');
      if (!card) return;
      const collapsed = card.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
  });
})();
