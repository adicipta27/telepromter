// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyA3Moun-wccgJsCEUmpua4RPKtp44SDvuI",
    authDomain: "telesync-pro.firebaseapp.com",
    projectId: "telesync-pro",
    storageBucket: "telesync-pro.firebasestorage.app",
    messagingSenderId: "122378796127",
    appId: "1:122378796127:web:3c3e4ec9139452f977afea"
};

let db = null;
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
}

let loadedScriptsCache = [];
let activeFilterCategory = 'all';

// ==========================================
// 2. GLOBAL APP STATE & VARIABLES
// ==========================================

let isScrolling = false;
let scrollSpeed = 3;
let fontSize = 48;
let mirrorH = false;
let mirrorV = false;
let guideLineVisible = false;
let animationFrameId = null;

// PeerJS Remote Sync State
let peer = null;
let conn = null;
let isRemoteUpdate = false;

// ==========================================
// 3. INITIALIZATION ON DOM READY
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Set tampilan awal dari textarea
    const textarea = document.getElementById('scriptTextarea');
    if (textarea) {
        onScriptInputChange(textarea.value);
    }
    
    // Inisialisasi PeerJS untuk koneksi remote
    initPeerJS();
});

// ==========================================
// 4. TELEPROMPTER CORE ENGINE (SCROLLING & UI)
// ==========================================

function togglePlayPause(fromRemote = false) {
    isScrolling = !isScrolling;
    updatePlayPauseUI();

    if (isScrolling) {
        startScrollingLoop();
    } else {
        stopScrollingLoop();
    }

    if (!fromRemote) {
        broadcastData({ type: 'TOGGLE_PLAY', isScrolling });
    }
}

function updatePlayPauseUI() {
    const btn = document.getElementById('btnPlayPause');
    const icon = document.getElementById('iconPlayPause');
    const label = document.getElementById('labelPlayPause');

    if (isScrolling) {
        if (btn) btn.className = "px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-amber-600/20";
        if (icon) icon.className = "fa-solid fa-pause";
        if (label) label.innerText = "PAUSE";
    } else {
        if (btn) btn.className = "px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-600/20";
        if (icon) icon.className = "fa-solid fa-play";
        if (label) label.innerText = "MULAI";
    }
}

function startScrollingLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    function step() {
        if (!isScrolling) return;

        const viewport = document.getElementById('prompterViewport');
        if (viewport) {
            viewport.scrollTop += (scrollSpeed * 0.4);
            
            // Mengirim posisi scroll ke device remote
            broadcastData({ type: 'SCROLL_POS', scrollTop: viewport.scrollTop });
        }
        animationFrameId = requestAnimationFrame(step);
    }

    animationFrameId = requestAnimationFrame(step);
}

function stopScrollingLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function resetScroll(fromRemote = false) {
    const viewport = document.getElementById('prompterViewport');
    if (viewport) {
        viewport.scrollTop = 0;
    }
    if (!fromRemote) {
        broadcastData({ type: 'RESET_SCROLL' });
    }
}

function updateSpeed(val, fromRemote = false) {
    scrollSpeed = parseFloat(val);
    const speedValEl = document.getElementById('speedVal');
    const slider = document.getElementById('speedSlider');
    
    if (speedValEl) speedValEl.innerText = scrollSpeed;
    if (slider) slider.value = scrollSpeed;

    if (!fromRemote) {
        broadcastData({ type: 'SET_SPEED', val: scrollSpeed });
    }
}

function updateFontSize(val, fromRemote = false) {
    fontSize = parseInt(val);
    const fontSizeValEl = document.getElementById('fontSizeVal');
    const slider = document.getElementById('fontSizeSlider');
    const display = document.getElementById('prompterTextDisplay');

    if (fontSizeValEl) fontSizeValEl.innerText = `${fontSize}px`;
    if (slider) slider.value = fontSize;
    if (display) display.style.fontSize = `${fontSize}px`;

    if (!fromRemote) {
        broadcastData({ type: 'SET_FONT_SIZE', val: fontSize });
    }
}

