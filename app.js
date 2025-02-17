document.addEventListener('DOMContentLoaded', initApp);

const ACCESS_KEY = 'xCfZgTB9wl6DxxCCOL2lOPhmJF5e3pCVuZp6hSy1hvs';
const BASE_URL = 'https://api.unsplash.com/search/photos';
let currentPage = 1;
let currentImages = [];
let pinnedImages = new Set();
let lastSearchQuery = '';
let isLoading = false;
let debounceTimeout;

function initApp() {
    initCursorEffect();
    setupSearchListener();
    setupTagListeners();
    setupFilterListeners();
    setupInfiniteScroll();
    loadPinnedImages();
    setupPinView();
}

function setupImageZoom() {
    if (window.innerWidth <= 768) return; // Disable feature on mobile

    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `<div class="image-modal-content">
                            <span class="close-btn">&times;</span>
                            <img src="" alt="Zoomed Image">
                       </div>`;
    document.body.appendChild(modal);

    const modalImg = modal.querySelector('img');
    const closeButton = modal.querySelector('.close-btn');

    document.querySelectorAll('.image-card img').forEach(img => {
        img.addEventListener('click', (e) => {
            modal.style.display = 'flex';
            modalImg.src = e.target.src;
            setTimeout(() => modal.classList.add('show'), 10);
        });
    });

    closeButton.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal(modal);
    });
}

function closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

function initCursorEffect() {
    const cursor = document.querySelector('.cursor-glow');
    let lastX = 0, lastY = 0;
    let hue = 0;

    const updateCursor = (e) => {
        const currentX = e.clientX;
        const currentY = e.clientY;

        const deltaX = currentX - lastX;
        const deltaY = currentY - lastY;
        const speed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        cursor.style.left = `${currentX}px`;
        cursor.style.top = `${currentY}px`;

        const size = Math.min(100, 200 + speed * 2);
        cursor.style.width = `${size}px`;
        cursor.style.height = `${size}px`;

        hue = (hue + speed * 0.3) % 360;
        cursor.style.background =
            `radial-gradient(circle,
                hsla(${hue}, 80%, 60%, 0.15) 0%,
                hsla(${(hue + 60) % 360}, 80%, 60%, 0.1) 50%,
                transparent 70%
            )`;

        lastX = currentX;
        lastY = currentY;
    };

    document.addEventListener('mousemove', (e) => {
        if (debounceTimeout) {
            cancelAnimationFrame(debounceTimeout);
        }
        debounceTimeout = requestAnimationFrame(() => updateCursor(e));
    });

    document.addEventListener('mouseleave', () => cursor.style.opacity = '0');
    document.addEventListener('mouseenter', () => cursor.style.opacity = '1');
    document.addEventListener('click', createClickEffect);
}

function createClickEffect(e) {
    const cursor = document.querySelector('.cursor-glow');
    const clickEffect = cursor.cloneNode(true);

    clickEffect.style.cssText =
        `left: ${e.clientX}px;
        top: ${e.clientY}px;
        transition: all 0.5s ease;
        opacity: 0.5;
        pointer-events: none;`;

    document.body.appendChild(clickEffect);

    requestAnimationFrame(() => {
        clickEffect.style.transform = 'translate(-50%, -50%) scale(1.5)';
        clickEffect.style.opacity = '0';
    });

    setTimeout(() => clickEffect.remove(), 500);
}

function isPinViewActive() {
    const pinViewBtn = document.querySelector('.pin-view-btn');
    return pinViewBtn ? pinViewBtn.classList.contains('active') : false;
}

function setupInfiniteScroll() {
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    const imageGrid = document.getElementById('imageGrid');
    imageGrid.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading && lastSearchQuery && !isPinViewActive()) {
                loadMoreImages();
            }
        });
    }, { rootMargin: '100px' });

    observer.observe(sentinel);

    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 1000) {
            if (!isLoading && lastSearchQuery && !isPinViewActive()) {
                loadMoreImages();
            }
        }
    });
}

