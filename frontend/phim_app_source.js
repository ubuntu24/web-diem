/* ============================================
   PhimFlow — MVP movie experience (no comments)
   ============================================ */
const API = 'https://ophim1.com/v1/api';
const CDN = 'https://img.ophim.live/uploads/movies/';
const STORAGE_KEYS = {
  progress: 'phim:progress:v1',
  history: 'phim:history:v1',
  favorites: 'phim:favorites:v1',
  settings: 'phim:settings:v1',
};
const MAX_HISTORY = 120;

const state = {
  homeHeroIndex: 0,
  homeHeroItems: [],
  homeHeroInterval: null,
  searchTimeout: null,
  watchTicker: null,
  libraryTab: 'favorites',
  watch: {
    slug: '',
    serverIdx: 0,
    epIdx: 0,
    movie: null,
    simulatedSeconds: 0,
  },
  filters: {
    year: '',
    sortField: '',
  },
};

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Storage write failed:', error);
  }
}

const store = {
  getProgress() { return safeRead(STORAGE_KEYS.progress, {}); },
  setProgress(data) { safeWrite(STORAGE_KEYS.progress, data); },
  getHistory() { return safeRead(STORAGE_KEYS.history, []); },
  setHistory(data) { safeWrite(STORAGE_KEYS.history, data); },
  getFavorites() { return safeRead(STORAGE_KEYS.favorites, {}); },
  setFavorites(data) { safeWrite(STORAGE_KEYS.favorites, data); },
  getSettings() { return safeRead(STORAGE_KEYS.settings, { seekStep: 10 }); },
  setSettings(data) { safeWrite(STORAGE_KEYS.settings, data); },
};

function imgUrl(path) {
  if (!path) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" fill="%2316161f"/>';
  if (path.startsWith('http')) return path;
  return CDN + path;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || '';
}

function episodeKey(slug, serverIdx, epIdx) {
  return `${slug}:${serverIdx}:${epIdx}`;
}

function showToast(message) {
  const hint = document.getElementById('watchHint');
  if (!hint) return;
  hint.textContent = message;
}

async function fetchApi(endpoint) {
  try {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (error) {
    console.error('API Error:', endpoint, error);
    return null;
  }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toCardMovie(movie) {
  return {
    slug: movie.slug,
    name: movie.name,
    thumb_url: movie.thumb_url || movie.poster_url || '',
    poster_url: movie.poster_url || movie.thumb_url || '',
    year: movie.year || '',
    quality: movie.quality || 'HD',
    lang: movie.lang || '',
    episode_current: movie.episode_current || '',
    country: movie.country || [],
  };
}

function createCard(movie, options = {}) {
  const card = document.createElement('div');
  card.className = 'movie-card fade-in';
  card.onclick = () => navigateTo('detail', movie.slug);
  const langBadge = movie.lang ? `<span class="badge badge-lang">${movie.lang}</span>` : '';
  const epBadge = movie.episode_current ? `<span class="badge badge-ep">${movie.episode_current}</span>` : '';
  const progressMap = store.getProgress();
  const progressItem = Object.values(progressMap).find((item) => item.slug === movie.slug);
  const progressText = progressItem?.seconds ? `<div class="card-meta">Đang xem: ${Math.floor(progressItem.seconds)}s</div>` : '';

  card.innerHTML = `
    <div class="card-thumb">
      <img src="${imgUrl(movie.thumb_url)}" alt="${movie.name}" loading="lazy">
      <div class="card-overlay"><div class="play-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div></div>
      <div class="card-badges">
        <span class="badge badge-quality">${movie.quality || 'HD'}</span>
        ${langBadge}
        ${epBadge}
      </div>
    </div>
    <div class="card-info">
      <h3 class="card-title">${movie.name}</h3>
      <div class="card-meta">
        <span>${movie.year || ''}</span>
        ${movie.country && movie.country.length ? `<span>•</span><span>${movie.country[0].name}</span>` : ''}
      </div>
      ${options.showProgress ? progressText : ''}
    </div>
  `;
  return card;
}

function renderGrid(containerId, movies, options = {}) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!movies || !movies.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px;">Không có phim nào.</p>';
    return;
  }
  movies.forEach((movie) => grid.appendChild(createCard(movie, options)));
}