function toggleMirror(type) {
    const display = document.getElementById('prompterTextDisplay');
    const btnH = document.getElementById('btnMirrorH');
    const btnV = document.getElementById('btnMirrorV');

    if (type === 'h') mirrorH = !mirrorH;
    if (type === 'v') mirrorV = !mirrorV;

    if (display) {
        let transformStr = '';
        if (mirrorH && mirrorV) transformStr = 'scale(-1, -1)';
        else if (mirrorH) transformStr = 'scaleX(-1)';
        else if (mirrorV) transformStr = 'scaleY(-1)';
        else transformStr = 'none';

        display.style.transform = transformStr;
    }

    if (btnH) {
        btnH.className = mirrorH 
            ? "p-2 bg-sky-600 text-white rounded-xl transition border border-sky-500" 
            : "p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700";
    }
    if (btnV) {
        btnV.className = mirrorV 
            ? "p-2 bg-sky-600 text-white rounded-xl transition border border-sky-500" 
            : "p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700";
    }
}

function toggleGuideLine() {
    guideLineVisible = !guideLineVisible;
    const line = document.getElementById('readingGuideLine');
    const btn = document.getElementById('btnGuideLine');

    if (line) {
        if (guideLineVisible) {
            line.classList.remove('hidden');
            line.className = "absolute left-0 right-0 top-1/2 -translate-y-1/2 h-12 bg-sky-500/10 border-y-2 border-sky-500/40 pointer-events-none z-10";
        } else {
            line.classList.add('hidden');
        }
    }

    if (btn) {
        btn.className = guideLineVisible 
            ? "p-2 bg-sky-600 text-white rounded-xl transition border border-sky-500" 
            : "p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700";
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showToast("Tidak dapat mengaktifkan layar penuh", "info");
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function onScriptInputChange(text, fromRemote = false) {
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    const displayEl = document.getElementById('prompterTextDisplay');

    const words = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = text ? text.length : 0;

    if (wordCountEl) wordCountEl.innerHTML = `<i class="fa-solid fa-file-word mr-1"></i>${words} kata`;
    if (charCountEl) charCountEl.innerText = `${chars} karakter`;

    if (displayEl) {
        displayEl.innerHTML = parseVisualCues(text || "Ketik naskah di sini...");
    }

    if (!fromRemote) {
        broadcastData({ type: 'UPDATE_TEXT', text });
    }
}

function clearEditor() {
    if (confirm("Apakah Anda yakin ingin mengosongkan editor naskah?")) {
        const textarea = document.getElementById('scriptTextarea');
        if (textarea) {
            textarea.value = '';
            onScriptInputChange('');
        }
    }
}

// Visual Cues Parser: [teks dalam kurung] -> warna abu-abu / instruksi
function parseVisualCues(text) {
    if (!text) return '';
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Format [teks dalam kurung]
    return escaped.replace(/\[(.*?)\]/g, '<span class="cue-tag">[$1]</span>');
}

// ==========================================
// 5. WEBRTC REMOTE CONTROL (PEERJS) ENGINE
// ==========================================

function initPeerJS() {
    // Inisialisasi PeerJS dengan ID acak
    const randomId = 'telesync-' + Math.floor(1000 + Math.random() * 9000);
    peer = new Peer(randomId);

    peer.on('open', (id) => {
        const myIdInput = document.getElementById('myPeerId');
        if (myIdInput) myIdInput.value = id;
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnectionListeners();
        updateSyncStatusBadge(true, conn.peer);
        showToast("Terhubung dengan device remote!", "success");
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        showToast("Gagal menghubungkan remote WebRTC", "error");
    });
}

function connectToPeer() {
    const targetIdInput = document.getElementById('targetPeerId');
    if (!targetIdInput || !targetIdInput.value.trim()) {
        showToast("Masukkan ID Room tujuan terlebih dahulu!", "info");
        return;
    }

    const targetId = targetIdInput.value.trim();
    conn = peer.connect(targetId);
    setupConnectionListeners();

    conn.on('open', () => {
        updateSyncStatusBadge(true, targetId);
        closeRoomModal();
        showToast("Tersambung ke " + targetId, "success");
    });
}

function setupConnectionListeners() {
    if (!conn) return;

    conn.on('data', (data) => {
        handleRemoteData(data);
    });

    conn.on('close', () => {
        updateSyncStatusBadge(false);
        showToast("Koneksi remote terputus", "info");
    });
}

function handleRemoteData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
        case 'TOGGLE_PLAY':
            if (isScrolling !== data.isScrolling) {
                togglePlayPause(true);
            }
            break;
        case 'SET_SPEED':
            updateSpeed(data.val, true);
            break;
        case 'SET_FONT_SIZE':
            updateFontSize(data.val, true);
            break;
        case 'UPDATE_TEXT':
            const textarea = document.getElementById('scriptTextarea');
            if (textarea) {
                textarea.value = data.text;
                onScriptInputChange(data.text, true);
            }
            break;
        case 'SCROLL_POS':
            const viewport = document.getElementById('prompterViewport');
            if (viewport && !isScrolling) {
                viewport.scrollTop = data.scrollTop;
            }
            break;
        case 'RESET_SCROLL':
            resetScroll(true);
            break;
    }
}

