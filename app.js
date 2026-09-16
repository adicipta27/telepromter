const presetScripts = {
    speech: `PIDATO SAMBUTAN RESMI
Assalamu'alaikum Warahmatullahi Wabarakatuh,
Selamat pagi dan salam sejahtera untuk kita semua.

Yang saya hormati jajaran direksi serta seluruh tim yang hadir pada pagi hari ini.
Marilah kita panjatkan puji dan syukur karena dapat berkumpul dalam acara ini.

Mari kita terus melangkah maju dengan semangat inovasi dan kolaborasi untuk mencapai target yang lebih besar!`,

    tech: `REVIEW GADGET & TEKNOLOGI
Halo semuanya, kembali lagi di channel kami!

Hari ini kita kedatangan smartphone flagship terbaru yang punya kamera super jernih.

Layarnya mengusung AMOLED 120Hz yang sangat responsif, cocok untuk bernavigasi harian maupun bermain game berat.`
};

// App State with Dual Targets for Smooth Lerp Motion
window.appState = {
    roomId: '',
    isController: true,
    scriptText: `Selamat datang di TeleSync PRO!

Anda sekarang bisa menekan tombol S Pen (Samsung Note 10) untuk Mulai / Jeda Auto Scroll!

Layar ini juga sudah disempurnakan agar pergerakan scroll manual dan auto scroll tetap mulus tanpa terloncat.`,
    
    // High Precision Scroll Targets (0.0 to 1.0)
    targetScrollPercent: 0,
    currentScrollPercent: 0,
    
    isPlaying: false,
    speed: 3,
    fontSize: 42,
    lineHeight: 1.6,
    textAlign: 'center',
    theme: 'theme-dark',
    mirrorH: false,
    mirrorV: false,
    focusLine: true
};

let peer = null;
let activeConnections = [];
let hostConnection = null;
let lastBroadcastTime = 0;

function generate6CharRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TS';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.substring(0, 6);
}

function formatRoomInput(input) {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

// WebRTC Sync Initialization
function initPeerCloud(roomCode) {
    if (peer) { try { peer.destroy(); } catch(e){} }
    updateConnectionBadge('amber', 'Menghubungkan Cloud...');
    const peerId = 'telesync-' + roomCode.toLowerCase();

    peer = new Peer(peerId, { debug: 1 });

    peer.on('open', (id) => {
        updateConnectionBadge('emerald', 'Cloud Terhubung (Host)');
    });

    peer.on('connection', (conn) => {
        activeConnections.push(conn);
        conn.on('open', () => {
            conn.send({ type: 'SYNC_STATE', state: window.appState });
            showToast("Perangkat HP terhubung!", "success");
            updateConnectionBadge('emerald', `Cloud (${activeConnections.length} Terhubung)`);
        });
        conn.on('data', (data) => handleIncomingData(data));
        conn.on('close', () => {
            activeConnections = activeConnections.filter(c => c !== conn);
            updateConnectionBadge('emerald', activeConnections.length > 0 ? `Cloud (${activeConnections.length} Terhubung)` : 'Cloud Terhubung');
        });
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            connectAsClient(peerId);
        } else {
            updateConnectionBadge('amber', 'Cloud Active');
        }
    });
}

function connectAsClient(hostPeerId) {
    if (peer) { try { peer.destroy(); } catch(e){} }
    peer = new Peer();
    peer.on('open', () => {
        hostConnection = peer.connect(hostPeerId);
        hostConnection.on('open', () => {
            updateConnectionBadge('emerald', 'Terhubung ke PC');
            showToast("Terhubung ke PC Utama!", "success");
        });
        hostConnection.on('data', (data) => handleIncomingData(data));
        hostConnection.on('close', () => updateConnectionBadge('amber', 'Terputus dari PC'));
    });
}

// Send network state throttled (Max 20 times per second)
function broadcastStateChange(force = false) {
    const now = Date.now();
    if (!force && (now - lastBroadcastTime < 50)) return;
    lastBroadcastTime = now;

    const payload = { type: 'SYNC_STATE', state: window.appState };

    activeConnections.forEach(conn => {
        if (conn.open) conn.send(payload);
    });
    if (hostConnection && hostConnection.open) {
        hostConnection.send(payload);
    }
}

