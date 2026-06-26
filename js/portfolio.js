const carouselState = {};

function initCarousel(id) {
  const carousel = document.getElementById(id);
  const items = Array.from(carousel.querySelectorAll('.work-item'));
  carouselState[id] = { index: 1, items };
  updateCarousel(id);
}

function updateCarousel(id) {
  const { index, items } = carouselState[id];
  const len = items.length;

  items.forEach((item, i) => {
    const offset = ((i - index) % len + len) % len;
    const norm = offset > len / 2 ? offset - len : offset;

    if (norm === -1) {
      item.style.display = 'flex';
      item.style.order = '0';
      item.classList.remove('active');
    } else if (norm === 0) {
      item.style.display = 'flex';
      item.style.order = '1';
      item.classList.add('active');
    } else if (norm === 1) {
      item.style.display = 'flex';
      item.style.order = '2';
      item.classList.remove('active');
    } else {
      item.classList.remove('active');
      item.style.display = 'none';
    }
  });
}

// ── TEXT SCRAMBLE ──────────────────────────────────
function scrambleText(el, finalText, duration = 1800) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ/\\|[]{}@#$%&*?';
  const steps = 14;
  let frame = 0;

  const interval = setInterval(() => {
    el.textContent = finalText.split('').map((char, i) => {
      if (char === ' ') return ' ';
      if (char === '.') {
        // dot locks in halfway through
        return frame > steps * 0.5 ? '.' : chars[Math.floor(Math.random() * chars.length)];
      }
      // each character locks in progressively
      const lockAt = Math.floor((i / finalText.length) * steps * 0.85);
      return frame > lockAt ? char : chars[Math.floor(Math.random() * chars.length)];
    }).join('');

    frame++;
    if (frame > steps) {
      el.textContent = finalText;
      clearInterval(interval);
    }
  }, duration / steps);
}

// ── TAGLINE CYCLE ──────────────────────────────────
function cycleTags() {
  const el = document.getElementById('tagline-cycle');
  if (!el) return;
  const tags = ['MARKETING.', 'DESIGN.', 'VIDEO AND PHOTO EDITING.'];
  let i = 0;

  setInterval(() => {
    // exit: fade up
    el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-12px)';

    setTimeout(() => {
      i = (i + 1) % tags.length;
      el.textContent = tags[i];
      // reset below, no transition
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';

      requestAnimationFrame(() => requestAnimationFrame(() => {
        // enter: slide up into place
        el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }));
    }, 380);
  }, 2800);
}

// ── HOVER VIDEO PREVIEW ────────────────────────────
function initWorkLinks() {
  document.querySelectorAll('.work-item[data-link]').forEach(item => {
    if (!item.dataset.link) return;
    item.style.cursor = 'pointer';
    item.addEventListener('click', e => {
      e.stopPropagation();
      window.open(item.dataset.link, '_blank', 'noopener,noreferrer');
    });
  });
}

function initHoverVideos() {
  document.querySelectorAll('.work-item[data-video]').forEach(item => {
    const src = item.dataset.video;
    if (!src) return;

    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.className = 'hover-video';
    item.appendChild(video);

    item.addEventListener('mouseenter', () => {
      if (!video.src) video.src = src;
      video.play();
    });
    item.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cycleTags();
  initHoverVideos();
  initWorkLinks();
  // scramble all scattered letters
  document.querySelectorAll('.hs-letter[data-final]').forEach((el, i) => {
    el.textContent = el.dataset.final;
    setTimeout(() => scrambleText(el, el.dataset.final, 1600), i * 120);
  });
  // scramble main title
  const title = document.querySelector('.hs-title[data-final]');
  if (title) setTimeout(() => scrambleText(title, title.dataset.final, 2200), 200);
});

function scrollCarousel(id, dir) {
  const state = carouselState[id];
  if (!state) return;
  const len = state.items.length;
  state.index = (state.index + dir + len) % len;
  updateCarousel(id);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.carousel').forEach(c => initCarousel(c.id));
});

function openModal(src) {
  const modal = document.getElementById('modal');
  const video = document.getElementById('modal-video');
  video.src = src;
  video.play();
  modal.classList.add('open');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal') && !e.target.classList.contains('modal-close')) return;
  const modal = document.getElementById('modal');
  const video = document.getElementById('modal-video');
  video.pause();
  video.src = '';
  modal.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function closeRadial(folder, callback) {
  const items = folder.querySelectorAll('.folder-item');
  folder.classList.remove('open');
  items.forEach((item, i) => {
    setTimeout(() => {
      item.style.transform = 'translate(-50%, -50%) scale(0)';
      item.style.opacity = '0';
    }, i * 30);
  });
  const count = items.length;
  setTimeout(() => {
    if (callback) callback();
  }, count * 30 + 350);
}

function zoomItem(item, e) {
  e.stopPropagation();
  const isZoomed = item.classList.contains('zoomed');
  document.querySelectorAll('.folder-item.zoomed').forEach(i => i.classList.remove('zoomed'));
  if (!isZoomed) item.classList.add('zoomed');
}

function toggleRadial(folder) {
  const isOpen = folder.classList.contains('open');

  if (isOpen) {
    closeRadial(folder);
    return;
  }

  // close any open folder immediately, then open new one
  const openFolder = document.querySelector('.folder-radial.open');
  if (openFolder) closeRadial(openFolder);

  folder.classList.add('open');
  const items = folder.querySelectorAll('.folder-item');
  const count = items.length;
  const radius = 110;

  items.forEach((item, i) => {
    item.style.opacity = '0';
    item.style.transform = 'translate(-50%, -50%) scale(0)';
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    setTimeout(() => {
      item.style.opacity = '1';
      item.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`;
    }, i * 40);
  });
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
