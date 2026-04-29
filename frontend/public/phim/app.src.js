/* ============================================
   PhimFlow — Application Logic
   ============================================ */
const API = 'https://ophim1.com/v1/api';
const CDN = 'https://img.ophim.live/uploads/movies/';

// State
let currentHero = 0;
let heroItems = [];
let heroInterval = null;
let searchTimeout = null;

// ---- Utility ----
function imgUrl(path) {
  if (!path) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" fill="%2316161f"/>';
  if (path.startsWith('http')) return path;
  return CDN + path;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

async function fetchApi(endpoint) {
  try {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.error('API Error:', e);
    return null;
  }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Movie Card ----
function createCard(movie) {
  const card = document.createElement('div');
  card.className = 'movie-card fade-in';
  card.onclick = () => navigateTo('detail', movie.slug);
  
  const langBadge = movie.lang ? `<span class="badge badge-lang">${movie.lang}</span>` : '';
  const epBadge = movie.episode_current ? `<span class="badge badge-ep">${movie.episode_current}</span>` : '';
  
  card.innerHTML = `
    <div class="card-thumb">
      <img src="${imgUrl(movie.thumb_url)}" alt="${movie.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect fill=%22%2316161f%22 width=%22300%22 height=%22450%22/><text fill=%22%235a5a6e%22 x=%22150%22 y=%22225%22 text-anchor=%22middle%22 font-size=%2214%22>No Image</text></svg>'">
      <div class="card-overlay">
        <div class="play-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
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
        ${movie.country && movie.country.length ? '<span>•</span><span>' + movie.country[0].name + '</span>' : ''}
      </div>
    </div>
  `;
  return card;
}

function renderGrid(containerId, movies) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!movies || !movies.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px;">Không có phim nào.</p>';
    return;
  }
  movies.forEach(m => grid.appendChild(createCard(m)));
}

function showSkeletons(containerId, count = 12) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton skeleton-card';
    grid.appendChild(sk);
  }
}

// ============================================
// HERO BANNER
// ============================================
function renderHero() {
  if (!heroItems.length) return;
  const item = heroItems[currentHero];
  const bg = document.getElementById('heroBg');
  const content = document.getElementById('heroContent');
  
  bg.style.backgroundImage = `url(${imgUrl(item.poster_url || item.thumb_url)})`;
  
  const cats = item.category ? item.category.map(c => c.name).join(' • ') : '';
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
      <a href="#" class="btn btn-primary" onclick="navigateTo('detail', '${item.slug}'); return false;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
        Xem ngay
      </a>
      <a href="#" class="btn btn-secondary" onclick="navigateTo('detail', '${item.slug}'); return false;">
        Chi tiết
      </a>
    </div>
  `;
  content.classList.remove('fade-in');
  void content.offsetWidth;
  content.classList.add('fade-in');
  
  // Update indicators
  document.querySelectorAll('.hero-dot').forEach((d, i) => {
    d.classList.toggle('active', i === currentHero);
  });
}

function initHero(items) {
  heroItems = items.slice(0, 6);
  const indicators = document.getElementById('heroIndicators');
  indicators.innerHTML = heroItems.map((_, i) =>
    `<div class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHero(${i})"></div>`
  ).join('');
  renderHero();
  clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    currentHero = (currentHero + 1) % heroItems.length;
    renderHero();
  }, 6000);
}

window.goHero = function(idx) {
  currentHero = idx;
  renderHero();
  clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    currentHero = (currentHero + 1) % heroItems.length;
    renderHero();
  }, 6000);
};

// ============================================
// NAVIGATION
// ============================================
window.navigateTo = async function(page, param, extra) {
  switch(page) {
    case 'home': await loadHome(); break;
    case 'detail': await loadDetail(param); break;
    case 'watch': await loadWatch(param, extra); break;
    case 'list': await loadList(param); break;
    case 'genre': await loadGenre(param); break;
    case 'country': await loadCountry(param); break;
    case 'search': await loadSearch(param); break;
  }
};