function handleIncomingData(data) {
    if (data && data.type === 'SYNC_STATE' && data.state) {
        const incoming = data.state;
        
        window.appState.scriptText = incoming.scriptText;
        window.appState.targetScrollPercent = incoming.targetScrollPercent;
        window.appState.isPlaying = incoming.isPlaying;
        window.appState.speed = incoming.speed;
        window.appState.fontSize = incoming.fontSize;
        window.appState.lineHeight = incoming.lineHeight;
        window.appState.textAlign = incoming.textAlign;
        window.appState.theme = incoming.theme;
        window.appState.mirrorH = incoming.mirrorH;
        window.appState.mirrorV = incoming.mirrorV;
        window.appState.focusLine = incoming.focusLine;

        document.getElementById('scriptTextarea').value = incoming.scriptText;
        document.getElementById('inputSpeed').value = incoming.speed;
        document.getElementById('speedValueDisplay').innerText = incoming.speed + ' px/s';
        document.getElementById('previewSpeedDisplay').innerText = incoming.speed + ' px';
        document.getElementById('inputFontSize').value = incoming.fontSize;
        document.getElementById('fontSizeDisplay').innerText = incoming.fontSize + 'px';
        document.getElementById('inputLineHeight').value = incoming.lineHeight;
        document.getElementById('lineHeightDisplay').innerText = incoming.lineHeight;
        document.getElementById('selectTheme').value = incoming.theme;
        document.getElementById('toggleFocusLine').checked = incoming.focusLine;

        updateTextDisplays();
        applyFontSizeStyles();
        applyLineHeightStyles();
        applyTextAlignStyles();
        applyThemeStyles();
        applyMirrorStyles();
        applyFocusLineStyles();
        updatePlayIcons();
    }
}

// BUTTERY SMOOTH ANIMATION ENGINE (Lerp)
function startAnimationLoop() {
    function renderLoop() {
        const pcContainer = document.getElementById('promptContainer');
        const mobileContainer = document.getElementById('mobilePromptContainer');

        const activeContainer = window.appState.isController ? pcContainer : mobileContainer;
        
        if (activeContainer) {
            const maxScroll = activeContainer.scrollHeight - activeContainer.clientHeight;

            if (maxScroll > 0) {
                // 1. Auto-scroll step if playing
                if (window.appState.isPlaying) {
                    const speedDelta = (window.appState.speed * 0.4) / maxScroll;
                    window.appState.targetScrollPercent = Math.min(1.0, window.appState.targetScrollPercent + speedDelta);
                    
                    if (window.appState.targetScrollPercent >= 1.0) {
                        window.appState.isPlaying = false;
                        updatePlayIcons();
                    }
                    broadcastStateChange();
                }

                // 2. Linear Interpolation (Lerp)
                const lerpFactor = 0.2;
                const diff = window.appState.targetScrollPercent - window.appState.currentScrollPercent;
                
                if (Math.abs(diff) > 0.00001) {
                    window.appState.currentScrollPercent += diff * lerpFactor;
                } else {
                    window.appState.currentScrollPercent = window.appState.targetScrollPercent;
                }

                // 3. Apply position
                const targetPixels = window.appState.currentScrollPercent * maxScroll;
                
                if (pcContainer) pcContainer.scrollTop = targetPixels;
                if (mobileContainer) mobileContainer.scrollTop = targetPixels;

                // 4. Update UI Indicators
                const displayPercent = Math.round(window.appState.currentScrollPercent * 100);
                document.getElementById('scrollProgressPercent').innerText = displayPercent + '%';
                document.getElementById('inputScrollProgress').value = Math.round(window.appState.currentScrollPercent * 1000);
            }
        }

        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
}

// Manual Scroll Handlers
function setupManualScrollHandlers() {
    const pcContainer = document.getElementById('promptContainer');
    const mobileContainer = document.getElementById('mobilePromptContainer');

    function handleWheel(e) {
        e.preventDefault();
        const container = e.currentTarget;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 0) return;

        const scrollDelta = (e.deltaY * 0.8) / maxScroll;
        window.appState.targetScrollPercent = Math.max(0, Math.min(1, window.appState.targetScrollPercent + scrollDelta));
        broadcastStateChange();
    }

    if (pcContainer) pcContainer.addEventListener('wheel', handleWheel, { passive: false });
    if (mobileContainer) mobileContainer.addEventListener('wheel', handleWheel, { passive: false });
}

