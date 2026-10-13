const pointerGlow = document.querySelector('.cursor-glow');
window.addEventListener('pointermove', (event) => {
  pointerGlow.style.left = `${event.clientX}px`;
  pointerGlow.style.top = `${event.clientY}px`;
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

document.querySelectorAll('[data-tilt]').forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    if (window.matchMedia('(max-width: 850px)').matches) return;
    const box = card.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - .5;
    const y = (event.clientY - box.top) / box.height - .5;
    card.style.transform = `perspective(950px) rotateY(${x * 5}deg) rotateX(${y * -5}deg) translateY(-4px)`;
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
});

const countUp = (element) => {
  const target = Number(element.dataset.count);
  const suffix = element.dataset.suffix || '';
  const start = performance.now();
  const duration = 1200;
  const render = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    element.textContent = `${target % 1 ? value.toFixed(1) : Math.round(value).toLocaleString()}${suffix}`;
    if (progress < 1) requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
};

const metricObserver = new IntersectionObserver((entries, currentObserver) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('[data-count]').forEach(countUp);
    currentObserver.unobserve(entry.target);
  });
}, { threshold: .35 });
const metricCard = document.querySelector('.metric-card');
if (metricCard) metricObserver.observe(metricCard);

// Vimeo IDs are kept in one place; local covers remain unchanged.
const videoSources = {
  bullet: { id: '1235278820', title: 'Bullet Time' },
  'ev-car': { id: '1235279971', title: 'EV Car Cannot Run?' },
  'ev-maintenance': { id: '1235279950', title: 'EV Maintenance' },
  'ev-range': { id: '1235279994', title: 'EV Battery Range' },
  emas: { id: '1235280141', title: 'e.MAS 5' },
  'personal-content': { id: '1235279857', title: 'Personal Content' },
};
const makeVimeoFrame = (key, preview = false) => {
  const source = videoSources[key];
  const params = new URLSearchParams({ autoplay: preview ? '0' : '1', muted: preview ? '1' : '0', loop: preview ? '1' : '0', controls: preview ? '0' : '1', playsinline: '1', title: '0', byline: '0', portrait: '0', dnt: '1' });
  const frame = document.createElement('iframe');
  frame.src = `https://player.vimeo.com/video/${source.id}?${params}`;
  frame.title = source.title;
  frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  return frame;
};
let sdkPromise;
const loadVimeoSDK = () => {
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('Vimeo player timed out')), 15000);
    script.src = 'https://player.vimeo.com/api/player.js';
    script.onload = () => { clearTimeout(timer); window.Vimeo?.Player ? resolve(window.Vimeo) : reject(new Error('Vimeo player unavailable')); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('Vimeo player unavailable')); };
    document.head.append(script);
  });
  return sdkPromise;
};
const previewStates = [];
const pausePreview = state => {
  state.wantsPlay = false;
  state.pinned = false;
  state.player?.pause().catch(() => {});
  state.cover.classList.remove('is-playing');
};
const pausePreviews = () => previewStates.forEach(pausePreview);
const mountedPlayers = new Map();
const clearVimeoEmbeds = container => {
  container.querySelectorAll('.vimeo-embed').forEach(host => {
    const player = mountedPlayers.get(host);
    if (player) { player.destroy().catch(() => {}); mountedPlayers.delete(host); }
    host.querySelectorAll('iframe').forEach(frame => frame.remove());
  });
};
const playVimeoEmbed = (host, key) => {
  pausePreviews();
  mountedPlayers.forEach(player => player.pause().catch(() => {}));
  document.querySelectorAll('.vimeo-embed iframe').forEach(frame => {
    if (!mountedPlayers.has(frame.parentElement)) frame.remove();
  });
  const frame = makeVimeoFrame(key);
  host.append(frame);
  loadVimeoSDK().then(Vimeo => {
    if (!frame.isConnected) return;
    const player = new Vimeo.Player(frame);
    mountedPlayers.set(host, player);
    player.on('play', () => mountedPlayers.forEach(other => { if (other !== player) other.pause().catch(() => {}); }));
  }).catch(() => {}); // The native embedded controls still work without the SDK.
};
// Covers play independently; captions open the complete project.
document.querySelectorAll('[data-video-preview]').forEach(cover => {
  const toggle = cover.querySelector('.preview-toggle');
  const label = toggle.getAttribute('aria-label').replace(/^Play /, '');
  const state = { cover, player: null, ready: null, wantsPlay: false, pinned: false };
  previewStates.push(state);
  const previewStart = Number(cover.dataset.previewStart || 0);
  const sync = playing => {
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${label}`);
    toggle.firstElementChild.textContent = playing ? 'Ⅱ' : '▶';
    cover.classList.toggle('is-playing', playing);
  };
  const play = async () => {
    previewStates.filter(other => other !== state).forEach(pausePreview);
    state.wantsPlay = true;
    cover.setAttribute('aria-busy', 'true');
    try {
      if (!state.ready) state.ready = (async () => {
        const Vimeo = await loadVimeoSDK();
        const frame = makeVimeoFrame(cover.dataset.videoPreview, true);
        frame.className = 'vimeo-preview-frame';
        cover.append(frame);
        state.player = new Vimeo.Player(frame);
        state.player.on('play', () => { if (!state.wantsPlay) state.player.pause().catch(() => {}); else sync(true); });
        state.player.on('pause', () => sync(false));
        await Promise.race([state.player.ready(), new Promise((_, reject) => setTimeout(() => reject(new Error('Preview timed out')), 15000))]);
        if (previewStart) {
          await state.player.setCurrentTime(previewStart);
          state.player.on('timeupdate', event => { if (state.wantsPlay && event.seconds < previewStart - .5) state.player.setCurrentTime(previewStart).catch(() => {}); });
        }
      })();
      await state.ready;
      if (state.wantsPlay) await state.player.play();
    } catch (_) {
      state.wantsPlay = false;
      sync(false);
      if (!cover.querySelector('.vimeo-preview-error')) {
        const link = document.createElement('a');
        link.className = 'vimeo-preview-error';
        link.href = `https://vimeo.com/${videoSources[cover.dataset.videoPreview].id}`;
        link.target = '_blank'; link.rel = 'noopener';
        link.textContent = 'Watch on Vimeo ↗';
        cover.append(link);
      }
    } finally { cover.removeAttribute('aria-busy'); }
  };
  toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-pressed') === 'true' || (state.pinned && state.wantsPlay)) pausePreview(state);
    else { state.pinned = true; if (!state.wantsPlay) play(); }
  });
  cover.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !matchMedia('(prefers-reduced-motion: reduce)').matches) play();
  });
  cover.addEventListener('pointerleave', () => { if (!state.pinned) pausePreview(state); });
  const visibility = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) pausePreview(state);
  }, {threshold:.1});
  visibility.observe(cover);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pausePreviews(); });