function showSkeletons(containerId, count = 12) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const sk = document.createElement('div');
    sk.className = 'skeleton skeleton-card';
    grid.appendChild(sk);
  }
}

function renderHero() {
  if (!state.homeHeroItems.length) return;
  const item = state.homeHeroItems[state.homeHeroIndex];
  const bg = document.getElementById('heroBg');
  const content = document.getElementById('heroContent');
  bg.style.backgroundImage = `url(${imgUrl(item.poster_url || item.thumb_url)})`;
  const cats = (item.category || []).map((c) => c.name).join(' • ');
  const country = item.country && item.country.length ? item.country[0].name : '';
  content.innerHTML = `
    <div class="hero-badge">⭐ Đề cử</div>
    <h1 class="hero-title">${item.name}</h1>
    <div class="hero-meta">
      <span class="quality">${item.quality || 'HD'}</span>
      <span>${item.year || ''}</span>
      <span>${country}</span>
      <span>${cats}</span>
    </div>
    <div class="hero-actions">
      <a href="#" class="btn btn-primary" onclick="navigateTo('detail','${item.slug}'); return false;">Xem ngay</a>
      <a href="#" class="btn btn-secondary" onclick="toggleFavoriteBySlug('${item.slug}'); return false;">Yêu thích</a>
    </div>
  `;
  document.querySelectorAll('.hero-dot').forEach((dot, idx) => dot.classList.toggle('active', idx === state.homeHeroIndex));
}

function initHero(items) {
  state.homeHeroItems = items.slice(0, 6);
  state.homeHeroIndex = 0;
  const indicators = document.getElementById('heroIndicators');
  indicators.innerHTML = state.homeHeroItems.map((_, idx) => `<div class="hero-dot ${idx === 0 ? 'active' : ''}" onclick="goHero(${idx})"></div>`).join('');
  renderHero();
  clearInterval(state.homeHeroInterval);
  state.homeHeroInterval = setInterval(() => {
    state.homeHeroIndex = (state.homeHeroIndex + 1) % state.homeHeroItems.length;
    renderHero();
  }, 6000);
}

window.goHero = function goHero(idx) {
  state.homeHeroIndex = idx;
  renderHero();
};

function upsertHistory(movie, serverIdx, epIdx, episodeName) {
  const history = store.getHistory().filter((item) => item.slug !== movie.slug);
  history.unshift({
    slug: movie.slug,
    name: movie.name,
    thumb_url: movie.thumb_url,
    year: movie.year,
    quality: movie.quality,
    lang: movie.lang,
    country: movie.country,
    serverIdx,
    epIdx,
    episodeName: episodeName || '',
    at: Date.now(),
  });
  store.setHistory(history.slice(0, MAX_HISTORY));
}

function saveProgress(movie, serverIdx, epIdx, seconds) {
  const map = store.getProgress();
  const key = episodeKey(movie.slug, serverIdx, epIdx);
  map[key] = {
    slug: movie.slug,
    name: movie.name,
    thumb_url: movie.thumb_url,
    serverIdx,
    epIdx,
    seconds: Math.max(0, Number(seconds) || 0),
    updatedAt: Date.now(),
  };
  store.setProgress(map);
}

function getEpisodeProgress(slug, serverIdx, epIdx) {
  const map = store.getProgress();
  return map[episodeKey(slug, serverIdx, epIdx)] || null;
}

function toggleFavorite(movie) {
  const favorites = store.getFavorites();
  if (favorites[movie.slug]) {
    delete favorites[movie.slug];
    showToast(`Đã bỏ yêu thích: ${movie.name}`);
  } else {
    favorites[movie.slug] = {
      slug: movie.slug,
      name: movie.name,
      thumb_url: movie.thumb_url,
      year: movie.year,
      quality: movie.quality,
      lang: movie.lang,
      country: movie.country,
      updatedAt: Date.now(),
    };
    showToast(`Đã thêm yêu thích: ${movie.name}`);
  }
  store.setFavorites(favorites);
  renderLibrary();
}

