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

// App State dengan Dual Targets untuk Pergerakan Lerp yang Mulus
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
let activeCountdownTimer = null;

function generate6CharRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TS';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.substring(0, 6);
}

function formatRoomInput(input) {
    if (input) {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    }
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

// Kirim state ke jaringan (Maksimal 20x per detik)
function broadcastStateChange(force = false) {
    const now = Date.now();
    if (!force && (now - lastBroadcastTime < 50)) return;
    lastBroadcastTime = now;

    const payload = { type: 'SYNC_STATE', state: window.appState };

    activeConnections.forEach(conn => {
        if (conn && conn.open) conn.send(payload);
    });
    if (hostConnection && hostConnection.open) {
        hostConnection.send(payload);
    }
}

function handleIncomingData(data) {
    if (data && data.type === 'SYNC_STATE' && data.state) {
        const incoming = data.state;
        
        // Simpan peran lokal agar tidak tertimpa state jarak jauh
        const currentLocalRole = window.appState.isController;
        
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

        // Pertahankan status controller lokal
        window.appState.isController = currentLocalRole;

        const scriptArea = document.getElementById('scriptTextarea');
        if (scriptArea && scriptArea.value !== incoming.scriptText) {
            scriptArea.value = incoming.scriptText;
        }

        const inputSpeed = document.getElementById('inputSpeed');
        if (inputSpeed) inputSpeed.value = incoming.speed;
        
        const speedValDisp = document.getElementById('speedValueDisplay');
        if (speedValDisp) speedValDisp.innerText = incoming.speed + ' px/s';
        
        const prevSpeedDisp = document.getElementById('previewSpeedDisplay');
        if (prevSpeedDisp) prevSpeedDisp.innerText = incoming.speed + ' px';

        const inputFont = document.getElementById('inputFontSize');
        if (inputFont) inputFont.value = incoming.fontSize;

        const fontDisp = document.getElementById('fontSizeDisplay');
        if (fontDisp) fontDisp.innerText = incoming.fontSize + 'px';

        const inputLine = document.getElementById('inputLineHeight');
        if (inputLine) inputLine.value = incoming.lineHeight;

        const lineDisp = document.getElementById('lineHeightDisplay');
        if (lineDisp) lineDisp.innerText = incoming.lineHeight;

        const selTheme = document.getElementById('selectTheme');
        if (selTheme) selTheme.value = incoming.theme;

        const chkFocus = document.getElementById('toggleFocusLine');
        if (chkFocus) chkFocus.checked = incoming.focusLine;

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

// MESIN ANIMASI PERGERAKAN TEKS (Lerp)
function startAnimationLoop() {
    function renderLoop() {
        const pcContainer = document.getElementById('promptContainer');
        const mobileContainer = document.getElementById('mobilePromptContainer');
        const activeContainer = window.appState.isController ? pcContainer : mobileContainer;
        
        if (activeContainer) {
            const maxScroll = activeContainer.scrollHeight - activeContainer.clientHeight;

            if (maxScroll > 0) {
                // 1. Auto-scroll step (HANYA Controller yang menambah targetScrollPercent)
                if (window.appState.isPlaying && window.appState.isController) {
                    const speedDelta = (window.appState.speed * 0.4) / maxScroll;
                    window.appState.targetScrollPercent = Math.min(1.0, window.appState.targetScrollPercent + speedDelta);
                    
                    if (window.appState.targetScrollPercent >= 1.0) {
                        window.appState.isPlaying = false;
                        updatePlayIcons();
                    }
                    broadcastStateChange();
                }

                // 2. Linear Interpolation (Lerp) untuk semua perangkat
                const lerpFactor = 0.2;
                const diff = window.appState.targetScrollPercent - window.appState.currentScrollPercent;
                
                if (Math.abs(diff) > 0.00001) {
                    window.appState.currentScrollPercent += diff * lerpFactor;
                } else {
                    window.appState.currentScrollPercent = window.appState.targetScrollPercent;
                }

                // 3. Terapkan posisi scroll
                const targetPixels = window.appState.currentScrollPercent * maxScroll;
                
                if (pcContainer) pcContainer.scrollTop = targetPixels;
                if (mobileContainer) mobileContainer.scrollTop = targetPixels;

                // 4. Update Indikator UI
                const displayPercent = Math.round(window.appState.currentScrollPercent * 100);
                const progressText = document.getElementById('scrollProgressPercent');
                const progressInput = document.getElementById('inputScrollProgress');
                
                if (progressText) progressText.innerText = displayPercent + '%';
                if (progressInput) progressInput.value = Math.round(window.appState.currentScrollPercent * 1000);
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
    if (mobileContainer) {
        mobileContainer.addEventListener('wheel', handleWheel, { passive: false });
        // Mencegah tarik layar fisik pada HP di Mode Display yang bentrok dengan Lerp
        mobileContainer.addEventListener('touchmove', (e) => {
            if (!window.appState.isController) {
                e.preventDefault();
            }
        }, { passive: false });
    }
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
    
    if (!overlay || !numberEl) return;
    
    // Hentikan timer sebelumnya jika sedang berjalan
    if (activeCountdownTimer) clearInterval(activeCountdownTimer);
    
    overlay.classList.remove('hidden');

    let count = 3;
    numberEl.innerText = count;

    activeCountdownTimer = setInterval(() => {
        count--;
        if (count > 0) {
            numberEl.innerText = count;
        } else if (count === 0) {
            numberEl.innerText = "GO!";
        } else {
            clearInterval(activeCountdownTimer);
            activeCountdownTimer = null;
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
    const speedValDisp = document.getElementById('speedValueDisplay');
    const prevSpeedDisp = document.getElementById('previewSpeedDisplay');
    if (speedValDisp) speedValDisp.innerText = val + ' px/s';
    if (prevSpeedDisp) prevSpeedDisp.innerText = val + ' px';
    broadcastStateChange(true);
}

function changeSpeed(delta) {
    let newSpeed = Math.max(1, Math.min(15, window.appState.speed + delta));
    const inputSpeed = document.getElementById('inputSpeed');
    if (inputSpeed) inputSpeed.value = newSpeed;
    updateSpeed(newSpeed);
}

function updateFontSize(val) {
    window.appState.fontSize = parseInt(val);
    const fontDisp = document.getElementById('fontSizeDisplay');
    if (fontDisp) fontDisp.innerText = val + 'px';
    applyFontSizeStyles();
    broadcastStateChange(true);
}

function applyFontSizeStyles() {
    const fontPx = window.appState.fontSize + 'px';
    const text1 = document.getElementById('promptTextDisplay');
    const text2 = document.getElementById('mobilePromptTextDisplay');
    if (text1) text1.style.fontSize = fontPx;
    if (text2) text2.style.fontSize = fontPx;
}

function updateLineHeight(val) {
    window.appState.lineHeight = parseFloat(val);
    const lineDisp = document.getElementById('lineHeightDisplay');
    if (lineDisp) lineDisp.innerText = val;
    applyLineHeightStyles();
    broadcastStateChange(true);
}

function applyLineHeightStyles() {
    const text1 = document.getElementById('promptTextDisplay');
    const text2 = document.getElementById('mobilePromptTextDisplay');
    if (text1) text1.style.lineHeight = window.appState.lineHeight;
    if (text2) text2.style.lineHeight = window.appState.lineHeight;
}

function updateTextAlign(align) {
    window.appState.textAlign = align;
    applyTextAlignStyles();
    broadcastStateChange(true);
}

function applyTextAlignStyles() {
    const align = window.appState.textAlign;
    const text1 = document.getElementById('promptTextDisplay');
    const text2 = document.getElementById('mobilePromptTextDisplay');
    if (text1) text1.style.textAlign = align;
    if (text2) text2.style.textAlign = align;

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
    const pcContainer = document.getElementById('promptContainer');
    const mobileContainer = document.getElementById('mobilePromptContainer');
    
    if (pcContainer) pcContainer.className = `flex-1 overflow-y-auto relative no-scrollbar select-none ${theme}`;
    if (mobileContainer) mobileContainer.className = `flex-1 overflow-y-auto relative no-scrollbar select-none ${theme}`;
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

    const text1 = document.getElementById('promptTextDisplay');
    const text2 = document.getElementById('mobilePromptTextDisplay');
    if (text1) text1.style.transform = transformStr;
    if (text2) text2.style.transform = transformStr;

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
        if (line1) line1.classList.remove('hidden');
        if (line2) line2.classList.remove('hidden');
    } else {
        if (line1) line1.classList.add('hidden');
        if (line2) line2.classList.add('hidden');
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
    const text1 = document.getElementById('promptTextDisplay');
    const text2 = document.getElementById('mobilePromptTextDisplay');
    
    if (text1) text1.innerText = text;
    if (text2) text2.innerText = text;

    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    const wordDisp = document.getElementById('wordCountDisplay');
    const charDisp = document.getElementById('charCountDisplay');
    if (wordDisp) wordDisp.innerText = words;
    if (charDisp) charDisp.innerText = chars;

    const minutes = Math.floor(words / 150);
    const seconds = Math.floor((words % 150) / 2.5);
    const estTime = document.getElementById('estTimeDisplay');
    if (estTime) estTime.innerText = `${minutes}m ${seconds}s`;
}

function loadPresetScript(key) {
    if (!key || !presetScripts[key]) return;
    const script = presetScripts[key];
    const scriptArea = document.getElementById('scriptTextarea');
    if (scriptArea) scriptArea.value = script;
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
        if (controllerView) controllerView.classList.remove('hidden');
        if (displayView) displayView.classList.add('hidden');
        if (btnCtrl) btnCtrl.className = "px-3 py-1.5 rounded-lg font-semibold transition bg-brand-600 text-white shadow";
        if (btnDisp) btnDisp.className = "px-3 py-1.5 rounded-lg font-semibold transition text-slate-400 hover:text-white";
    } else {
        window.appState.isController = false;
        if (controllerView) controllerView.classList.add('hidden');
        if (displayView) displayView.classList.remove('hidden');
        if (btnDisp) btnDisp.className = "px-3 py-1.5 rounded-lg font-semibold transition bg-brand-600 text-white shadow";
        if (btnCtrl) btnCtrl.className = "px-3 py-1.5 rounded-lg font-semibold transition text-slate-400 hover:text-white";
    }
}

// KEYBOARD & SAMSUNG S PEN CONTROLS
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;

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
            togglePlay();
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
function openRoomModal() { 
    const modal = document.getElementById('roomModal');
    if (modal) modal.classList.remove('hidden'); 
}

function closeRoomModal() { 
    const modal = document.getElementById('roomModal');
    if (modal) modal.classList.add('hidden'); 
}

function createNewRoom() {
    const newCode = generate6CharRoomCode();
    window.joinRoom(newCode);
    closeRoomModal();
}

function joinRoomFromInput() {
    const input = document.getElementById('inputRoomCode');
    if (input && input.value) {
        window.joinRoom(input.value);
        closeRoomModal();
    }
}

window.joinRoom = function(roomCode) {
    if (!roomCode) return;
    roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (roomCode.length < 6) roomCode = (roomCode + 'XXXXXX').slice(0, 6);

    window.appState.roomId = roomCode;
    
    const curRoomDisp = document.getElementById('currentRoomCodeDisplay');
    const dispRoomCode = document.getElementById('displayRoomCode');
    const inputRoomCode = document.getElementById('inputRoomCode');

    if (curRoomDisp) curRoomDisp.innerText = roomCode;
    if (dispRoomCode) dispRoomCode.innerText = roomCode;
    if (inputRoomCode) inputRoomCode.value = roomCode;

    generateQRCode(roomCode);
    initPeerCloud(roomCode);
    showToast(`Ruangan: ${roomCode}`, "info");
};

function generateQRCode(roomCode) {
    const qrWrapper = document.getElementById('qrCodeWrapper');
    const qrCanvas = document.getElementById('qrcodeCanvas');
    const qrText = document.getElementById('qrRoomCodeText');
    
    if (!qrCanvas) return;
    qrCanvas.innerHTML = '';
    if (qrText) qrText.innerText = roomCode;

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
        if (qrWrapper) qrWrapper.classList.remove('hidden');
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
    if (!dot || !txt) return;

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
    if (!container) return;

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

    const scriptArea = document.getElementById('scriptTextarea');
    if (scriptArea) scriptArea.value = window.appState.scriptText;

    updateTextDisplays();
    setupKeyboardShortcuts();
    setupManualScrollHandlers();
    startAnimationLoop();
});
