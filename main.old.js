// Register Service Worker (disabled in development)
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if ('serviceWorker' in navigator && !isDevelopment) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
} else if (isDevelopment) {
  // Unregister service workers in development
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
        console.log('Service Worker unregistered for development');
      }
    });
  }
}

// PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallPromotion();
});

function showInstallPromotion() {
  const installPrompt = document.createElement('div');
  installPrompt.className = 'install-prompt show';
  installPrompt.innerHTML = `
    <p>Instala la aplicación para un acceso más rápido</p>
    <button id="install-btn">Instalar</button>
    <button id="dismiss-btn" style="background: transparent; color: var(--text-secondary);">Más tarde</button>
  `;
  document.body.appendChild(installPrompt);

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      deferredPrompt = null;
      installPrompt.remove();
    }
  });

  document.getElementById('dismiss-btn').addEventListener('click', () => {
    installPrompt.remove();
  });
}

// App State Management
const AppState = {
  currentPage: 'home',
  sideNavOpen: false,

  setPage(pageName) {
    this.currentPage = pageName;
    this.updateUI();
  },

  toggleSideNav() {
    this.sideNavOpen = !this.sideNavOpen;
    const sideNav = document.getElementById('side-nav');
    const overlay = document.getElementById('overlay');

    if (this.sideNavOpen) {
      sideNav.classList.add('open');
      if (!overlay) {
        const newOverlay = document.createElement('div');
        newOverlay.id = 'overlay';
        newOverlay.className = 'overlay active';
        document.body.appendChild(newOverlay);
        newOverlay.addEventListener('click', () => this.toggleSideNav());
      }
    } else {
      sideNav.classList.remove('open');
      if (overlay) overlay.remove();
    }
  },

  updateUI() {
    // Update page views
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.remove('active');
    });
    const activePage = document.getElementById(`page-${this.currentPage}`);
    if (activePage) {
      activePage.classList.add('active');
    }

    // Update bottom navigation
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === this.currentPage) {
        item.classList.add('active');
      }
    });

    // Update side navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.page === this.currentPage) {
        link.classList.add('active');
      }
    });

    // Close side nav if open
    if (this.sideNavOpen) {
      this.toggleSideNav();
    }

    // Scroll to top
    window.scrollTo(0, 0);
  }
};

// Carousel functionality
let currentSlide = 0;
const totalSlides = 3;

function initCarousel() {
  const track = document.getElementById('carousel-track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const dotsContainer = document.getElementById('carousel-dots');

  if (!track) return;

  // Create dots
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('button');
    dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  }

  prevBtn.addEventListener('click', () => {
    currentSlide = currentSlide === 0 ? totalSlides - 1 : currentSlide - 1;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    currentSlide = currentSlide === totalSlides - 1 ? 0 : currentSlide + 1;
    updateCarousel();
  });

  function goToSlide(index) {
    currentSlide = index;
    updateCarousel();
  }

  function updateCarousel() {
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentSlide);
    });
  }

  // Auto-play
  setInterval(() => {
    currentSlide = currentSlide === totalSlides - 1 ? 0 : currentSlide + 1;
    updateCarousel();
  }, 5000);
}

// Animated counter
function animateCounter(element) {
  const target = parseInt(element.dataset.target);
  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

function initCounters() {
  const counters = document.querySelectorAll('.stat-value, .stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}

// Quick search functionality with interactive results
function initSearch() {
  const searchInput = document.getElementById('quick-search');
  const searchClear = document.getElementById('search-clear');
  const searchResults = document.getElementById('search-results');

  if (!searchInput) return;

  // Sample search data
  const searchData = [
    { title: 'Reglamento Interno Consejos Escolares', description: 'Documento oficial con normativas y procedimientos', category: 'Documentos', icon: '📄' },
    { title: 'Taller de Liderazgo Estudiantil', description: 'Capacitación gratuita para estudiantes', category: 'Eventos', icon: '🎓' },
    { title: 'Reunión Consejo Escolar', description: 'Próxima reunión ordinaria del mes', category: 'Eventos', icon: '📅' },
    { title: 'Portal de Transparencia', description: 'Consulta presupuestos y decisiones municipales', category: 'Recursos', icon: '🔍' },
    { title: 'Estatutos Centro de Padres', description: 'Marco legal y organizativo', category: 'Documentos', icon: '📄' },
    { title: 'Fondos Concursables', description: 'Financiamiento para proyectos comunitarios', category: 'Proyectos', icon: '💰' },
    { title: 'Acta de Constitución', description: 'Modelo de acta para constitución del consejo', category: 'Documentos', icon: '📄' },
    { title: 'Guía de Participación Ciudadana', description: 'Manual para participar en actividades', category: 'Recursos', icon: '📖' }
  ];

  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    // Show/hide clear button
    if (query) {
      searchClear.classList.add('visible');
    } else {
      searchClear.classList.remove('visible');
      searchResults.classList.remove('visible');
      return;
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    searchResults.classList.remove('visible');
    searchInput.focus();
  });

  function performSearch(query) {
    const lowerQuery = query.toLowerCase();
    const results = searchData.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery)
    );

    if (results.length > 0) {
      searchResults.innerHTML = results.map(result => `
        <div class="search-result-item">
          <div class="search-result-title">${result.icon} ${result.title}</div>
          <div class="search-result-description">${result.description}</div>
          <div class="search-result-meta">
            <span class="search-result-category">${result.category}</span>
          </div>
        </div>
      `).join('');
      searchResults.classList.add('visible');
    } else {
      searchResults.innerHTML = `
        <div class="search-no-results">
          <div class="search-no-results-icon">🔍</div>
          <div>No se encontraron resultados para "${query}"</div>
        </div>
      `;
      searchResults.classList.add('visible');
    }
  }

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) {
      searchResults.classList.remove('visible');
    }
  });
}