window.toggleFavoriteBySlug = async function toggleFavoriteBySlug(slug) {
  const data = await fetchApi(`/phim/${slug}`);
  const movie = data?.data?.item;
  if (!movie) return;
  toggleFavorite(toCardMovie(movie));
};

function renderContinueWatching() {
  const progressMap = store.getProgress();
  const continueItems = Object.values(progressMap)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      thumb_url: item.thumb_url,
      quality: 'HD',
      lang: '',
      year: '',
      country: [],
      episode_current: `Tập ${item.epIdx + 1} • ${Math.floor(item.seconds)}s`,
    }));
  renderGrid('gridContinue', continueItems, { showProgress: true });
}

function renderLibrary() {
  const favorites = Object.values(store.getFavorites())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((item) => ({ ...item, episode_current: 'Yêu thích' }));
  const history = store.getHistory()
    .sort((a, b) => b.at - a.at)
    .slice(0, 24)
    .map((item) => ({ ...item, episode_current: item.episodeName ? `Đã xem ${item.episodeName}` : 'Đã xem' }));
  const active = state.libraryTab === 'favorites' ? favorites : history;
  renderGrid('gridLibrary', active);
  document.getElementById('libraryTabFavorites').classList.toggle('active', state.libraryTab === 'favorites');
  document.getElementById('libraryTabHistory').classList.toggle('active', state.libraryTab === 'history');
}

function buildListQuery(page) {
  const query = new URLSearchParams({ page: String(page || 1) });
  if (state.filters.year) query.set('year', state.filters.year);
  if (state.filters.sortField) query.set('sort_field', state.filters.sortField);
  return query.toString();
}

async function loadHome() {
  showPage('pageHome');
  showSkeletons('gridNew');
  showSkeletons('gridSeries', 6);
  showSkeletons('gridSingle', 6);
  showSkeletons('gridAnime', 6);
  const homeData = await fetchApi('/home');
  if (homeData?.data) {
    const items = homeData.data.items || [];
    initHero(items);
    renderGrid('gridNew', items.slice(0, 18).map(toCardMovie));
  }
  const [series, single, anime] = await Promise.all([
    fetchApi('/danh-sach/phim-bo?page=1'),
    fetchApi('/danh-sach/phim-le?page=1'),
    fetchApi('/danh-sach/hoat-hinh?page=1'),
  ]);
  if (series?.data) renderGrid('gridSeries', (series.data.items || []).slice(0, 12).map(toCardMovie));
  if (single?.data) renderGrid('gridSingle', (single.data.items || []).slice(0, 12).map(toCardMovie));
  if (anime?.data) renderGrid('gridAnime', (anime.data.items || []).slice(0, 12).map(toCardMovie));
  renderContinueWatching();
  renderLibrary();
}

async function loadList(slug, page = 1) {
  showPage('pageList');
  const titles = { 'phim-bo': 'Phim Bộ', 'phim-le': 'Phim Lẻ', 'hoat-hinh': 'Hoạt Hình', 'tv-shows': 'TV Shows' };
  document.getElementById('listTitle').textContent = titles[slug] || 'Danh sách phim';
  showSkeletons('gridList', 24);
  const data = await fetchApi(`/danh-sach/${slug}?${buildListQuery(page)}`);
  if (data?.data) {
    renderGrid('gridList', (data.data.items || []).map(toCardMovie));
    const p = data.data.params?.pagination;
    if (p) renderPagination('pagination', p, (pg) => loadList(slug, pg));
    document.getElementById('listSubtitle').textContent = `Tổng cộng ${p?.totalItems || 0} phim`;
  }
}