function broadcastData(payload) {
    if (conn && conn.open) {
        conn.send(payload);
    }
}

function updateSyncStatusBadge(isConnected, peerName = '') {
    const badge = document.getElementById('syncStatusBadge');
    if (!badge) return;

    if (isConnected) {
        badge.className = "px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 flex items-center gap-1";
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Connected: ${peerName}`;
    } else {
        badge.className = "px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold border border-slate-700 flex items-center gap-1";
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Offline`;
    }
}

function openRoomModal() {
    const modal = document.getElementById('roomModal');
    if (modal) modal.classList.remove('hidden');
}

function closeRoomModal() {
    const modal = document.getElementById('roomModal');
    if (modal) modal.classList.add('hidden');
}

function copyPeerId() {
    const myIdInput = document.getElementById('myPeerId');
    if (myIdInput && myIdInput.value) {
        navigator.clipboard.writeText(myIdInput.value);
        showToast("ID Room berhasil disalin!", "success");
    }
}

// ==========================================
// 6. FIREBASE FIRESTORE SCRIPT MANAGEMENT
// ==========================================

function openFirebaseModal() {
    const modal = document.getElementById('firebaseModal');
    if (modal) {
        modal.classList.remove('hidden');
        fetchFirebaseScripts();
    }
}

function closeFirebaseModal() {
    const modal = document.getElementById('firebaseModal');
    if (modal) modal.classList.add('hidden');
    closeScriptEditorForm();
}

async function fetchFirebaseScripts() {
    const listContainer = document.getElementById('firebaseScriptList');
    if (!db) {
        if (listContainer) {
            listContainer.innerHTML = `<div class="col-span-full py-8 text-center text-amber-400 text-xs">Koneksi Firebase Firestore belum siap.</div>`;
        }
        return;
    }

    try {
        const snapshot = await db.collection('telesync_scripts').orderBy('updatedAt', 'desc').get();
        loadedScriptsCache = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderFirebaseScriptList();
    } catch (err) {
        console.error("Gagal mengambil data naskah:", err);
        if (listContainer) {
            listContainer.innerHTML = `<div class="col-span-full py-8 text-center text-rose-400 text-xs">Gagal memuat naskah: ${err.message}</div>`;
        }
    }
}

function filterFirebaseCategory(cat) {
    activeFilterCategory = cat;
    ['all', 'draft', 'ready', 'completed'].forEach(c => {
        const btn = document.getElementById(`filterBtn${c.charAt(0).toUpperCase() + c.slice(1)}`);
        if (btn) {
            btn.className = (c === cat)
                ? "px-3 py-1.5 rounded-lg font-semibold bg-sky-600 text-white"
                : "px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white";
        }
    });
    renderFirebaseScriptList();
}

