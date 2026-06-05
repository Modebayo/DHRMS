function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    
    updateThemeIcons();
    updateEmergencyThemeUI();
}

function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('[data-theme-icon]').forEach(icon => {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateEmergencyThemeUI() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const iconEl = document.getElementById('themeToggleIcon');
    const textEl = document.getElementById('themeToggleText');
    const fabIcon = document.getElementById('fabThemeIcon');
    
    if (iconEl && textEl) {
        iconEl.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        textEl.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
    
    if (fabIcon) {
        fabIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateThemeIcons();
    injectSidebarCloseButton();
    
    setTimeout(() => {
        updateEmergencyThemeUI();
    }, 100);
});

function injectSidebarCloseButton() {
    const headers = document.querySelectorAll('.sidebar-header');
    headers.forEach(header => {
        if (header.querySelector('.sidebar-close')) return;
        const btn = document.createElement('button');
        btn.className = 'sidebar-close';
        btn.setAttribute('onclick', 'toggleSidebar()');
        btn.setAttribute('aria-label', 'Close sidebar');
        btn.innerHTML = '<i data-lucide="x" style="width:20px;height:20px"></i>';
        header.appendChild(btn);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}