async function loadGenre(slug, page = 1) {
  showPage('pageList');
  showSkeletons('gridList', 24);
  const data = await fetchApi(`/the-loai/${slug}?${buildListQuery(page)}`);
  if (data?.data) {
    document.getElementById('listTitle').textContent = `Thể loại: ${data.data.titlePage || slug}`;
    renderGrid('gridList', (data.data.items || []).map(toCardMovie));
    const p = data.data.params?.pagination;
    if (p) renderPagination('pagination', p, (pg) => loadGenre(slug, pg));
    document.getElementById('listSubtitle').textContent = `Tổng cộng ${p?.totalItems || 0} phim`;
  }
}

async function loadCountry(slug, page = 1) {
  showPage('pageList');
  showSkeletons('gridList', 24);
  const data = await fetchApi(`/quoc-gia/${slug}?${buildListQuery(page)}`);
  if (data?.data) {
    document.getElementById('listTitle').textContent = `Quốc gia: ${data.data.titlePage || slug}`;
    renderGrid('gridList', (data.data.items || []).map(toCardMovie));
    const p = data.data.params?.pagination;
    if (p) renderPagination('pagination', p, (pg) => loadCountry(slug, pg));
    document.getElementById('listSubtitle').textContent = `Tổng cộng ${p?.totalItems || 0} phim`;
  }
}

function renderPagination(containerId, pagination, callback) {
  const container = document.getElementById(containerId);
  if (!container || !pagination) return;
  const currentPage = pagination.currentPage || 1;
  const totalPages = Math.ceil((pagination.totalItems || 0) / (pagination.totalItemsPerPage || 1));
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  let html = `<button class="page-btn ${currentPage <= 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">‹</button>`;
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i += 1) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn ${currentPage >= totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">›</button>`;
  container.innerHTML = html;
  container.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('disabled')) return;
      const page = Number(btn.dataset.page);
      if (page > 0 && page !== currentPage) callback(page);
    });
  });
}

async function loadDetail(slug) {
  showPage('pageDetail');
  const detailHero = document.getElementById('detailHero');
  const detailContent = document.getElementById('detailContent');
  detailHero.innerHTML = '<div style="height:50vh;display:flex;align-items:center;justify-content:center;"><div class="spinner"></div></div>';
  detailContent.innerHTML = '';
  const data = await fetchApi(`/phim/${slug}`);
  const movie = data?.data?.item;
  if (!movie) {
    detailContent.innerHTML = '<p style="padding:100px 0;text-align:center;color:var(--text-muted);">Không tìm thấy phim.</p>';
    return;
  }
  const episodes = movie.episodes || [];
  const canWatch = episodes.length && episodes[0]?.server_data?.length;
  detailHero.innerHTML = `
    <div class="detail-backdrop" style="background-image:url(${imgUrl(movie.poster_url || movie.thumb_url)})"></div>
    <div class="detail-overlay"></div>
    <div class="detail-main">
      <div class="detail-poster"><img src="${imgUrl(movie.thumb_url)}" alt="${movie.name}"></div>
      <div class="detail-info">
        <h1 class="detail-title">${movie.name}</h1>
        <p class="detail-origin">${movie.origin_name || ''} (${movie.year || ''})</p>
        <div class="detail-tags">
          <span class="detail-tag" style="background:var(--accent);color:#fff;">${movie.quality || 'HD'}</span>
          <span class="detail-tag">${movie.lang || ''}</span>
          ${(movie.category || []).map((c) => `<span class="detail-tag" onclick="navigateTo('genre','${c.slug}')">${c.name}</span>`).join('')}
        </div>
        <div class="detail-meta-grid">
          <div class="meta-item"><div class="meta-label">Trạng thái</div>${movie.episode_current || ''}</div>
          <div class="meta-item"><div class="meta-label">Tổng tập</div>${movie.episode_total || '?'}</div>
          <div class="meta-item"><div class="meta-label">Thời lượng</div>${movie.time || '?'}</div>
          <div class="meta-item"><div class="meta-label">Quốc gia</div>${(movie.country || []).map((c) => c.name).join(', ') || '?'}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${canWatch ? `<a href="#" class="btn btn-primary" onclick="navigateTo('watch','${slug}','0-0'); return false;">Xem phim</a>` : ''}
          <a href="#" class="btn btn-secondary" onclick="toggleFavoriteBySlug('${slug}'); return false;">Yêu thích</a>
        </div>
      </div>
    </div>
  `;
  detailContent.innerHTML = `
    <div class="detail-desc">${movie.content || 'Chưa có mô tả.'}</div>
    ${episodes.length ? `<div class="episode-section" style="margin-top:20px;"><h3>Danh sách tập</h3>${episodes.map((srv, si) => `
      <div style="margin-top:10px;">
        <div style="font-weight:700;margin-bottom:8px;">${srv.server_name}</div>
        <div class="episode-grid">${(srv.server_data || []).map((ep, ei) => `<button class="ep-btn" onclick="navigateTo('watch','${slug}','${si}-${ei}')">${ep.name}</button>`).join('')}</div>
      </div>
    `).join('')}</div>` : ''}
  `;
}