// ============================================
// HOME PAGE
// ============================================
async function loadHome() {
  showPage('pageHome');
  
  showSkeletons('gridNew');
  showSkeletons('gridSeries', 6);
  showSkeletons('gridSingle', 6);
  showSkeletons('gridAnime', 6);
  
  const homeData = await fetchApi('/home');
  if (homeData && homeData.data) {
    const items = homeData.data.items || [];
    initHero(items);
    renderGrid('gridNew', items.slice(0, 18));
  }
  
  // Load category lists
  const [series, single, anime] = await Promise.all([
    fetchApi('/danh-sach/phim-bo?page=1'),
    fetchApi('/danh-sach/phim-le?page=1'),
    fetchApi('/danh-sach/hoat-hinh?page=1'),
  ]);
  
  if (series?.data) renderGrid('gridSeries', (series.data.items || []).slice(0, 12));
  if (single?.data) renderGrid('gridSingle', (single.data.items || []).slice(0, 12));
  if (anime?.data) renderGrid('gridAnime', (anime.data.items || []).slice(0, 12));
}

// ============================================
// MOVIE LIST
// ============================================
let currentListSlug = '';
let currentListPage = 1;

async function loadList(slug, page = 1) {
  showPage('pageList');
  currentListSlug = slug;
  currentListPage = page;
  
  const titles = {
    'phim-bo': 'Phim Bộ',
    'phim-le': 'Phim Lẻ',
    'hoat-hinh': 'Hoạt Hình',
    'tv-shows': 'TV Shows',
  };
  document.getElementById('listTitle').textContent = titles[slug] || 'Danh sách phim';
  
  showSkeletons('gridList', 24);
  
  const data = await fetchApi(`/danh-sach/${slug}?page=${page}`);
  if (data?.data) {
    renderGrid('gridList', data.data.items || []);
    const p = data.data.params?.pagination;
    if (p) renderPagination('pagination', p, (pg) => loadList(slug, pg));
    document.getElementById('listSubtitle').textContent = `Tổng cộng ${p?.totalItems || 0} phim`;
  }
}

// ============================================
// GENRE & COUNTRY LIST
// ============================================
async function loadGenre(slug, page = 1) {
  showPage('pageList');
  showSkeletons('gridList', 24);
  
  document.getElementById('listTitle').textContent = 'Thể loại';
  
  const data = await fetchApi(`/the-loai/${slug}?page=${page}`);
  if (data?.data) {
    document.getElementById('listTitle').textContent = `Thể loại: ${data.data.titlePage || slug}`;
    renderGrid('gridList', data.data.items || []);
    const p = data.data.params?.pagination;
    if (p) renderPagination('pagination', p, (pg) => loadGenre(slug, pg));
    document.getElementById('listSubtitle').textContent = `Tổng cộng ${p?.totalItems || 0} phim`;
  }
}

async function loadCountry(slug, page = 1) {
  showPage('pageList');
  showSkeletons('gridList', 24);
  
  const data = await fetchApi(`/quoc-gia/${slug}?page=${page}`);
  if (data?.data) {
    document.getElementById('listTitle').textContent = `Quốc gia: ${data.data.titlePage || slug}`;
    renderGrid('gridList', data.data.items || []);
    const p = data.data.params?.pagination;
    if (p) renderPagination('pagination', p, (pg) => loadCountry(slug, pg));
    document.getElementById('listSubtitle').textContent = `Tổng cộng ${p?.totalItems || 0} phim`;
  }
}

