// --- AUTHENTICATION & HEADERS HELPER ---

function getAuthHeaders(includeContentType = true) {
    const token = localStorage.getItem('lucid_token');
    const headers = {
        'Authorization': `Bearer ${token}`
    };
    if (includeContentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

function checkAuthStatus() {
    const token = localStorage.getItem('lucid_token');
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');

    if (token) {
        authScreen.style.display = 'none';
        appContent.style.display = 'flex'; 
        window.loadFeed(); 
        window.loadTimeline(); 
    } else {
        authScreen.style.display = 'block';
        appContent.style.display = 'none';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('lucid_token', data.token);
            alert('Registration successful! Welcome to Lucid AI.');
            checkAuthStatus(); 
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Registration failed:', error);
    }
}

async function handleLogin(event) {
    event.preventDefault(); 
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('lucid_token', data.token);
            checkAuthStatus(); 
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Login failed:', error);
    }
}

function handleLogout() {
    localStorage.removeItem('lucid_token');
    checkAuthStatus();
}

// --- DATA FETCHING & UI BUILDERS ---

window.loadFeed = async function() {
  const feedContainer = document.getElementById('feed');
  const countEl = document.getElementById('queueCount');
  if (!feedContainer) return;
  
  feedContainer.innerHTML = '<p style="text-align:left; color: var(--text-light); font-style: italic;">Loading intelligence feed...</p>';
  
  try {
    const response = await fetch('/api/articles', {
      method: 'GET', 
      headers: getAuthHeaders()
    });

    if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
    }
    
    if (!response.ok) throw new Error('Network error');
    
    const data = await response.json();
    const articles = data.articles || [];
    
    if (countEl) countEl.innerText = data.unprocessedCount || 0;

    if (articles.length === 0) {
      feedContainer.innerHTML = '<p id="server-empty-msg" style="text-align:left; color: var(--text-light); font-style: italic;">Feed is empty. Fetch intelligence to begin.</p>';
      return;
    }

    let feedHtml = '';
    articles.forEach(article => {
      feedHtml += `
        <div class="card article-card" id="card-${article._id}" style="position: relative;">
          <button 
            onclick="toggleLike('${article._id}', this)" 
            style="position: absolute; top: 15px; right: 15px; background: none; border: none; cursor: pointer; color: ${article.isLiked ? '#e74c3c' : '#a0a0a0'}; transition: transform 0.2s; padding: 5px;"
            onmouseover="this.style.transform='scale(1.1)'"
            onmouseout="this.style.transform='scale(1)'"
            title="Flag this article"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${article.isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          <a href="${article.url}" target="_blank"><h3>${article.title}</h3></a>
          <div class="source">${article.source}</div>
          <div class="summary">${article.aiSummary}</div>
        </div>
      `;
    });
    feedContainer.innerHTML = feedHtml;

  } catch (error) {
    console.error("Error loading feed:", error);
    feedContainer.innerHTML = '<p style="color: #e74c3c; font-style: italic;">Cannot connect to backend. Is the server running?</p>';
  }
};

window.toggleLike = async function(id, btnElement) {
  const svgElement = btnElement.querySelector('svg');
  const isCurrentlyLiked = svgElement.getAttribute('fill') === 'currentColor';
  
  if (isCurrentlyLiked) {
    svgElement.setAttribute('fill', 'none');
    btnElement.style.color = '#a0a0a0';
  } else {
    svgElement.setAttribute('fill', 'currentColor');
    btnElement.style.color = '#e74c3c';
  }

  try {
    const response = await fetch('/api/toggle-like/' + id, {
      method: 'POST', 
      headers: getAuthHeaders() 
    });

    if (!response.ok) throw new Error("Backend failed to save");
  } catch (error) {
    console.error("Flag toggle failed, reverting UI:", error);
    if (isCurrentlyLiked) {
      svgElement.setAttribute('fill', 'currentColor');
      btnElement.style.color = '#e74c3c';
    } else {
      svgElement.setAttribute('fill', 'none');
      btnElement.style.color = '#a0a0a0';
    }
  }
};