function addStartTimeToUrl(url, seconds) {
  try {
    const parsed = new URL(url);
    const sec = Math.max(0, Math.floor(seconds));
    parsed.searchParams.set('start', String(sec));
    parsed.searchParams.set('t', String(sec));
    return parsed.toString();
  } catch {
    return url;
  }
}

function currentEpisode() {
  const movie = state.watch.movie;
  const server = movie?.episodes?.[state.watch.serverIdx];
  const ep = server?.server_data?.[state.watch.epIdx];
  return { movie, server, ep };
}

function updateWatchButtons() {
  const { movie } = currentEpisode();
  const episodes = movie?.episodes?.[state.watch.serverIdx]?.server_data || [];
  document.getElementById('btnPrevEp').disabled = state.watch.epIdx <= 0;
  document.getElementById('btnNextEp').disabled = state.watch.epIdx >= episodes.length - 1;
}

function bindWatchControls() {
  document.getElementById('btnPrevEp').onclick = () => navigateTo('watch', state.watch.slug, `${state.watch.serverIdx}-${Math.max(0, state.watch.epIdx - 1)}`);
  document.getElementById('btnNextEp').onclick = () => navigateTo('watch', state.watch.slug, `${state.watch.serverIdx}-${state.watch.epIdx + 1}`);
  document.getElementById('btnSeekBack').onclick = () => seekBy(-10);
  document.getElementById('btnSeekForward').onclick = () => seekBy(10);
  document.getElementById('btnToggleFavorite').onclick = () => {
    const movie = state.watch.movie;
    if (movie) toggleFavorite(toCardMovie(movie));
  };
}

function seekBy(step) {
  const { movie, ep } = currentEpisode();
  if (!movie || !ep) return;
  state.watch.simulatedSeconds = Math.max(0, state.watch.simulatedSeconds + step);
  saveProgress(movie, state.watch.serverIdx, state.watch.epIdx, state.watch.simulatedSeconds);
  const playerFrame = document.getElementById('playerFrame');
  playerFrame.src = addStartTimeToUrl(ep.link_embed, state.watch.simulatedSeconds);
  showToast(`Đã tua ${step > 0 ? '+' : ''}${step}s (mốc: ${Math.floor(state.watch.simulatedSeconds)}s)`);
}

function mountWatchTicker() {
  clearInterval(state.watch.watchTicker);
  state.watch.watchTicker = setInterval(() => {
    const { movie, ep } = currentEpisode();
    if (!movie || !ep) return;
    state.watch.simulatedSeconds += 5;
    saveProgress(movie, state.watch.serverIdx, state.watch.epIdx, state.watch.simulatedSeconds);
  }, 5000);
}

