function setTheme(mode) {
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try { localStorage.setItem('theme', mode); } catch {}
    document.querySelectorAll('#themeToggle, #themeToggleDesktop').forEach(btn => {
        if (!btn) return;
        btn.textContent = root.classList.contains('dark') ? '☀️' : '🌙';
    });
}
function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
}
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
document.getElementById('themeToggleDesktop')?.addEventListener('click', toggleTheme);

const menuBtn = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
        const hidden = mobileNav.classList.toggle('hidden');
        menuBtn.setAttribute('aria-expanded', String(!hidden));
    });
}

const inPageLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
inPageLinks.forEach(a => {
    a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const el = id && document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (mobileNav && !mobileNav.classList.contains('hidden')) {
            mobileNav.classList.add('hidden');
            menuBtn?.setAttribute('aria-expanded', 'false');
        }
        history.replaceState(null, '', id);
    });
});

const sectionIds = ['#about', '#projects', '#contact'];
const sectionEls = sectionIds.map(id => document.querySelector(id)).filter(Boolean);
const navLinks = Array.from(document.querySelectorAll('header a[href^="#"], aside a[href^="#"]'));
const setActive = (id) => {
    navLinks.forEach(a => {
        const match = a.getAttribute('href') === id;
        a.classList.toggle('nav-active', match);
    });
};
const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) setActive('#' + entry.target.id);
    });
}, { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.2, 0.6] });
sectionEls.forEach(el => io.observe(el));

const projectsSection = document.querySelector('#projects');
const ghUser = projectsSection?.dataset.ghUser || 'UnrealFar';
const projectGrid = document.getElementById('projectGrid');
const searchInput = document.getElementById('projectSearch');

let ghRepos = [];
let pinnedNames = [];

function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function repoCard(r) {
    const url = r.html_url;
    const display = url.replace(/^https?:\/\//, '');
    const desc = escapeHtml(r.description || 'No description');
    const lang = r.language ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">${escapeHtml(r.language)}</span>` : '';
    const stars = typeof r.stargazers_count === 'number' ? `★ ${r.stargazers_count}` : '';
    return `
    <a href="${url}" target="_blank" rel="noopener" class="block">
        <article class="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <h4 class="font-bold">${escapeHtml(r.name)}</h4>
            <p class="text-sm text-gray-600 mt-1">${desc}</p>
            <div class="mt-3 flex items-center gap-2 text-xs text-gray-600">
                ${lang}
                ${stars ? `<span>${stars}</span>` : ''}
            </div>
            <p class="mt-3 text-sm text-indigo-600">${display}</p>
        </article>
    </a>`;
}
function renderRepos(items, q = '') {
    if (!projectGrid) return;
    const needle = q.toLowerCase().trim();
    const filtered = needle
        ? items.filter(r =>
            (r.name && r.name.toLowerCase().includes(needle)) ||
            (r.description && r.description.toLowerCase().includes(needle)) ||
            (r.language && String(r.language).toLowerCase().includes(needle))
          )
        : items;
    if (!filtered.length) {
        projectGrid.innerHTML = `<p class="text-sm text-gray-500">No repositories found.</p>`;
        return;
    }
    const limited = filtered.slice(0, 6);
    projectGrid.innerHTML = limited.map(repoCard).join('');
}
function updateDefaultRepos() {
    if (!projectGrid || !ghRepos.length) return;
    const q = (searchInput?.value || '').trim();
    if (q) {
        renderRepos(ghRepos, q);
        return;
    }
    if (pinnedNames.length) {
        const pinned = pinnedNames
            .map(name => ghRepos.find(r => r.name.toLowerCase() === String(name).toLowerCase()))
            .filter(Boolean);
        if (pinned.length) {
            renderRepos(pinned);
            return;
        }
    }
    renderRepos(ghRepos);
}
async function loadPinned() {
    try {
        const res = await fetch(`https://gh-pinned-repos.egoist.dev/?username=${encodeURIComponent(ghUser)}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('Pinned API failed');
        const data = await res.json();
        pinnedNames = Array.isArray(data) ? data.map(x => x.repo).filter(Boolean) : [];
    } catch {
        pinnedNames = [];
    } finally {
        updateDefaultRepos();
    }
}
async function loadRepos() {
    if (!projectGrid) return;
    projectGrid.innerHTML = `<p class="text-sm text-gray-500">Loading repositories…</p>`;
    try {
        const res = await fetch(`https://api.github.com/users/${ghUser}/repos?per_page=100&sort=updated`, { headers: { 'Accept': 'application/vnd.github+json' } });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data = await res.json();
        ghRepos = (Array.isArray(data) ? data : []).filter(r => !r.fork);
    } catch {
        projectGrid.innerHTML = `<p class="text-sm text-red-600">Failed to load repositories. Try again later.</p>`;
        return;
    }
    updateDefaultRepos();
}

searchInput?.addEventListener('input', () => {
    const q = searchInput.value;
    if (q.trim()) renderRepos(ghRepos, q);
    else updateDefaultRepos();
});

loadPinned();
loadRepos();

const copyBtn = document.getElementById('copyEmail');
const emailLink = document.getElementById('emailLink');
copyBtn?.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(emailLink?.textContent.trim() || '');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch {
        const r = document.createRange();
        r.selectNodeContents(emailLink);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        try { document.execCommand('copy'); copyBtn.textContent = 'Copied!'; } catch {}
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
        sel.removeAllRanges();
    }
});

const toTop = document.getElementById('toTopBtn');
window.addEventListener('scroll', () => {
    if (!toTop) return;
    const show = window.scrollY > 400;
    toTop.classList.toggle('hidden', !show);
});
toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');