// Poll functionality
function initPoll() {
  const pollOptions = document.querySelectorAll('.poll-option');

  pollOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove previous selection
      pollOptions.forEach(opt => opt.style.borderColor = '');

      // Mark as selected
      option.style.borderColor = 'var(--primary-color)';
      option.style.borderWidth = '3px';

      showToast('¡Gracias por tu voto!');
    });
  });
}

// Event confirmation
function initEvents() {
  const eventBtns = document.querySelectorAll('.event-btn');

  eventBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.textContent === 'Confirmar') {
        btn.textContent = '✓ Confirmado';
        btn.style.background = 'var(--gradient-primary)';
        btn.style.color = 'white';
        showToast('Asistencia confirmada');
      } else {
        btn.textContent = 'Confirmar';
        btn.style.background = 'transparent';
        btn.style.color = 'var(--primary-color)';
        showToast('Asistencia cancelada');
      }
    });
  });
}

// Opportunities Carousel
function initOpportunitiesCarousel() {
  const carousel = document.querySelector('.opportunities-carousel');
  const indicators = document.querySelectorAll('.indicator');

  if (!carousel || indicators.length === 0) return;

  const cards = carousel.querySelectorAll('.opportunity-card');

  // Update indicators based on scroll position
  carousel.addEventListener('scroll', () => {
    const scrollLeft = carousel.scrollLeft;
    const cardWidth = cards[0].offsetWidth + 16; // width + gap
    const currentIndex = Math.round(scrollLeft / cardWidth);

    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === currentIndex);
    });
  });

  // Click indicators to scroll to card
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      const cardWidth = cards[0].offsetWidth + 16;
      carousel.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
    });
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize new features
  initCarousel();
  initCounters();
  initSearch();
  initPoll();
  initEvents();
  initOpportunitiesCarousel();
  // Menu button
  document.getElementById('menu-btn').addEventListener('click', () => {
    AppState.toggleSideNav();
  });

  // Close nav button
  document.getElementById('close-nav-btn').addEventListener('click', () => {
    AppState.toggleSideNav();
  });

  // Notifications button
  document.getElementById('notifications-btn').addEventListener('click', () => {
    showNotifications();
  });

  // Side navigation links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      AppState.setPage(page);
    });
  });

  // Bottom navigation buttons
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      AppState.setPage(page);
    });
  });

  // Quick action buttons
  document.querySelectorAll('.action-card').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      handleQuickAction(action);
    });
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const parent = btn.closest('.page-view');

      // Update active tab button
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active tab content
      parent.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      const activeContent = parent.querySelector(`#${tabId}`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });

  // Download buttons
  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const resourceItem = e.target.closest('.resource-item');
      const resourceName = resourceItem?.querySelector('h4')?.textContent || 'documento';
      showToast(`Descargando: ${resourceName}`);
    });
  });
});

// Quick Actions Handler
function handleQuickAction(action) {
  switch(action) {
    case 'documentos':
      AppState.setPage('recursos');
      break;
    case 'eventos':
      showToast('Próximamente: Calendario de eventos');
      break;
    case 'consultas':
      showToast('Próximamente: Sistema de consultas');
      break;
    case 'noticias':
      showToast('Mostrando noticias recientes');
      break;
  }
}

// Notifications Modal
function showNotifications() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 16px; max-width: 400px; width: 90%; box-shadow: var(--shadow-lg); z-index: 300;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="font-size: 20px; font-weight: 600;">Notificaciones</h3>
        <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="padding: 12px; background: var(--background); border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Nueva reunión programada</div>
          <div style="font-size: 14px; color: var(--text-secondary);">Consejo Escolar - 15 de noviembre</div>
        </div>
        <div style="padding: 12px; background: var(--background); border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Documento disponible</div>
          <div style="font-size: 14px; color: var(--text-secondary);">Guía de participación actualizada</div>
        </div>
        <div style="padding: 12px; background: var(--background); border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Fondos concursables abiertos</div>
          <div style="font-size: 14px; color: var(--text-secondary);">Postula hasta el 30 de noviembre</div>
        </div>
      </div>
    </div>
  `;
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 250;';
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById('close-modal').addEventListener('click', () => {
    modal.remove();
  });
}

// Toast Notifications
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: calc(var(--bottom-nav-height) + 20px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--text-primary);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    animation: slideUp 0.3s ease;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
  @keyframes slideDown {
    from {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    to {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
  }
`;
document.head.appendChild(style);

// Request notification permission
if ('Notification' in window && navigator.serviceWorker) {
  Notification.requestPermission().then((permission) => {
    console.log('Notification permission:', permission);
  });
}

// Handle online/offline status
window.addEventListener('online', () => {
  showToast('Conexión restaurada');
});

window.addEventListener('offline', () => {
  showToast('Sin conexión - Modo offline activado');
});