async function loadWatch(slug, epKey) {
  showPage('pageWatch');
  const [serverIdxRaw, epIdxRaw] = (epKey || '0-0').split('-').map(Number);
  state.watch.slug = slug;
  state.watch.serverIdx = Number.isFinite(serverIdxRaw) ? serverIdxRaw : 0;
  state.watch.epIdx = Number.isFinite(epIdxRaw) ? epIdxRaw : 0;
  const playerLoading = document.getElementById('playerLoading');
  const playerFrame = document.getElementById('playerFrame');
  playerLoading.classList.remove('hidden');
  playerFrame.src = '';
  const data = await fetchApi(`/phim/${slug}`);
  const movie = data?.data?.item;
  if (!movie) return;
  state.watch.movie = movie;
  const server = movie.episodes?.[state.watch.serverIdx];
  const ep = server?.server_data?.[state.watch.epIdx];
  if (!ep?.link_embed) {
    playerLoading.innerHTML = '<p style="color:var(--text-muted);">Tập phim chưa có nguồn phát.</p>';
    return;
  }
  const progress = getEpisodeProgress(slug, state.watch.serverIdx, state.watch.epIdx);
  state.watch.simulatedSeconds = progress?.seconds || 0;
  playerFrame.src = addStartTimeToUrl(ep.link_embed, state.watch.simulatedSeconds);
  playerFrame.onload = () => playerLoading.classList.add('hidden');
  setTimeout(() => playerLoading.classList.add('hidden'), 5000);
  document.getElementById('watchInfo').innerHTML = `
    <h2 class="watch-title">${movie.name}</h2>
    <p class="watch-subtitle">${server?.server_name || ''} — Tập ${ep.name} • Mốc đã lưu: ${Math.floor(state.watch.simulatedSeconds)}s</p>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
      <a href="#" class="btn btn-secondary" onclick="navigateTo('detail','${slug}'); return false;" style="padding:8px 16px;font-size:0.8rem;">← Chi tiết phim</a>
      <a href="${ep.link_embed}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="padding:8px 16px;font-size:0.8rem;">Mở player ngoài</a>
    </div>
  `;
  const episodes = movie.episodes || [];
  document.getElementById('episodeSection').innerHTML = `
    <h3>Chọn tập phim</h3>
    <div class="server-tabs">
      ${episodes.map((srv, si) => `<button class="server-tab ${si === state.watch.serverIdx ? 'active' : ''}" onclick="switchWatchServer(${si})">${srv.server_name}</button>`).join('')}
    </div>
    ${episodes.map((srv, si) => `
      <div class="episode-grid watch-ep-server" data-server="${si}" style="${si !== state.watch.serverIdx ? 'display:none' : ''}">
        ${(srv.server_data || []).map((item, ei) => `<button class="ep-btn ${si === state.watch.serverIdx && ei === state.watch.epIdx ? 'active' : ''}" onclick="navigateTo('watch','${slug}','${si}-${ei}')">${item.name}</button>`).join('')}
      </div>
    `).join('')}
  `;
  upsertHistory(toCardMovie(movie), state.watch.serverIdx, state.watch.epIdx, ep.name);
  saveProgress(movie, state.watch.serverIdx, state.watch.epIdx, state.watch.simulatedSeconds);
  renderContinueWatching();
  renderLibrary();
  bindWatchControls();
  updateWatchButtons();
  mountWatchTicker();
}

window.switchWatchServer = function switchWatchServer(idx) {
  state.watch.serverIdx = idx;
  state.watch.epIdx = 0;
  navigateTo('watch', state.watch.slug, `${idx}-0`);
};

function handleWatchHotkeys(event) {
  if (!document.getElementById('pageWatch')?.classList.contains('active')) return;
  if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'ArrowLeft') seekBy(-10);
  if (event.key === 'ArrowRight') seekBy(10);
  if (event.key.toLowerCase() === 'a') document.getElementById('btnPrevEp').click();
  if (event.key.toLowerCase() === 'd') document.getElementById('btnNextEp').click();
  if (event.key.toLowerCase() === 'f') document.getElementById('btnToggleFavorite').click();
}