const modal = document.querySelector('#video-modal');
const modalVideo = document.querySelector('#modal-video');
let lastTrigger;
const updateScrollLock = () => document.body.classList.toggle('modal-open', !!document.querySelector('.is-open[role="dialog"]'));
const closeVideo = () => {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  clearVimeoEmbeds(modal);
  modalVideo.replaceChildren();
  updateScrollLock();
  lastTrigger?.focus();
};
document.querySelectorAll('[data-open-video]').forEach((button) => {
  button.addEventListener('click', () => {
    pausePreviews();
    lastTrigger = button;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    updateScrollLock();
    modal.querySelector('.video-close').focus();
    playVimeoEmbed(modalVideo, button.dataset.openVideo);
  });
});
document.querySelectorAll('[data-close-video]').forEach((element) => element.addEventListener('click', closeVideo));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.classList.contains('is-open')) closeVideo(); });

const projectModal = document.querySelector('#project-modal');
const projectModalContent = document.querySelector('#project-modal-content');
const projectDetails = {
  bullet: {
    label: 'AIGC',
    title: 'Bullet Time',
    description: 'A fashion film that transforms an unexpected street encounter into a suspended moment. Following a brief collision, sunglasses, a coffee cup and a handbag become the focus of slow-motion close-ups, highlighting material textures, flowing liquid and movement.',
    paragraphs: [
      'The project explores AI-assisted visual storytelling through character development, multi-angle product references and iterative shot direction.',
      'Tools: Pinterest, Codex, Libtv (Seedance 2.0)'
    ],
  },
  ev: {
    label: 'Real-People Content',
    title: 'Proton EVs',
    description: 'Created people-focused video content for EV car promotion during my marketing internship at CS Automotive Group.',
  },
  emas: {
    label: 'Promotional Teaser',
    title: 'e.MAS 5',
    description: 'A teaser concept designed around a receipt-style visual, using an everyday purchase receipt as a creative way to hint at the upcoming Proton e.MAS 5 EV car launch.',
  },
  wicked: {
    label: 'Wickedly Welsh Chocolate',
    title: 'Share Love, Share Wales',
    description: 'A Valentine’s Day campaign concept for Wickedly Welsh Chocolate, targeting Gen Z women with a premium and personalised gifting proposition. Created Instagram, Stories, YouTube, and OOH content using the Lover brand archetype and a gold-and-red visual identity to build emotional connection and brand appeal.',
  },
  lime: {
    label: 'LIME',
    title: 'EcoRewards',
    description: 'A sustainability campaign concept that turns users’ CO₂ savings from low-carbon travel into redeemable rewards, encouraging greener transport choices through a more engaging experience. Developed the campaign concept, user journey, and reward mechanism, translating sustainability insights into a practical digital experience.',
  },
};

