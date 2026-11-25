const links = document.querySelectorAll('nav a');
const sections = document.querySelectorAll('section');

function showPage() {
    let target = document.getElementById(location.hash.slice(1));

    // kalau alamatnya kosong atau tidak dikenal, tampilkan home
    if (!target || target.tagName !== 'SECTION') {
        target = document.getElementById('home');
    }

    sections.forEach(s => s.classList.toggle('show', s === target));
    links.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + target.id);
    });

    window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showPage);
showPage();

// ===== Background interaktif 3D =====
const bgCanvas = document.getElementById('bg');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 400;

const renderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// titik-titik bintang tersebar dalam ruang 3D berbentuk bola
const STAR_COUNT = 1200;
const positions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
    const radius = 300 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
}

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

function createStarTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(183,75,75,0.9)');
    gradient.addColorStop(1, 'rgba(183,75,75,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

const starMaterial = new THREE.PointsMaterial({
    map: createStarTexture(),
    size: 4,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// kamera: drag untuk memutar. Zoom & geser dimatikan supaya scroll halaman tetap normal
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

// di layar sentuh, matikan drag manual (supaya scroll HP tidak ikut memutar kamera)
// auto-rotate tetap jalan, drag hanya aktif di perangkat dengan mouse
controls.enabled = matchMedia('(hover: hover)').matches;

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate3D() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate3D);
}
animate3D();

// ===== Sembunyikan UI, tampilkan hanya background 3D =====
const sceneToggle = document.getElementById('scene-toggle');
const sceneIcon = document.getElementById('scene-icon');

function setSceneOnly(on) {
    document.body.classList.toggle('scene-only', on);
    sceneIcon.className = on ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

if (sceneToggle) {
    sceneToggle.addEventListener('click', () => {
        setSceneOnly(!document.body.classList.contains('scene-only'));
    });
}

window.addEventListener('keydown', e => {
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (e.key.toLowerCase() === 'h' && !typing) {
        setSceneOnly(!document.body.classList.contains('scene-only'));
    }
});

// ===== Shelf & iTunes Audio Player =====
const SHELF_ITEMS = [
    { kind: 'film', title: 'Lord of the Mysteries', by: 'Cuttlefish That Loves Diving',
      poster: 'public/shelf/lotm.webp',   link: 'https://www.imdb.com/title/tt28618556/' },
    { kind: 'song', title: 'Please Dont Call',   by: 'Bleachers' },
    { kind: 'song', title: '505',                 by: 'Arctic Monkeys' },
    { kind: 'film', title: 'Inception', by: 'Christopher Nolan',
        poster: 'public/shelf/inception.jpg', link: 'https://www.imdb.com/title/tt1375666/' },
    { kind: 'song', title: 'Line Without a Hook', by: 'Ricky Montgomery' },
    { kind: 'film', title: 'Kimi No Nawa', by: 'Makoto Shinkai',
      poster: 'public/shelf/kiminonawa.webp',   link: 'https://www.imdb.com/title/tt5311514/' },
    { kind: 'song', title: 'Freaks',              by: 'Surf Curse' },
    { kind: 'film', title: 'The Odyssey', by: 'Christopher Nolan',
      poster: 'public/shelf/odyssey.webp', link: 'https://www.imdb.com/title/tt33764258/' },
    { kind: 'film', title: 'Tenet', by: 'Christopher Nolan',
      poster: 'public/shelf/tenet.webp',   link: 'https://www.imdb.com/title/tt6723592/' },
];

const audioPlayer = new Audio();
audioPlayer.volume = 0.45;
audioPlayer.loop = true;

const previewCache = {};
let currentTrackTitle = '';
let latestRequestId = 0;
let isAutoplayUnlocked = false;

// Ambil preview iTunes via JSONP (aman dari blokir CORS Zen Browser)
function getItunesPreview(title, artist) {
    const key = `${title}-${artist}`;
    if (previewCache[key]) return Promise.resolve(previewCache[key]);

    return new Promise((resolve) => {
        const callbackName = 'itunesCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        const script = document.createElement('script');
        const query = encodeURIComponent(`${title} ${artist}`);

        const cleanup = () => {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };

        const timer = setTimeout(() => {
            cleanup();
            resolve(null);
        }, 8000);

        window[callbackName] = (data) => {
            clearTimeout(timer);
            cleanup();
            if (data && data.results && data.results.length > 0) {
                const track = data.results.find(r => r.previewUrl);
                if (track) {
                    previewCache[key] = track.previewUrl;
                    resolve(track.previewUrl);
                    return;
                }
            }
            resolve(null);
        };

        script.onerror = () => {
            clearTimeout(timer);
            cleanup();
            resolve(null);
        };

        script.src = `https://itunes.apple.com/search?term=${query}&entity=song&limit=3&callback=${callbackName}`;
        document.body.appendChild(script);
    });
}

function getItunesArtwork(title, artist) {
    return new Promise((resolve) => {
        const callbackName = 'itunesArt_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        const script = document.createElement('script');
        const query = encodeURIComponent(`${title} ${artist}`);

        const cleanup = () => {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };

        window[callbackName] = (data) => {
            cleanup();
            const track = data && data.results && data.results.find(r => r.artworkUrl100);
            resolve(track ? track.artworkUrl100.replace('100x100bb', '400x400bb') : null);
        };

        script.onerror = () => { cleanup(); resolve(null); };
        script.src = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1&callback=${callbackName}`;
        document.body.appendChild(script);
    });
}

function updatePlayerUI(isPlaying, label = '') {
    const musicToggle = document.getElementById('music-toggle');
    const musicIcon = document.getElementById('music-icon');
    const musicStatus = document.getElementById('music-status');
    if (!musicToggle) return;

    if (isPlaying) {
        musicToggle.classList.add('playing');
        musicIcon.className = 'fa-solid fa-volume-high';
        musicStatus.textContent = label || currentTrackTitle || 'Playing';
    } else {
        musicToggle.classList.remove('playing');
        musicIcon.className = 'fa-solid fa-volume-xmark';
        musicStatus.textContent = label || 'Music Paused';
        document.querySelectorAll('.piece.playing').forEach(d => d.classList.remove('playing'));
    }
}

async function playTrack(item, drawerEl = null) {
    const requestId = ++latestRequestId;
    const musicStatus = document.getElementById('music-status');
    if (musicStatus) musicStatus.textContent = 'Loading...';

    const previewUrl = await getItunesPreview(item.title, item.by);
    if (requestId !== latestRequestId) return;

    if (!previewUrl) {
        console.warn('Lagu tidak ditemukan di iTunes:', item.title);
        updatePlayerUI(false, 'Track Not Found');
        return;
    }

    try {
        if (audioPlayer.src !== previewUrl) {
            audioPlayer.src = previewUrl;
        }
        currentTrackTitle = `${item.title} — ${item.by}`;
        await audioPlayer.play();
        isAutoplayUnlocked = true;

        if (drawerEl) drawerEl.classList.add('playing');

        updatePlayerUI(true, currentTrackTitle);
    } catch (err) {
        console.warn('Autoplay ditahan browser sampai user klik:', err);
        updatePlayerUI(false, 'Click to Play Music');
    }
}

function pauseTrack() {
    latestRequestId++;
    audioPlayer.pause();
    updatePlayerUI(false, 'Music Paused');
}

function buildShelf() {
    const cabinet = document.getElementById('cabinet');
    if (!cabinet) return;

    SHELF_ITEMS.forEach(item => {
        const isSong = item.kind === 'song';
        const icon = isSong ? 'fa-music' : 'fa-film';

        const piece = document.createElement(isSong ? 'div' : 'a');
        piece.className = `piece ${isSong ? 'square' : 'tall'} nocover`;

        if (isSong) {
            piece.tabIndex = 0;
            piece.setAttribute('role', 'button');
            piece.addEventListener('click', () => toggleSong(piece, item));
            piece.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSong(piece, item);
                }
            });
        } else {
            piece.href = item.link || '#';
            piece.target = '_blank';
            piece.rel = 'noopener';
        }

        piece.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <div class="eqbars"><i></i><i></i><i></i></div>
            <div class="piece-info">
                <h3>${item.title}</h3>
                <p>${item.by}</p>
            </div>
        `;

        if (isSong) {
            getItunesArtwork(item.title, item.by).then(url => {
                if (url) setCoverSafe(piece, url);
            });
        } else if (item.poster) {
            setCoverSafe(piece, item.poster);
        }

        cabinet.appendChild(piece);
    });
}

function setCoverSafe(piece, url) {
    const img = new Image();
    img.onload = () => {
        piece.classList.remove('nocover');
        piece.style.backgroundImage = `url('${url}')`;
        piece.style.backgroundSize = 'cover';
        piece.style.backgroundPosition = 'center';
    };
    img.src = url; // kalau gagal dimuat, piece tetap nocover
}

function toggleSong(piece, item) {
    if (piece.classList.contains('playing')) {
        pauseTrack();
    } else {
        playTrack(item, piece);
    }
}

function initMusicPlayer() {
    buildShelf();

    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) {
        musicToggle.addEventListener('click', e => {
            e.stopPropagation();
            if (!audioPlayer.paused) {
                pauseTrack();
            } else if (audioPlayer.src) {
                audioPlayer.play().then(() => {
                    isAutoplayUnlocked = true;
                    updatePlayerUI(true, currentTrackTitle);
                });
            } else {
                const defaultSong = SHELF_ITEMS.find(i => i.kind === 'song');
                if (defaultSong) playTrack(defaultSong);
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusicPlayer);
} else {
    initMusicPlayer();
}