async function loadMoreImages() {
    if (isLoading || isPinViewActive()) return;
    isLoading = true;
    showLoading(true);

    try {
        currentPage++;
        const response = await fetch(
            `${BASE_URL}?query=${lastSearchQuery}&page=${currentPage}&per_page=30`,
            { headers: { 'Authorization': `Client-ID ${ACCESS_KEY}` }}
        );

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        if (data.results?.length) {
            currentImages = [...currentImages, ...data.results];
            const activeFilter = document.querySelector('.filter-btn:not(.pin-view-btn).active');
            if (activeFilter?.textContent.toLowerCase() !== 'all') {
                filterImages(activeFilter.textContent.toLowerCase());
            } else {
                displayImages(data.results, true);
            }
        }
    } catch (error) {
        console.error('Error loading more images:', error);
        showError('Failed to load more images. Please try again.');
        currentPage--;
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

function setupFilterListeners() {
    const filters = document.querySelectorAll('.filter-btn');
    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            if (!filter.classList.contains('pin-view-btn')) {
                filters.forEach(f => f.classList.remove('active'));
                filter.classList.add('active');
                document.querySelector('.pin-view-btn')?.classList.remove('active');
                filterImages(filter.textContent.toLowerCase());
            }
        });
    });
}

function filterImages(filterType) {
    if (!currentImages.length) return;

    let filteredImages = [...currentImages];

    switch(filterType) {
        case 'latest':
            filteredImages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'popular':
            filteredImages.sort((a, b) => b.likes - a.likes);
            break;
        case 'featured':
            filteredImages = filteredImages.filter(img => img.featured);
            break;
    }

    displayImages(filteredImages);
}

function setupTagListeners() {
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            searchInput.value = tag.textContent;
            performSearch(tag.textContent);
        });
    });
}

function setupSearchListener() {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');

    const search = () => {
        const query = searchInput.value.trim();
        if (query) performSearch(query);
    };

    searchButton.addEventListener('click', search);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') search();
    });
}