const closeProject = () => {
  if (!projectModal) return;
  clearVimeoEmbeds(projectModalContent);
  projectModal.classList.remove('is-open');
  projectModal.setAttribute('aria-hidden', 'true');
  projectModalContent.replaceChildren();
  updateScrollLock();
  lastTrigger?.focus();
};

document.querySelectorAll('[data-open-project]').forEach((button) => {
  button.addEventListener('click', () => {
    pausePreviews();
    const projectId = button.dataset.openProject;
    lastTrigger = button;
    const source = document.querySelector(`[data-project-detail="${projectId}"]`);
    if (!source || !projectModal || !projectModalContent) return;

    const project = source.cloneNode(true);
    project.removeAttribute('aria-hidden');
    project.removeAttribute('data-project-detail');
    project.classList.remove('reveal');
    project.classList.add('visible');
    project.querySelector('.project-number')?.remove();
    project.querySelector('.project-copy, .project-heading')?.remove();

    const details = projectDetails[projectId];
    if (details) {
      const header = document.createElement('header');
      header.className = 'project-detail-header';
      header.innerHTML = `
        <p class="project-detail-kicker">${details.label}</p>
        <h2>${details.title}</h2>
        <div class="project-detail-rule"></div>
        <p class="project-detail-description">${details.description}</p>
        ${(details.paragraphs || []).map(paragraph => `<p class="project-detail-description">${paragraph}</p>`).join('')}
        <p class="project-detail-media-label">Project media</p>
      `;
      project.prepend(header);
    }
    projectModalContent.replaceChildren(project);
    project.querySelectorAll('.vimeo-play').forEach(button => {
      button.addEventListener('click', () => playVimeoEmbed(button.parentElement, button.parentElement.dataset.videoKey));
    });
    projectModal.classList.add('is-open');
    projectModal.setAttribute('aria-hidden', 'false');
    projectModal.querySelector('.project-modal-card').scrollTop = 0;
    updateScrollLock();
    projectModal.querySelector('.project-close').focus();
  });
});

document.querySelectorAll('[data-close-project]').forEach((element) => {
  element.addEventListener('click', closeProject);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && projectModal?.classList.contains('is-open')) closeProject();
});

document.querySelector('.personal-evidence')?.addEventListener('click', event => {
  const evidence = event.currentTarget;
  const expanded = evidence.classList.toggle('is-expanded');
  evidence.setAttribute('aria-expanded', String(expanded));
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const openModal = document.querySelector('.is-open[role="dialog"]');
  if (!openModal) return;
  const controls = [...openModal.querySelectorAll('button, a[href], iframe, [tabindex="0"]')];
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