async function loadSearch(keyword, page = 1) {
  showPage('pageSearch');
  document.getElementById('searchTitle').textContent = `Kết quả: "${keyword}"`;
  showSkeletons('gridSearch', 24);
  const data = await fetchApi(`/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`);
  if (data?.data) {
    renderGrid('gridSearch', (data.data.items || []).map(toCardMovie));
    const p = data.data.params?.pagination;
    if (p) renderPagination('paginationSearch', p, (pg) => loadSearch(keyword, pg));
  }
}

async function searchSuggest(keyword) {
  const box = document.getElementById('searchSuggestions');
  if (!keyword || keyword.length < 2) {
    box.classList.remove('active');
    return;
  }
  const data = await fetchApi(`/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=8`);
  if (!data?.data?.items?.length) {
    box.classList.remove('active');
    return;
  }
  box.innerHTML = data.data.items.slice(0, 6).map((movie) => `
    <div class="suggestion-item" onclick="navigateTo('detail','${movie.slug}'); document.getElementById('searchSuggestions').classList.remove('active');">
      <img src="${imgUrl(movie.thumb_url)}" alt="${movie.name}" loading="lazy">
      <div class="suggestion-info"><h4>${movie.name}</h4><p>${movie.year || ''} • ${movie.episode_current || ''}</p></div>
    </div>
  `).join('');
  box.classList.add('active');
}

async function loadDropdowns() {
  const [genreData, countryData] = await Promise.all([fetchApi('/the-loai'), fetchApi('/quoc-gia')]);
  const genreMenu = document.getElementById('genreDropdown');
  const countryMenu = document.getElementById('countryDropdown');
  if (genreData?.data?.items) {
    genreMenu.innerHTML = genreData.data.items.map((g) => `<a href="#" onclick="navigateTo('genre','${g.slug}'); return false;">${g.name}</a>`).join('');
  }
  if (countryData?.data?.items) {
    countryMenu.innerHTML = countryData.data.items.map((c) => `<a href="#" onclick="navigateTo('country','${c.slug}'); return false;">${c.name}</a>`).join('');
  }
  const yearSelect = document.getElementById('filterYear');
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= 2000; year -= 1) {
    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
  }
}

window.navigateTo = async function navigateTo(page, param, extra) {
  switch (page) {
    case 'home': await loadHome(); break;
    case 'detail': await loadDetail(param); break;
    case 'watch': await loadWatch(param, extra); break;
    case 'list': await loadList(param); break;
    case 'genre': await loadGenre(param); break;
    case 'country': await loadCountry(param); break;
    case 'search': await loadSearch(param); break;
    default: await loadHome();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  loadHome();
  loadDropdowns();
  document.getElementById('libraryTabFavorites').addEventListener('click', () => {
    state.libraryTab = 'favorites';
    renderLibrary();
  });
  document.getElementById('libraryTabHistory').addEventListener('click', () => {
    state.libraryTab = 'history';
    renderLibrary();
  });
  window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
    document.getElementById('scrollTop').classList.toggle('visible', window.scrollY > 500);
  });
  document.getElementById('scrollTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => searchSuggest(searchInput.value.trim()), 300);
  });
  searchInput.addEventListener('keypress', (event) => {
    if (event.key !== 'Enter') return;
    const keyword = searchInput.value.trim();
    if (keyword) navigateTo('search', keyword);
    document.getElementById('searchSuggestions').classList.remove('active');
  });
  document.getElementById('searchBtn').addEventListener('click', () => {
    const keyword = searchInput.value.trim();
    if (keyword) navigateTo('search', keyword);
    document.getElementById('searchSuggestions').classList.remove('active');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-box')) document.getElementById('searchSuggestions').classList.remove('active');
  });
  document.addEventListener('keydown', handleWatchHotkeys);
  document.getElementById('filterYear').addEventListener('change', (event) => {
    state.filters.year = event.target.value;
  });
  document.getElementById('filterSort').addEventListener('change', (event) => {
    state.filters.sortField = event.target.value;
  });
});