function renderFirebaseScriptList() {
    const listContainer = document.getElementById('firebaseScriptList');
    if (!listContainer) return;

    let filtered = loadedScriptsCache;
    if (activeFilterCategory !== 'all') {
        filtered = loadedScriptsCache.filter(s => s.status === activeFilterCategory);
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-xs">Tidak ada naskah ditemukan pada kategori ini.</div>`;
        return;
    }

    listContainer.innerHTML = filtered.map(item => {
        let statusBadge = '';
        if (item.status === 'draft') {
            statusBadge = `<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold border border-slate-700">DRAF</span>`;
        } else if (item.status === 'ready') {
            statusBadge = `<span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20">SIAP SYUTING</span>`;
        } else if (item.status === 'completed') {
            statusBadge = `<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20"><i class="fa-solid fa-check mr-1"></i>SELESAI</span>`;
        }

        const words = item.content ? item.content.trim().split(/\s+/).filter(Boolean).length : 0;
        const dateStr = item.updatedAt && item.updatedAt.seconds 
            ? new Date(item.updatedAt.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) 
            : 'Baru saja';

        return `
        <div class="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between transition">
            <div>
                <div class="flex items-start justify-between gap-2 mb-1.5">
                    <h5 class="font-bold text-slate-200 text-xs line-clamp-1">${item.title || 'Tanpa Judul'}</h5>
                    ${statusBadge}
                </div>
                <p class="text-slate-400 text-[11px] line-clamp-2 mb-3 font-mono leading-relaxed">${item.content || ''}</p>
            </div>
            
            <div class="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                <div class="flex items-center gap-2">
                    <span><i class="fa-solid fa-file-word mr-1"></i>${words} kata</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-calendar mr-1"></i>${dateStr}</span>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="loadScriptToTeleprompter('${item.id}')" title="Buka di Prompter" class="p-1.5 bg-sky-600/20 text-sky-400 hover:bg-sky-600 hover:text-white rounded-lg transition">
                        <i class="fa-solid fa-play"></i> Buka
                    </button>
                    <button onclick="toggleScriptStatus('${item.id}')" title="Ubah Status Syuting" class="p-1.5 bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button onclick="editFirebaseScript('${item.id}')" title="Edit Naskah" class="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteFirebaseScript('${item.id}')" title="Hapus Naskah" class="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function openScriptEditorForm(data = null) {
    const formArea = document.getElementById('firebaseFormArea');
    const formTitle = document.getElementById('formAreaTitle');
    
    document.getElementById('fbScriptId').value = data ? data.id : '';
    document.getElementById('fbScriptTitle').value = data ? data.title : '';
    document.getElementById('fbScriptStatus').value = data ? data.status : 'draft';
    document.getElementById('fbScriptCategory').value = data ? (data.category || '') : '';
    document.getElementById('fbScriptContent').value = data ? data.content : '';

    if (formTitle) formTitle.innerText = data ? 'Edit Naskah Cloud' : 'Tambah Naskah Baru';
    if (formArea) formArea.classList.remove('hidden');
}

function closeScriptEditorForm() {
    const formArea = document.getElementById('firebaseFormArea');
    if (formArea) formArea.classList.add('hidden');
}

async function saveFirebaseScript() {
    const id = document.getElementById('fbScriptId').value;
    const title = document.getElementById('fbScriptTitle').value.trim();
    const status = document.getElementById('fbScriptStatus').value;
    const category = document.getElementById('fbScriptCategory').value.trim();
    const content = document.getElementById('fbScriptContent').value;

    if (!title) {
        showToast("Judul naskah wajib diisi!", "info");
        return;
    }

    const payload = {
        title,
        status,
        category,
        content,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) {
            await db.collection('telesync_scripts').doc(id).update(payload);
            showToast("Naskah berhasil diperbarui!", "success");
        } else {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('telesync_scripts').add(payload);
            showToast("Naskah baru disimpan di Cloud!", "success");
        }
        closeScriptEditorForm();
        fetchFirebaseScripts();
    } catch (err) {
        console.error("Gagal menyimpan ke Firebase:", err);
        showToast("Gagal menyimpan naskah!", "error");
    }
}

function editFirebaseScript(id) {
    const target = loadedScriptsCache.find(s => s.id === id);
    if (target) {
        openScriptEditorForm(target);
    }
}

function loadScriptToTeleprompter(id) {
    const target = loadedScriptsCache.find(s => s.id === id);
    if (target) {
        const textarea = document.getElementById('scriptTextarea');
        if (textarea) {
            textarea.value = target.content;
            onScriptInputChange(target.content);
        }
        closeFirebaseModal();
        showToast(`Naskah "${target.title}" dimuat ke prompter!`, "success");
    }
}

async function toggleScriptStatus(id) {
    const target = loadedScriptsCache.find(s => s.id === id);
    if (!target) return;

    const statusCycle = { 'draft': 'ready', 'ready': 'completed', 'completed': 'draft' };
    const newStatus = statusCycle[target.status] || 'draft';

    try {
        await db.collection('telesync_scripts').doc(id).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast(`Status naskah diubah!`, "info");
        fetchFirebaseScripts();
    } catch (err) {
        showToast("Gagal memperbarui status", "error");
    }
}

async function deleteFirebaseScript(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus naskah ini dari cloud?")) return;

    try {
        await db.collection('telesync_scripts').doc(id).delete();
        showToast("Naskah telah dihapus dari cloud", "info");
        fetchFirebaseScripts();
    } catch (err) {
        showToast("Gagal menghapus naskah", "error");
    }
}

// ==========================================
// 7. TOAST NOTIFICATION SYSTEM
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-sky-600';

    toast.className = `${bgClass} text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl transition-all duration-300 opacity-0 transform translate-y-2 pointer-events-auto flex items-center gap-2`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