// ============================================
// PAGINATION
// ============================================
function renderPagination(containerId, pagination, callback) {
  const container = document.getElementById(containerId);
  if (!container || !pagination) return;
  
  const { currentPage, totalItems, totalItemsPerPage } = pagination;
  const totalPages = Math.ceil(totalItems / totalItemsPerPage);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  
  let html = '';
  
  html += `<button class="page-btn ${currentPage <= 1 ? 'disabled' : ''}" onclick="return false;">‹</button>`;
  
  const range = 2;
  let start = Math.max(1, currentPage - range);
  let end = Math.min(totalPages, currentPage + range);
  
  if (start > 1) {
    html += `<button class="page-btn" data-page="1">1</button>`;
    if (start > 2) html += `<span style="color:var(--text-muted);padding:0 4px;">...</span>`;
  }
  
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  
  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span style="color:var(--text-muted);padding:0 4px;">...</span>`;
    html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }
  
  html += `<button class="page-btn ${currentPage >= totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">›</button>`;
  
  container.innerHTML = html;
  
  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pg = parseInt(btn.dataset.page);
      if (pg && pg !== currentPage) callback(pg);
    });
  });
  
  // Prev button
  container.querySelector('.page-btn:first-child').addEventListener('click', () => {
    if (currentPage > 1) callback(currentPage - 1);
  });
}

// ============================================
// MOVIE DETAIL
// ============================================
async function loadDetail(slug) {
  showPage('pageDetail');
  
  const detailHero = document.getElementById('detailHero');
  const detailContent = document.getElementById('detailContent');
  detailHero.innerHTML = '<div style="height:50vh;display:flex;align-items:center;justify-content:center;"><div class="spinner"></div></div>';
  detailContent.innerHTML = '';
  
  const data = await fetchApi(`/phim/${slug}`);
  if (!data?.data?.item) {
    detailContent.innerHTML = '<p style="padding:100px 0;text-align:center;color:var(--text-muted);">Không tìm thấy phim.</p>';
    return;
  }
  
  const movie = data.data.item;
  const episodes = movie.episodes || [];
  const cdnDomain = data.data.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live';
  
  detailHero.innerHTML = `
    <div class="detail-backdrop" style="background-image:url(${imgUrl(movie.poster_url)})"></div>
    <div class="detail-overlay"></div>
    <div class="detail-main">
      <div class="detail-poster fade-in">
        <img src="${imgUrl(movie.thumb_url)}" alt="${movie.name}">
      </div>
      <div class="detail-info fade-in">
        <h1 class="detail-title">${movie.name}</h1>
        <p class="detail-origin">${movie.origin_name || ''} (${movie.year || ''})</p>
        <div class="detail-tags">
          <span class="detail-tag" style="background:var(--accent);color:#fff;">${movie.quality || 'HD'}</span>
          <span class="detail-tag">${movie.lang || ''}</span>
          ${(movie.category || []).map(c =>
            `<span class="detail-tag" onclick="navigateTo('genre','${c.slug}')">${c.name}</span>`
          ).join('')}
        </div>
        <div class="detail-meta-grid">
          <div class="meta-item"><div class="meta-label">Trạng thái</div>${movie.episode_current || ''}</div>
          <div class="meta-item"><div class="meta-label">Tổng tập</div>${movie.episode_total || '?'}</div>
          <div class="meta-item"><div class="meta-label">Thời lượng</div>${movie.time || '?'}</div>
          <div class="meta-item"><div class="meta-label">Quốc gia</div>${(movie.country||[]).map(c=>c.name).join(', ')||'?'}</div>
          ${movie.director?.length ? `<div class="meta-item"><div class="meta-label">Đạo diễn</div>${movie.director.join(', ')}</div>` : ''}
        </div>
        ${episodes.length && episodes[0]?.server_data?.length ? `
          <a href="#" class="btn btn-primary" onclick="navigateTo('watch','${slug}','0-0'); return false;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            Xem phim
          </a>
        ` : '<p style="color:var(--text-muted);margin-top:12px;">Phim chưa có tập nào.</p>'}
      </div>
    </div>
  `;
  
  // Actors & Description
  const actors = movie.actor?.length ? `<div style="margin-top:16px;"><strong style="color:var(--text-primary);">Diễn viên:</strong> <span style="color:var(--text-secondary);">${movie.actor.join(', ')}</span></div>` : '';
  
  detailContent.innerHTML = `
    ${actors}
    <div class="detail-desc">${movie.content || 'Chưa có mô tả.'}</div>
    ${episodes.length ? `
      <div class="episode-section" style="margin-top:30px;">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;">📋 Danh sách tập</h3>
        <div class="server-tabs">
          ${episodes.map((srv, si) =>
            `<button class="server-tab ${si===0?'active':''}" onclick="switchDetailServer(${si})">${srv.server_name}</button>`
          ).join('')}
        </div>
        ${episodes.map((srv, si) => `
          <div class="episode-grid detail-ep-server" data-server="${si}" style="${si>0?'display:none':''}">
            ${(srv.server_data||[]).map((ep, ei) =>
              `<button class="ep-btn" onclick="navigateTo('watch','${slug}','${si}-${ei}')">${ep.name}</button>`
            ).join('')}
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

window.switchDetailServer = function(idx) {
  document.querySelectorAll('.detail-ep-server').forEach(g => g.style.display = 'none');
  document.querySelector(`.detail-ep-server[data-server="${idx}"]`).style.display = 'grid';
  document.querySelectorAll('#detailContent .server-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
};

// ============================================
// WATCH PAGE
// ============================================
let watchData = null;
let watchSlug = '';

async function loadWatch(slug, epKey) {
  showPage('pageWatch');
  
  const [serverIdx, epIdx] = (epKey || '0-0').split('-').map(Number);
  
  const playerLoading = document.getElementById('playerLoading');
  const playerFrame = document.getElementById('playerFrame');
  playerLoading.classList.remove('hidden');
  playerFrame.src = '';
  
  if (watchSlug !== slug || !watchData) {
    const data = await fetchApi(`/phim/${slug}`);
    if (!data?.data?.item) return;
    watchData = data.data.item;
    watchSlug = slug;
  }
  
  const movie = watchData;
  const episodes = movie.episodes || [];
  const server = episodes[serverIdx];
  const ep = server?.server_data?.[epIdx];
  
  if (!ep) {
    playerLoading.innerHTML = '<p style="color:var(--text-muted);">Không tìm thấy tập phim.</p>';
    return;
  }
  
  if (!ep.link_embed) {
    playerLoading.innerHTML = '<p style="color:var(--text-muted);">Tập phim này chưa có video (đang cập nhật).</p>';
    return;
  }
  
  // Load player
  playerFrame.src = ep.link_embed;
  playerFrame.onload = () => playerLoading.classList.add('hidden');
  setTimeout(() => playerLoading.classList.add('hidden'), 5000);
  
  // Watch info
  document.getElementById('watchInfo').innerHTML = `
    <h2 class="watch-title">${movie.name}</h2>
    <p class="watch-subtitle">${server.server_name} — Tập ${ep.name} • ${movie.quality || 'HD'} • ${movie.lang || ''}</p>
    <div style="margin-top:12px;display:flex;gap:8px;">
      <a href="#" class="btn btn-secondary" onclick="navigateTo('detail','${slug}'); return false;" style="padding:8px 16px;font-size:0.8rem;">← Chi tiết phim</a>
    </div>
  `;
  
  // Episode list
  const epSection = document.getElementById('episodeSection');
  epSection.innerHTML = `
    <h3>Chọn tập phim</h3>
    <div class="server-tabs">
      ${episodes.map((srv, si) =>
        `<button class="server-tab ${si===serverIdx?'active':''}" onclick="switchWatchServer(${si})">${srv.server_name}</button>`
      ).join('')}
    </div>
    ${episodes.map((srv, si) => `
      <div class="episode-grid watch-ep-server" data-server="${si}" style="${si!==serverIdx?'display:none':''}">
        ${(srv.server_data||[]).map((e, ei) =>
          `<button class="ep-btn ${si===serverIdx && ei===epIdx?'active':''}" onclick="navigateTo('watch','${slug}','${si}-${ei}')">${e.name}</button>`
        ).join('')}
      </div>
    `).join('')}
  `;
}

window.switchWatchServer = function(idx) {
  document.querySelectorAll('.watch-ep-server').forEach(g => g.style.display = 'none');
  document.querySelector(`.watch-ep-server[data-server="${idx}"]`).style.display = 'grid';
  document.querySelectorAll('#episodeSection .server-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
};

// ============================================
// SEARCH
// ============================================
async function loadSearch(keyword, page = 1) {
  showPage('pageSearch');
  document.getElementById('searchTitle').textContent = `Kết quả: "${keyword}"`;
  showSkeletons('gridSearch', 24);
  
  const data = await fetchApi(`/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`);
  if (data?.data) {
    renderGrid('gridSearch', data.data.items || []);
    const p = data.data.params?.pagination;
    if (p) renderPagination('paginationSearch', p, (pg) => loadSearch(keyword, pg));
  }
}

// Search suggestions
async function searchSuggest(keyword) {
  const box = document.getElementById('searchSuggestions');
  if (!keyword || keyword.length < 2) { box.classList.remove('active'); return; }
  
  const data = await fetchApi(`/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=8`);
  if (!data?.data?.items?.length) { box.classList.remove('active'); return; }
  
  box.innerHTML = data.data.items.slice(0, 6).map(m => `
    <div class="suggestion-item" onclick="navigateTo('detail','${m.slug}'); document.getElementById('searchSuggestions').classList.remove('active');">
      <img src="${imgUrl(m.thumb_url)}" alt="${m.name}" loading="lazy">
      <div class="suggestion-info">
        <h4>${m.name}</h4>
        <p>${m.year || ''} • ${m.episode_current || ''}</p>
      </div>
    </div>
  `).join('');
  box.classList.add('active');
}

// ============================================
// DROPDOWNS (Genre & Country)
// ============================================
async function loadDropdowns() {
  const [genreData, countryData] = await Promise.all([
    fetchApi('/the-loai'),
    fetchApi('/quoc-gia'),
  ]);
  
  const genreMenu = document.getElementById('genreDropdown');
  if (genreData?.data?.items) {
    genreMenu.innerHTML = genreData.data.items.map(g =>
      `<a href="#" onclick="navigateTo('genre','${g.slug}'); return false;">${g.name}</a>`
    ).join('');
  }
  
  const countryMenu = document.getElementById('countryDropdown');
  if (countryData?.data?.items) {
    countryMenu.innerHTML = countryData.data.items.map(c =>
      `<a href="#" onclick="navigateTo('country','${c.slug}'); return false;">${c.name}</a>`
    ).join('');
  }
  
  // Year filter
  const yearSelect = document.getElementById('filterYear');
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2000; y--) {
    yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Load home
  loadHome();
  loadDropdowns();
  
  // Header scroll
  window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
    document.getElementById('scrollTop').classList.toggle('visible', window.scrollY > 500);
  });
  
  // Scroll top
  document.getElementById('scrollTop').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  // Mobile menu
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('open');
  });
  
  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchSuggest(searchInput.value.trim()), 400);
  });
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const kw = searchInput.value.trim();
      if (kw) {
        navigateTo('search', kw);
        document.getElementById('searchSuggestions').classList.remove('active');
      }
    }
  });
  document.getElementById('searchBtn').addEventListener('click', () => {
    const kw = searchInput.value.trim();
    if (kw) {
      navigateTo('search', kw);
      document.getElementById('searchSuggestions').classList.remove('active');
    }
  });
  
  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      document.getElementById('searchSuggestions').classList.remove('active');
    }
  });
});