function onManualSliderInput(val) {
    window.appState.targetScrollPercent = val / 1000;
    broadcastStateChange();
}

// Playback Control
function togglePlay() {
    window.appState.isPlaying = !window.appState.isPlaying;
    updatePlayIcons();
    broadcastStateChange(true);
}

function updatePlayIcons() {
    const isPlaying = window.appState.isPlaying;
    const mainIcon = document.getElementById('playIcon');
    const mainLabel = document.getElementById('playBtnLabel');
    const previewIcon = document.getElementById('previewPlayIcon');
    const mobileIcon = document.getElementById('mobilePlayIcon');

    if (isPlaying) {
        if (mainIcon) mainIcon.className = "fa-solid fa-pause text-lg";
        if (mainLabel) mainLabel.innerText = "JEDA (Spasi / S Pen)";
        if (previewIcon) previewIcon.className = "fa-solid fa-pause";
        if (mobileIcon) mobileIcon.className = "fa-solid fa-pause";
    } else {
        if (mainIcon) mainIcon.className = "fa-solid fa-play text-lg";
        if (mainLabel) mainLabel.innerText = "MULAI (Spasi / S Pen)";
        if (previewIcon) previewIcon.className = "fa-solid fa-play";
        if (mobileIcon) mobileIcon.className = "fa-solid fa-play";
    }
}

function resetScroll() {
    window.appState.targetScrollPercent = 0;
    window.appState.currentScrollPercent = 0;
    broadcastStateChange(true);
    showToast("Scroll di-reset ke atas", "info");
}

function startCountdownAndPlay() {
    const overlay = document.getElementById('countdownOverlay');
    const numberEl = document.getElementById('countdownNumber');
    overlay.classList.remove('hidden');

    let count = 3;
    numberEl.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            numberEl.innerText = count;
        } else if (count === 0) {
            numberEl.innerText = "GO!";
        } else {
            clearInterval(timer);
            overlay.classList.add('hidden');
            if (!window.appState.isPlaying) {
                togglePlay();
            }
        }
    }, 1000);
}

// Settings Adjustments
function updateSpeed(val) {
    window.appState.speed = parseInt(val);
    document.getElementById('speedValueDisplay').innerText = val + ' px/s';
    document.getElementById('previewSpeedDisplay').innerText = val + ' px';
    broadcastStateChange(true);
}

function changeSpeed(delta) {
    let newSpeed = Math.max(1, Math.min(15, window.appState.speed + delta));
    document.getElementById('inputSpeed').value = newSpeed;
    updateSpeed(newSpeed);
}

function updateFontSize(val) {
    window.appState.fontSize = parseInt(val);
    document.getElementById('fontSizeDisplay').innerText = val + 'px';
    applyFontSizeStyles();
    broadcastStateChange(true);
}

function applyFontSizeStyles() {
    const fontPx = window.appState.fontSize + 'px';
    document.getElementById('promptTextDisplay').style.fontSize = fontPx;
    document.getElementById('mobilePromptTextDisplay').style.fontSize = fontPx;
}

function updateLineHeight(val) {
    window.appState.lineHeight = parseFloat(val);
    document.getElementById('lineHeightDisplay').innerText = val;
    applyLineHeightStyles();
    broadcastStateChange(true);
}

function applyLineHeightStyles() {
    document.getElementById('promptTextDisplay').style.lineHeight = window.appState.lineHeight;
    document.getElementById('mobilePromptTextDisplay').style.lineHeight = window.appState.lineHeight;
}

function updateTextAlign(align) {
    window.appState.textAlign = align;
    applyTextAlignStyles();
    broadcastStateChange(true);
}

function applyTextAlignStyles() {
    const align = window.appState.textAlign;
    document.getElementById('promptTextDisplay').style.textAlign = align;
    document.getElementById('mobilePromptTextDisplay').style.textAlign = align;

    ['left', 'center', 'right'].forEach(a => {
        const btn = document.getElementById(`align${a.charAt(0).toUpperCase() + a.slice(1)}Btn`);
        if (btn) {
            btn.className = (a === align)
                ? "flex-1 py-1 rounded text-xs bg-brand-600 text-white font-bold"
                : "flex-1 py-1 rounded text-xs text-slate-400";
        }
    });
}

