/* ═══════════════════════════════════════
   main.js — Page logic & panel loading
   ═══════════════════════════════════════ */

const BIO = [
  {
    text: 'She is studying Electrical and Computer Engineering at {{IST}}.',
    keyword: 'IST',
    panel: 'ist'
  },
  {
    text: 'She is drawn to complex problems. The kind that sit at the intersection of structure, people, and strategy.',
    keyword: null,
    panel: null
  },
  {
    text: 'She has built {{projects}} ranging from assistive technology to data-driven applications.',
    keyword: 'projects',
    panel: 'projects'
  },
  {
    text: 'She reflects both the engineer and the creative thinker side in her {{portfolio}}.',
    keyword: 'portfolio',
    panel: null,
    href: 'portfolio.html'
  },
  {
    text: 'She has been featured in {{news and publications}}.',
    keyword: 'news and publications',
    panel: 'news'
  },
  {
    text: 'She is reachable via {{email or LinkedIn}}.',
    keyword: 'email or LinkedIn',
    panel: 'contact'
  }
];

// ── Build bio HTML ────────────────────────────────
async function buildBio() {
  const container = document.getElementById('bio-container');

  for (const item of BIO) {
    // Bio line
    const line = document.createElement('p');
    line.className = 'bio-line';

    if (item.keyword) {
      const escaped = item.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = item.text.split(`{{${item.keyword}}}`);
      const link = item.href
        ? `<a class="keyword" href="${item.href}">${item.keyword}</a>`
        : `<span class="keyword" onclick="openPanel('${item.panel}')">${item.keyword}</span>`;
      line.innerHTML = parts[0] + link + parts[1];
    } else {
      line.textContent = item.text;
    }

    container.appendChild(line);

    // Panel placeholder (loaded lazily)
    if (item.panel) {
      const wrapper = document.createElement('div');
      wrapper.className = 'expand-panel';
      wrapper.id = `panel-${item.panel}`;
      wrapper.dataset.src = `panels/${item.panel}.html`;
      wrapper.dataset.loaded = 'false';
      container.appendChild(wrapper);
    }
  }
}

// ── Load a panel's HTML on demand ────────────────
async function loadPanel(id) {
  const el = document.getElementById(`panel-${id}`);
  if (!el || el.dataset.loaded === 'true') return;

  try {
    const res  = await fetch(el.dataset.src);
    const html = await res.text();
    el.innerHTML = html;
    el.dataset.loaded = 'true';
  } catch (e) {
    console.error(`Could not load panel: ${id}`, e);
  }
}

// ── Open / close a panel ─────────────────────────
async function openPanel(id) {
  const target = document.getElementById(`panel-${id}`);
  if (!target) return;

  const isOpen = target.classList.contains('open');

  // Close all panels
  document.querySelectorAll('.expand-panel').forEach(p => p.classList.remove('open'));

  if (!isOpen) {
    await loadPanel(id);
    target.classList.add('open');
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  }
}

// ── Open / close about page ───────────────────────
function openAbout() {
  document.getElementById('about-page').classList.add('open');
  document.getElementById('close-btn').classList.add('visible');
  document.getElementById('navbar').classList.add('visible');
  document.getElementById('cv-btn').classList.add('visible');
  history.pushState({ page: 'about' }, '', window.location.pathname);
}

function closeAbout() {
  document.getElementById('about-page').classList.remove('open');
  document.getElementById('close-btn').classList.remove('visible');
  document.getElementById('navbar').classList.remove('visible');
  document.getElementById('cv-btn').classList.remove('visible');
  document.querySelectorAll('.expand-panel').forEach(p => p.classList.remove('open'));
}
window.addEventListener('popstate', (e) => {
  if (!e.state || e.state.page !== 'about') {
    closeAbout();
  }
});


// Expose to window (called from HTML onclick)
window.openAbout  = openAbout;
window.closeAbout = closeAbout;
window.openPanel  = openPanel;

// ── Nav: open about then a specific panel ─────────
// Called from nav links: openAbout(); openPanel('projects')
// The slight delay lets the about page fade in first.
const _origOpenPanel = openPanel;
window.openPanel = async function(id) {
  const aboutOpen = document.getElementById('about-page').classList.contains('open');
  if (!aboutOpen) {
    openAbout();
    await new Promise(r => setTimeout(r, 350));
  }
  _origOpenPanel(id);
};

// ── Escape key ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAbout();
});

window.addEventListener('popstate', () => {
  closeAbout();
});

// ── Init ──────────────────────────────────────────
buildBio().then(() => {
  if (window.location.hash === '#about') {
    openAbout();
    history.replaceState({ page: 'about' }, '', window.location.pathname);
  }
});