async function performSearch(query) {
    if (query === lastSearchQuery) return;

    currentPage = 1;
    lastSearchQuery = query;
    currentImages = [];
    isLoading = true;
    showLoading(true);

    try {
        const response = await fetch(
            `${BASE_URL}?query=${query}&page=${currentPage}&per_page=30`,
            { headers: { 'Authorization': `Client-ID ${ACCESS_KEY}` }}
        );

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        currentImages = data.results;

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase() === 'all') btn.classList.add('active');
        });

        displayImages(currentImages);
    } catch (error) {
        showError('Failed to fetch images. Please try again.');
        currentImages = [];
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

function displayImages(images, append = false) {
    const imageGrid = document.getElementById('imageGrid');

    if (!append) imageGrid.innerHTML = '';

    if (images.length === 0 && !append) {
        imageGrid.innerHTML = '<div class="no-results">No images found. Try a different search.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    images.forEach(image => fragment.appendChild(createImageCard(image)));

    if (append) {
        const sentinel = imageGrid.querySelector('.scroll-sentinel');
        imageGrid.insertBefore(fragment, sentinel);
    } else {
        imageGrid.appendChild(fragment);
        const sentinel = document.createElement('div');
        sentinel.className = 'scroll-sentinel';
        imageGrid.appendChild(sentinel);
    }

    setupImageZoom(); // Call here to ensure zooming works for new images
}


function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';

    card.innerHTML =
        `<img src="${image.urls.regular}" alt="${image.alt_description || 'Unsplash image'}" 
             loading="lazy" />
        <div class="image-info">
            <p class="photographer">By ${image.user.name}</p>
            <div class="image-stats">
                <span><i class="fas fa-heart"></i> ${image.likes}</span>
                <span><i class="fas fa-calendar"></i> ${new Date(image.created_at).toLocaleDateString()}</span>
            </div>
            <a href="${image.links.html}" target="_blank" class="view-link">View on Unsplash</a>
        </div>`;

    const img = card.querySelector('img');
    card.addEventListener('mouseenter', () => img.style.transform = 'scale(1.1)');
    card.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');

    return card;
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const error = document.getElementById('error');
    if (error) {
        error.textContent = message;
        error.style.display = 'block';
        setTimeout(() => error.style.display = 'none', 3000);
    }
}

function loadPinnedImages() {
    const saved = localStorage.getItem('pinnedImages');
    if (saved) {
        pinnedImages = new Set(JSON.parse(saved));
    }
}

function savePinnedImages() {
    localStorage.setItem('pinnedImages', JSON.stringify([...pinnedImages]));
}

function setupPinView() {
    const pinViewBtn = document.createElement('button');
    pinViewBtn.className = 'pin-view-btn filter-btn';
    pinViewBtn.innerHTML = '<i class="fas fa-thumbtack"></i> Pins';
    document.querySelector('.filters').appendChild(pinViewBtn);

    pinViewBtn.addEventListener('click', () => {
        pinViewBtn.classList.toggle('active');
        if (pinViewBtn.classList.contains('active')) {
            displayPinnedImages();
        } else {
            displayImages(currentImages);
        }
    });
}

function displayPinnedImages() {
    const imageGrid = document.getElementById('imageGrid');
    imageGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    currentImages.forEach(image => {
        if (pinnedImages.has(image.id)) {
            fragment.appendChild(createImageCard(image));
        }
    });

    imageGrid.appendChild(fragment);
}
function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    const isPinned = pinnedImages.has(image.id);

    card.innerHTML =
        `<div class="image-actions">
            <button class="pin-btn ${isPinned ? 'pinned' : ''}" data-id="${image.id}">
                <i class="fas ${isPinned ? 'fa-thumbtack' : 'fa-thumbtack'}"></i>
            </button>
        </div>
        <img src="${image.urls.regular}" alt="${image.alt_description || 'Unsplash image'}" 
             loading="lazy" />
        <div class="image-info">
            <p class="photographer">By ${image.user.name}</p>
            <div class="image-stats">
                <span><i class="fas fa-heart"></i> ${image.likes}</span>
                <span><i class="fas fa-calendar"></i> ${new Date(image.created_at).toLocaleDateString()}</span>
            </div>
            <a href="${image.links.html}" target="_blank" class="view-link">View on Unsplash</a>
        </div>`;

    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        togglePin(image.id, pinBtn);
    });

    const img = card.querySelector('img');
    card.addEventListener('mouseenter', () => img.style.transform = 'scale(1.1)');
    card.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');

    return card;
}

function togglePin(imageId, button) {
    if (pinnedImages.has(imageId)) {
        pinnedImages.delete(imageId);
        button.classList.remove('pinned');
        showNotification('Image unpinned');
    } else {
        pinnedImages.add(imageId);
        button.classList.add('pinned');
        showNotification('Image pinned!');
    }

    button.classList.add('animate');
    setTimeout(() => button.classList.remove('animate'), 300);
    savePinnedImages();

    const pinViewBtn = document.querySelector('.pin-view-btn');
    if (pinViewBtn.classList.contains('active')) {
        displayPinnedImages();
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }, 100);
}

const styles = `
.image-actions {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.image-card:hover .image-actions {
    opacity: 1;
}

.pin-btn {
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
}

.pin-btn:hover {
    transform: translateY(-2px);
    background: white;
}

.pin-btn.pinned {
    background: var(--primary-color);
    color: white;
}

.pin-btn.animate {
    animation: pinPop 0.3s ease;
}

@keyframes pinPop {
    0% { transform: scale(1) }
    50% { transform: scale(1.2) }
    100% { transform: scale(1) }
}

.notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    transition: transform 0.3s ease;
    z-index: 1000;
}

.notification.show {
    transform: translateX(-50%) translateY(0);
}

.pin-view-btn i {
    margin-right: 6px;
}`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