function updateTheme(themeName) {
    window.appState.theme = themeName;
    applyThemeStyles();
    broadcastStateChange(true);
}

function applyThemeStyles() {
    const theme = window.appState.theme;
    document.getElementById('promptContainer').className = `flex-1 overflow-y-auto relative no-scrollbar select-none ${theme}`;
    document.getElementById('mobilePromptContainer').className = `flex-1 overflow-y-auto relative no-scrollbar select-none ${theme}`;
}

function toggleMirror(type) {
    if (type === 'h') window.appState.mirrorH = !window.appState.mirrorH;
    if (type === 'v') window.appState.mirrorV = !window.appState.mirrorV;
    applyMirrorStyles();
    broadcastStateChange(true);
}

function applyMirrorStyles() {
    const h = window.appState.mirrorH;
    const v = window.appState.mirrorV;

    let transformStr = '';
    if (h && v) transformStr = 'scale(-1, -1)';
    else if (h) transformStr = 'scaleX(-1)';
    else if (v) transformStr = 'scaleY(-1)';
    else transformStr = 'none';

    document.getElementById('promptTextDisplay').style.transform = transformStr;
    document.getElementById('mobilePromptTextDisplay').style.transform = transformStr;

    const btnH = document.getElementById('btnMirrorH');
    const btnV = document.getElementById('btnMirrorV');
    if (btnH) btnH.className = h ? "py-2 px-3 bg-brand-600 text-white border border-brand-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-2" : "py-2 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2";
    if (btnV) btnV.className = v ? "py-2 px-3 bg-brand-600 text-white border border-brand-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-2" : "py-2 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2";
}

function updateFocusLineToggle(checked) {
    window.appState.focusLine = checked;
    applyFocusLineStyles();
    broadcastStateChange(true);
}

function applyFocusLineStyles() {
    const line1 = document.getElementById('focusLineOverlay');
    const line2 = document.getElementById('mobileFocusLineOverlay');
    if (window.appState.focusLine) {
        line1.classList.remove('hidden');
        line2.classList.remove('hidden');
    } else {
        line1.classList.add('hidden');
        line2.classList.add('hidden');
    }
}

// Script Editor
function onScriptInputChange(val) {
    window.appState.scriptText = val;
    updateTextDisplays();
    broadcastStateChange();
}

function updateTextDisplays() {
    const text = window.appState.scriptText || 'Teks kosong...';
    document.getElementById('promptTextDisplay').innerText = text;
    document.getElementById('mobilePromptTextDisplay').innerText = text;

    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    document.getElementById('wordCountDisplay').innerText = words;
    document.getElementById('charCountDisplay').innerText = chars;

    const minutes = Math.floor(words / 150);
    const seconds = Math.floor((words % 150) / 2.5);
    document.getElementById('estTimeDisplay').innerText = `${minutes}m ${seconds}s`;
}

function loadPresetScript(key) {
    if (!key || !presetScripts[key]) return;
    const script = presetScripts[key];
    document.getElementById('scriptTextarea').value = script;
    onScriptInputChange(script);
    showToast("Naskah contoh dimuat", "info");
}

// Navigation Mode Switch
function switchViewMode(mode) {
    const controllerView = document.getElementById('controllerView');
    const displayView = document.getElementById('displayView');
    const btnCtrl = document.getElementById('btnModeController');
    const btnDisp = document.getElementById('btnModeDisplay');

    if (mode === 'controller') {
        window.appState.isController = true;
        controllerView.classList.remove('hidden');
        displayView.classList.add('hidden');
        btnCtrl.className = "px-3 py-1.5 rounded-lg font-semibold transition bg-brand-600 text-white shadow";
        btnDisp.className = "px-3 py-1.5 rounded-lg font-semibold transition text-slate-400 hover:text-white";
    } else {
        window.appState.isController = false;
        controllerView.classList.add('hidden');
        displayView.classList.remove('hidden');
        btnDisp.className = "px-3 py-1.5 rounded-lg font-semibold transition bg-brand-600 text-white shadow";
        btnCtrl.className = "px-3 py-1.5 rounded-lg font-semibold transition text-slate-400 hover:text-white";
    }
}