window.openSmartSummary = async function(articleId, btnElement) {
  let targetCard = document.getElementById('card-' + articleId);
  
  if (targetCard) {
    window.showFeed(); 
    
    setTimeout(() => {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.classList.add('pulse-card');
      setTimeout(() => targetCard.classList.remove('pulse-card'), 2000);
    }, 50);
    return; 
  }

  const originalHTML = btnElement.innerHTML;
  btnElement.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';
  btnElement.style.animation = "spin 1s linear infinite";

  try {
    const response = await fetch('/api/process-single/' + articleId, {
      method: 'POST', 
      headers: getAuthHeaders() 
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Backend failed to process");
    }

    btnElement.style.animation = "none";
    btnElement.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    btnElement.style.color = "#10b981"; 
    btnElement.disabled = true;
    btnElement.style.cursor = "default";

    await window.loadFeed();
    await window.loadTimeline();

  } catch (error) {
    console.error("Error generating summary:", error);
    alert(error.message || "Failed to generate summary. Check backend logs.");
    btnElement.innerHTML = originalHTML;
    btnElement.style.animation = "none";
  }
};

window.processFromTimeline = window.openSmartSummary;

window.loadTimeline = async function() {
  const container = document.getElementById('timelineList');
  if (!container) return;
  container.innerHTML = '<p style="opacity: 0.7;">Loading timeline...</p>'; 
  
  try {
    const res = await fetch('/api/timeline', {
        headers: getAuthHeaders(false) 
    });

    if (!res.ok) throw new Error('Network error');
    const articles = await res.json();
    
    if (articles.length === 0) {
      container.innerHTML = '<p style="opacity: 0.7;">No articles in timeline.</p>';
      return;
    }

    const grouped = articles.reduce((acc, article) => {
      const dateVal = article.createdAt ? new Date(article.createdAt) : new Date();
      const dateStr = dateVal.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(article);
      return acc;
    }, {});

    let timelineHtml = '';
    for (const [date, items] of Object.entries(grouped)) {
      timelineHtml += `<div style="font-size: 1.2em; font-weight: 600; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid rgba(128, 128, 128, 0.2); padding-bottom: 8px;">${date}</div>`;
      
      items.forEach(item => {
        const isArchived = item.isArchived === true; 
        const archivedClass = isArchived ? 'archived' : '';
        const hasSummary = item.aiSummary && item.aiSummary.trim() !== '';
        
        timelineHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.1);">
            <div style="flex: 1; padding-right: 24px;">
              <a href="${item.url}" target="_blank" style="text-decoration: none; color: inherit; font-weight: 500; font-size: 1.05em; line-height: 1.4;">${item.title}</a>
              ${!hasSummary ? `<span style="font-size: 0.75em; background: var(--border-color); color: var(--text-light); padding: 2px 6px; border-radius: 4px; margin-left: 10px; vertical-align: middle;">In Queue</span>` : ''}
            </div>
            <div style="display: flex; gap: 8px;">
              ${!hasSummary ? `
              <button onclick="processFromTimeline('${item._id}', this)" title="Generate AI Summary" style="background: none; border: none; cursor: pointer; color: var(--brand-color); padding: 8px; transition: transform 0.2s;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </button>` : ''}
              <button class="archive-btn ${archivedClass}" onclick="toggleArchive('${item._id}', this)" title="${isArchived ? 'Remove from Read Later' : 'Read Later'}" style="background: none; border: none; cursor: pointer; color: inherit; padding: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isArchived ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7-5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </button>
            </div>
          </div>
        `;
      });
    }
    container.innerHTML = timelineHtml;
  } catch (error) {
    console.error("Frontend Timeline Error:", error);
    container.innerHTML = '<p style="color: red;">Error loading timeline.</p>';
  }
};

window.loadBookmarks = async function() {
  const container = document.getElementById('bookmarksList'); 
  if (!container) return;
  container.innerHTML = '<p style="opacity: 0.7;">Loading bookmarks...</p>'; 
  
  try {
    const res = await fetch('/api/bookmarks', {
        headers: getAuthHeaders(false) 
    });
    
    if (!res.ok) throw new Error('Network error');
    const articles = await res.json();
    
    if (articles.length === 0) {
      container.innerHTML = '<p style="opacity: 0.7;">No articles saved for later.</p>';
      return;
    }

    let html = '';
    articles.forEach(item => {
      html += `
        <div style="padding: 16px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.1); display: flex; justify-content: space-between; align-items: center;">
          <a href="${item.url}" target="_blank" class="bookmark-link" style="text-decoration: none; font-weight: 500;">${item.title}</a>
          <button class="smart-summary-btn" onclick="openSmartSummary('${item._id}', this)" title="Read AI Summary" style="background: none; border: none; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </button>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (error) {
    console.error("Frontend Bookmarks Error:", error);
    container.innerHTML = '<p style="color: red;">Error loading bookmarks.</p>';
  }
};

window.toggleArchive = async function(id, buttonEl) {
  try {
    const res = await fetch('/api/archive/' + id, { 
        method: 'POST',
        headers: getAuthHeaders() 
    });
    const data = await res.json();
    if (data.isArchived) {
      buttonEl.classList.add('archived');
      buttonEl.querySelector('svg').setAttribute('fill', 'currentColor'); 
      buttonEl.setAttribute('title', 'Remove from Read Later'); 
    } else {
      buttonEl.classList.remove('archived');
      buttonEl.querySelector('svg').setAttribute('fill', 'none'); 
      buttonEl.setAttribute('title', 'Read Later'); 
    }
  } catch (error) {
    console.error("Error toggling archive:", error);
  }
};

// --- NAVIGATION PANELS ---
window.hideAllPanels = function() {
  ['topicsPanel', 'controlPanel', 'feed', 'timelinePanel', 'bookmarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
};

window.showTopics = function() {
  window.hideAllPanels();
  const p = document.getElementById('topicsPanel'); if(p) p.style.display = 'block';
  const f = document.getElementById('feed'); if(f) f.style.display = 'block';
  const t = document.getElementById('pageTitle'); if(t) t.innerText = 'Topics Directory';
  const n = document.getElementById('navTopics'); if(n) n.classList.add('active');
};

window.showFeed = function() {
  window.hideAllPanels();
  const c = document.getElementById('controlPanel'); if(c) c.style.display = 'block';
  const f = document.getElementById('feed'); if(f) f.style.display = 'block';
  const t = document.getElementById('pageTitle'); if(t) t.innerText = 'Your Feed';
  const n = document.getElementById('navFeed'); if(n) n.classList.add('active');
  
  const allNewsPill = document.querySelector('.tag-pill');
  if (allNewsPill) window.filterFeed(allNewsPill, 'ALL');
};

window.showTimeline = function() {
  window.hideAllPanels();
  const t = document.getElementById('timelinePanel'); if(t) t.style.display = 'block';
  const p = document.getElementById('pageTitle'); if(p) p.innerText = 'Intelligence Timeline';
  const n = document.getElementById('navTimeline'); if(n) n.classList.add('active');
};

window.showBookmarks = function() {
  window.hideAllPanels();
  const b = document.getElementById('bookmarks'); if(b) b.style.display = 'block';
  const p = document.getElementById('pageTitle'); if(p) p.innerText = 'Bookmarks';
  const n = document.getElementById('navBookmarks'); if(n) n.classList.add('active');
  window.loadBookmarks();
};

// --- UI FILTERS & THEMES ---
window.filterFeed = function(buttonElement, keywordString) {
  document.querySelectorAll('.tag-pill').forEach(btn => btn.classList.remove('active'));
  if(buttonElement) buttonElement.classList.add('active');

  const cards = document.querySelectorAll('.article-card');
  let matchCount = 0;
  
  cards.forEach(card => {
    if (keywordString === 'ALL' || card.innerText.includes(keywordString)) {
      card.style.display = 'block';
      matchCount++;
    } else {
      card.style.display = 'none';
    }
  });

  const serverEmptyMsg = document.getElementById('server-empty-msg');
  if (serverEmptyMsg) serverEmptyMsg.style.display = 'none';

  const feedContainer = document.getElementById('feed');
  let emptyState = document.getElementById('empty-filter-msg');
  
  if (matchCount === 0 && feedContainer) {
    if (!emptyState) {
      emptyState = document.createElement('p');
      emptyState.id = 'empty-filter-msg';
      emptyState.style.cssText = "text-align:left; color: var(--text-light); font-style: italic; padding-top: 20px;";
      feedContainer.appendChild(emptyState);
    }
    emptyState.innerText = 'No intelligence briefings found for ' + keywordString + ' yet. Check back later.';
    emptyState.style.display = 'block';
  } else if (emptyState) {
    emptyState.style.display = 'none';
  }
};

window.toggleTheme = function() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('lucid_theme', isDark ? 'dark' : 'light');
  
  const moon = document.getElementById('moon-icon');
  const sun = document.getElementById('sun-icon');
  if (isDark) {
    if(moon) moon.style.display = 'none';
    if(sun) sun.style.display = 'block';
  } else {
    if(moon) moon.style.display = 'block';
    if(sun) sun.style.display = 'none';
  }
};

// --- BACKEND TRIGGERS ---
window.runScraper = async function() {
  const btn = document.getElementById('scrapeBtn');
  const status = document.getElementById('statusMsg');
  if(btn) btn.disabled = true; 
  if(status) { status.innerHTML = "Gathering verified AI intelligence... please wait."; status.className = "status"; }
  
  try {
    const response = await fetch('/api/scrape', {
        headers: getAuthHeaders(false)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text || 'Connection failed.');
    if(status) status.innerText = text + " Updating feed...";
    
    await window.loadFeed();
    await window.loadTimeline();
    if(status) status.innerText = "Feed Updated!";
  } catch (e) {
    if(status) status.innerHTML = '<div class="error-box">' + e.message + '</div>';
  } finally {
    if(btn) btn.disabled = false;
  }
};

window.runProcessor = function() {
  const btn = document.getElementById('processBtn');
  const status = document.getElementById('statusMsg');
  if(btn) btn.disabled = true;
  if(status) { status.innerText = "AI is analyzing and tagging... please hold."; status.className = "status"; }
  
  fetch('/api/process', {
      headers: getAuthHeaders(false)
  })
    .then(async response => {
      const text = await response.text();
      if (!response.ok) throw new Error(text || 'Failed to process articles.');
      return text;
    })
    .then(async text => {
      if(status) status.innerText = text;
      await window.loadFeed();
      await window.loadTimeline();
    })
    .catch(err => {
      if(status) status.innerHTML = '<div class="error-box">' + err.message + '</div>';
    })
    .finally(() => {
      if(btn) btn.disabled = false;
    });
};

// --- SEARCH BAR LOGIC ---
window.initializeTopicSearch = function() {
  const searchInput = document.getElementById('topicSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.article-card');
    
    cards.forEach(card => {
      const textToSearch = card.innerText.toLowerCase();
      if (textToSearch.includes(searchTerm)) {
        card.style.display = 'block'; 
      } else {
        card.style.display = 'none';
      }
    });
  });
};

// --- ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('bookmark-styles')) {
    const style = document.createElement('style');
    style.id = 'bookmark-styles';
    style.innerHTML = '.bookmark-link { color: inherit; transition: color 0.2s ease; display: block; } .bookmark-link:hover { color: var(--brand-color) !important; }';
    document.head.appendChild(style);
  }

  const mainScroll = document.getElementById('mainScroll');
  const glassHeader = document.getElementById('glassHeader');
  if (mainScroll && glassHeader) {
    mainScroll.addEventListener('scroll', () => {
      glassHeader.style.borderBottom = mainScroll.scrollTop > 10 ? '1px solid var(--border-color)' : '1px solid transparent';
    });
  }

  if (localStorage.getItem('lucid_theme') === 'dark') {
    document.body.classList.add('dark-theme');
    const moon = document.getElementById('moon-icon');
    const sun = document.getElementById('sun-icon');
    if(moon) moon.style.display = 'none';
    if(sun) sun.style.display = 'block';
  }

  checkAuthStatus(); 
  window.initializeTopicSearch(); 
});