// KEYBOARD & SAMSUNG S PEN CONTROLS
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Jangan jalankan jika user sedang fokus mengetik naskah
        if (['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;

        // Deteksi Tombol S Pen (Samsung Note 10 / Galaxy Tab) & Keyboard
        const isPlayToggle = [
            'Space',
            'MediaPlayPause',
            'MediaPlay',
            'MediaPause',
            'TrackNext',
            'TrackPrevious',
            'VolumeUp',
            'VolumeDown'
        ].includes(e.code) || [
            'MediaPlayPause',
            'MediaPlay',
            'MediaPause',
            'Unidentified'
        ].includes(e.key);

        if (isPlayToggle || e.keyCode === 179) {
            e.preventDefault();
            togglePlay(); // ON / OFF Auto-Scroll
        }
        else if (e.code === 'ArrowUp' || e.code === 'PageUp') { 
            e.preventDefault(); 
            changeSpeed(1); 
        }
        else if (e.code === 'ArrowDown' || e.code === 'PageDown') { 
            e.preventDefault(); 
            changeSpeed(-1); 
        }
        else if (e.code === 'KeyR') { e.preventDefault(); resetScroll(); }
        else if (e.code === 'KeyM') { e.preventDefault(); toggleMirror('h'); }
        else if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen(); }
    });
}

// Room Modals & QR Code
function openRoomModal() { document.getElementById('roomModal').classList.remove('hidden'); }
function closeRoomModal() { document.getElementById('roomModal').classList.add('hidden'); }

function createNewRoom() {
    const newCode = generate6CharRoomCode();
    window.joinRoom(newCode);
    closeRoomModal();
}

function joinRoomFromInput() {
    const input = document.getElementById('inputRoomCode').value;
    if (input) {
        window.joinRoom(input);
        closeRoomModal();
    }
}

window.joinRoom = function(roomCode) {
    if (!roomCode) return;
    roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (roomCode.length < 6) roomCode = (roomCode + 'XXXXXX').slice(0, 6);

    window.appState.roomId = roomCode;
    document.getElementById('currentRoomCodeDisplay').innerText = roomCode;
    document.getElementById('displayRoomCode').innerText = roomCode;
    document.getElementById('inputRoomCode').value = roomCode;

    generateQRCode(roomCode);
    initPeerCloud(roomCode);
    showToast(`Ruangan: ${roomCode}`, "info");
};

function generateQRCode(roomCode) {
    const qrWrapper = document.getElementById('qrCodeWrapper');
    const qrCanvas = document.getElementById('qrcodeCanvas');
    const qrText = document.getElementById('qrRoomCodeText');
    
    qrCanvas.innerHTML = '';
    qrText.innerText = roomCode;

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}&mode=display`;

    if (typeof QRCode !== 'undefined') {
        new QRCode(qrCanvas, {
            text: shareUrl,
            width: 140,
            height: 140,
            colorDark : "#0f172a",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        qrWrapper.classList.remove('hidden');
    }
}

function copyShareLink() {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${window.appState.roomId}&mode=display`;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareUrl).then(() => showToast("Tautan disalin!", "success"));
    } else {
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = shareUrl;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        showToast("Tautan disalin!", "success");
    }
}

function updateConnectionBadge(status, text) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (status === 'emerald') {
        dot.className = "w-2 h-2 rounded-full bg-emerald-400";
        txt.innerText = text;
        txt.className = "text-emerald-300 font-semibold";
    } else {
        dot.className = "w-2 h-2 rounded-full bg-amber-400 animate-pulse";
        txt.innerText = text;
        txt.className = "text-amber-300 font-semibold";
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    let bgClass = 'bg-slate-800 border-slate-700 text-slate-100';
    let iconClass = 'fa-circle-info text-sky-400';

    if (type === 'success') {
        bgClass = 'bg-slate-900 border-emerald-500/40 text-emerald-100';
        iconClass = 'fa-circle-check text-emerald-400';
    }

    toast.className = `px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${bgClass}`;
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// App Init
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const modeParam = urlParams.get('mode');

    if (modeParam === 'display') switchViewMode('display');

    const initialRoom = roomParam ? roomParam.toUpperCase().slice(0, 6) : generate6CharRoomCode();
    joinRoom(initialRoom);

    document.getElementById('scriptTextarea').value = window.appState.scriptText;
    updateTextDisplays();
    setupKeyboardShortcuts();
    setupManualScrollHandlers();
    startAnimationLoop();
});