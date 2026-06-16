/**
 * Sunset Social Hub - Core System Logic
 * v8.9 Multiplayer Fix Edition - Fixed ID Mismatches & Restored Control Binding Matrix
 */

// =========================================================================
// INTERCEPTOR MATRIX: Memaksa Transportasi Socket Menggunakan Jalur Murni WebSocket
// =========================================================================
if (typeof window.io !== 'undefined') {
    const originalIo = window.io;
    window.io = function(url, opts) {
        opts = opts || {};
        opts.transports = ['websocket']; 
        return originalIo(url, opts);
    };
}

// =========================================================================
// GRUP 1: REGISTRASI KOMPONEN AFRAME (Wajib di Head)
// =========================================================================
if (typeof AFRAME !== 'undefined') {
    AFRAME.registerComponent('mouse-look', {
        init: function () {
            this.pitch = 0; this.yaw = 0;
            this.onMouseMove = this.onMouseMove.bind(this);
            document.addEventListener('mousemove', this.onMouseMove);
        },
        onMouseMove: function (e) {
            if (document.pointerLockElement === this.el.sceneEl.canvas) {
                const cameraEl = document.getElementById('main-camera');
                this.yaw -= e.movementX * 0.002; this.el.object3D.rotation.set(0, this.yaw, 0);
                this.pitch -= e.movementY * 0.002; this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
                if (cameraEl) cameraEl.object3D.rotation.set(this.pitch, 0, 0);
            }
        },
        remove: function () { document.removeEventListener('mousemove', this.onMouseMove); }
    });

    AFRAME.registerComponent('physical-presence', {
        schema: { radius: { type: 'number', default: 28 } },
        tick: function () {
            let pos = this.el.getAttribute('position'); if (!window.isSitting) pos.y = 0;
            let distance = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
            if (distance > this.data.radius) {
                let angle = Math.atan2(pos.z, pos.x); pos.x = Math.cos(angle) * this.data.radius; pos.z = Math.sin(angle) * this.data.radius;
            }
            this.el.setAttribute('position', pos);
        }
    });

    AFRAME.registerComponent('sync-network-player', {
        tick: function () {
            const rigEl = document.getElementById('rig'); if (!rigEl) return;
            this.el.setAttribute('position', rigEl.getAttribute('position')); this.el.setAttribute('rotation', rigEl.getAttribute('rotation'));
        }
    });

    AFRAME.registerComponent('sit-able', {
        init: function () {
            this.el.addEventListener('click', () => {
                const rigEl = document.getElementById('rig'); const cameraEl = document.getElementById('main-camera');
                const worldPos = new THREE.Vector3(); this.el.object3D.getWorldPosition(worldPos);
                const scale = this.el.getAttribute('scale') || { y: 1 };
                const topOfBenchSurface = worldPos.y + (scale.y / 2) + 0.005;
                window.isSitting = true;
                rigEl.setAttribute('position', { x: worldPos.x, y: topOfBenchSurface, z: worldPos.z });
                cameraEl.setAttribute('position', { x: 0, y: 0.8, z: window.isTpp ? 3.5 : 0 });
            });
        }
    });

    AFRAME.registerComponent('chat-bubble', {
        schema: { type: 'string', default: '' },
        init: function() { this.updateVisibility(); },
        update: function () { const textEl = this.el.querySelector('.bubble-text'); if (textEl) textEl.setAttribute('value', this.data); this.updateVisibility(); },
        updateVisibility: function() { const textEl = this.el.querySelector('.bubble-text'); if (!textEl) return; textEl.setAttribute('visible', !!(window.isChatMinimized && this.data && this.data.trim() !== '')); }
    });

    AFRAME.registerComponent('sunset-sky', {
        init: function () {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#1a0b2e'); gradient.addColorStop(0.4, '#711c43'); gradient.addColorStop(0.7, '#f05423'); gradient.addColorStop(1.0, '#ffdf7a'); 
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
            this.el.setAttribute('material', { shader: 'flat', src: canvas, side: 'back' });
        }
    });
}

// =========================================================================
// GRUP 2: ALOKASI INSTANCE VARIABEL GLOBAL
// =========================================================================
let chatContainer, chatLog, chatInput, chatBtn, minimizeBtn, camToggleBtn, tipOverlay;
let notificationTimeout; let myUsername = ""; let currentSelectedAvatar = "cone"; let currentSelectedRole = "user"; 
let audioPlayerNode = null; let audioPlaylistQueue = []; let pendingUserRequests = []; 
let selectedKickClientId = null; let selectedKickName = "";
let isTrackLooping = false; let currentVolumeLevel = 70;
let bubbleTimeout;

// =========================================================================
// GRUP 3: DEKLARASI FUNGSIONAL STANDARD (Anti Null Crash Engine)
// =========================================================================
function triggerSystemNotice(messageText, customDuration = 2000) {
    if(!tipOverlay) return;
    clearTimeout(notificationTimeout); tipOverlay.innerHTML = messageText; tipOverlay.style.display = 'block'; tipOverlay.offsetHeight; tipOverlay.style.opacity = '1';
    notificationTimeout = setTimeout(() => {
        tipOverlay.style.opacity = '0';
        setTimeout(() => { if (tipOverlay && tipOverlay.style.opacity === '0') tipOverlay.style.display = 'none'; }, 400); 
    }, customDuration); 
}

function cleanAudioFilename(url) {
    try {
        const decodedUrl = decodeURIComponent(url);
        let filename = decodedUrl.substring(decodedUrl.lastIndexOf('/') + 1).split('?')[0];
        return Security.sanitizeHTML(filename) || "Direct Audio Stream";
    } catch(e) { return "Direct Audio Stream"; }
}

function initImvuAudioEngine() {
    audioPlayerNode = document.getElementById('global-audio-player');
    if(audioPlayerNode) {
        audioPlayerNode.onended = () => {
            if (isTrackLooping) { audioPlayerNode.currentTime = 0; audioPlayerNode.play(); } 
            else { playNextQueueTrack(); }
        };
        audioPlayerNode.onerror = () => {
            triggerSystemNotice("❌ [JUKEBOX] URL Audio Rusak atau Terblokir CORS!", 4000);
            playNextQueueTrack();
        };
    }
}

function playNextQueueTrack() {
    if(audioPlaylistQueue.length === 0) { document.getElementById('current-track-title').innerText = "Antrean kosong."; if(audioPlayerNode) audioPlayerNode.pause(); return; }
    const nextTrack = audioPlaylistQueue.shift();
    if (audioPlayerNode) {
        audioPlayerNode.src = nextTrack.url; audioPlayerNode.volume = currentVolumeLevel / 100; audioPlayerNode.loop = isTrackLooping;
        document.getElementById('current-track-title').innerText = nextTrack.title; triggerSystemNotice(`🎵 Streaming: ${nextTrack.title}`);
        audioPlayerNode.play().catch(() => console.log("Autoplay ditahan browser."));
    }
}

function renderAdminReviewDOM() {
    const container = document.getElementById('admin-request-review-list'); if(!container) return;
    container.innerHTML = "";
    if(pendingUserRequests.length === 0) { container.innerHTML = `<div style="font-size:11px; color:#666; text-align:center; padding-top:10px;">Belum ada request.</div>`; return; }
    pendingUserRequests.forEach((req, index) => {
        const div = document.createElement('div'); div.style = "background:rgba(255,255,255,0.05); padding:6px; border-radius:4px; margin-bottom:5px; font-size:11px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(0,229,255,0.1);";
        div.innerHTML = `<div style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><b>${req.sender}</b>: ${req.title}</div><div style="display:flex; gap:4px;"><button style="background:var(--neon-dev); border:none; border-radius:3px; padding:2px 6px; font-weight:bold; cursor:pointer;" onclick="reviewRequestAction(${index}, true)">✓</button><button style="background:var(--neon-admin); border:none; border-radius:3px; padding:2px 6px; font-weight:bold; color:white; cursor:pointer;" onclick="reviewRequestAction(${index}, false)">X</button></div>`;
        container.appendChild(div);
    });
}

function selectAvatarState(type) { currentSelectedAvatar = type; document.querySelectorAll('.avatar-btn').forEach(btn => btn.classList.remove('selected')); document.getElementById(`btn-${type}`).classList.add('selected'); }

function selectRoleState(role) {
    if (role === 'admin') {
        const passwordInput = prompt("🔒 Masukkan Kode Otentikasi Admin:");
        if (passwordInput !== "admin123") { alert("❌ Akses Ditolak! Password Admin Salah."); selectRoleState('user'); return; }
    } else if (role === 'developer') {
        const passwordInput = prompt("🔒 Masukkan Master Key Developer:");
        if (passwordInput !== "dev123") { alert("❌ Akses Ditolak! Password Developer Salah."); selectRoleState('user'); return; }
    }
    currentSelectedRole = role;
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
    
    // FIX INTUISION: Target pencarian ID diubah menjadi role-developer agar lolos dari null crash
    const targetId = (role === 'developer') ? 'role-developer' : `role-${role}`;
    const targetEl = document.getElementById(targetId);
    if(targetEl) targetEl.classList.add('selected');
}

function toggleAdminMinimize() {
    const panel = document.getElementById('admin-menu-panel'); const body = document.getElementById('admin-panel-body');
    window.isAdminMinimized = !window.isAdminMinimized;
    if(body && panel) { body.style.display = window.isAdminMinimized ? 'none' : 'block'; panel.style.height = window.isAdminMinimized ? '40px' : '185px'; document.getElementById('admin-min-btn').innerText = window.isAdminMinimized ? '＋' : '−'; }
}

function toggleDevMinimize() {
    const panel = document.getElementById('dev-menu-panel'); const body = document.getElementById('dev-panel-body');
    window.isDevMinimized = !window.isDevMinimized;
    if(body && panel) { body.style.display = window.isDevMinimized ? 'none' : 'block'; panel.style.height = window.isDevMinimized ? '40px' : '195px'; document.getElementById('dev-min-btn').innerText = window.isDevMinimized ? '＋' : '−'; }
}

function openMusicController() { document.getElementById('music-controller-panel').style.display = 'block'; }
function closeMusicController() { document.getElementById('music-controller-panel').style.display = 'none'; }
function toggleMusicMinimize() {
    window.isMusicMinimized = !window.isMusicMinimized; const mPanel = document.getElementById('music-controller-panel');
    if(mPanel) { mPanel.classList.toggle('minimized', window.isMusicMinimized); document.getElementById('music-title-header').innerText = window.isMusicMinimized ? "🎵 Player Minimized..." : "🎵 IMVU Room Music Player"; }
}

function addAudioStreamTrackRoute() {
    const input = document.getElementById('music-url-direct'); const targetUrl = input.value.trim();
    const check = Security.validateAudioURL(targetUrl);
    if (!check.valid) { triggerSystemNotice(`❌ [SECURE] ${check.error}`); return; }
    const parsedTitle = cleanAudioFilename(targetUrl);
    audioPlaylistQueue.push({ title: parsedTitle, url: targetUrl }); input.value = ""; 
    triggerSystemNotice(`📥 Ditambahkan ke Antrean:<br>${parsedTitle}`);
    if (!audioPlayerNode || audioPlayerNode.paused) playNextQueueTrack();
}

function controlAudio(action) {
    if(!audioPlayerNode) return;
    switch(action) {
        case 'play':
            if (!audioPlayerNode.paused) { audioPlayerNode.pause(); triggerSystemNotice("⏸ Musik Streaming Dijeda"); } 
            else { audioPlayerNode.play(); triggerSystemNotice("▶ Musik Streaming Dilanjutkan"); } break;
        case 'loop':
            isTrackLooping = !isTrackLooping; audioPlayerNode.loop = isTrackLooping;
            document.getElementById('btn-loop-toggle').innerText = isTrackLooping ? "🔁 Loop: On" : "🔁 Loop: Off";
            triggerSystemNotice(isTrackLooping ? "🔁 Loop Lagu Aktif" : "🔁 Loop Lagu Mati"); break;
        case 'replay': audioPlayerNode.currentTime = 0; audioPlayerNode.play(); triggerSystemNotice("🔄 Mengulang Dari Awal"); break;
        case 'vol-up': currentVolumeLevel = Math.min(100, currentVolumeLevel + 10); audioPlayerNode.volume = currentVolumeLevel / 100; triggerSystemNotice(`🔊 Volume Room: ${currentVolumeLevel}%`); break;
        case 'vol-down': currentVolumeLevel = Math.max(0, currentVolumeLevel - 10); audioPlayerNode.volume = currentVolumeLevel / 100; triggerSystemNotice(`🔉 Volume Room: ${currentVolumeLevel}%`); break;
        case 'skip': triggerSystemNotice("⏭ Lagu Di-skip"); playNextQueueTrack(); break;
    }
}

function submitUserSongRequest() {
    const input = document.getElementById('user-song-link-input'); const targetUrl = input.value.trim();
    const check = Security.validateAudioURL(targetUrl);
    if (!check.valid) { triggerSystemNotice(`❌ [SECURE] ${check.error}`); return; }
    const parsedTitle = cleanAudioFilename(targetUrl);
    pendingUserRequests.push({ title: parsedTitle, url: targetUrl, sender: myUsername });
    input.value = ""; toggleUserRequestPanel(); triggerSystemNotice("🚀 Request dikirim ke Admin Panel!"); renderAdminReviewDOM();
}

function executeStartGame() {
    const nameInput = document.getElementById('username-input'); if(!nameInput) return;
    myUsername = Security.sanitizeHTML(nameInput.value.trim());
    if(myUsername === "") myUsername = "User_" + Math.floor(Math.random() * 9000 + 1000);

    window.myRole = currentSelectedRole; 
    document.getElementById('avatar-selector').style.display = 'none'; camToggleBtn.style.display = 'block';
    initImvuAudioEngine();

    if (window.myRole === 'developer') { document.getElementById('admin-menu-panel').style.display = 'block'; document.getElementById('dev-menu-panel').style.display = 'block'; } 
    else if (window.myRole === 'admin') { document.getElementById('admin-menu-panel').style.display = 'block'; } 
    else { document.getElementById('user-song-trigger-btn').style.display = 'block'; }

    const prefixTag = window.myRole === 'developer' ? '[DEV] ' : (window.myRole === 'admin' ? '[ADMIN] ' : '');
    const finalIdentityString = prefixTag + myUsername;
    triggerSystemNotice(`👋 Selamat Datang, ${myUsername}!<br>Level Anda: <b>${window.myRole.toUpperCase()}</b>`);

    const playerEl = document.getElementById('player');
    if(playerEl) {
        playerEl.setAttribute('networked', `template:#avatar-${currentSelectedAvatar}; attachTemplateToLocal:true;`); 
        playerEl.setAttribute('player-name', finalIdentityString);
    }
    setTimeout(() => { toggleCameraLock(true); }, 500); bindChatSystem(playerEl);
    if(chatLog) chatLog.innerHTML = `<div class="chat-msg"><span class="sender">Sistem:</span> Anda terhubung sebagai <b>${finalIdentityString}</b>.</div>`;
}

function reviewRequestAction(index, isAccepted) {
    const targeted = pendingUserRequests[index];
    if(isAccepted) {
        audioPlaylistQueue.push({ title: targeted.title, url: targeted.url }); triggerSystemNotice(`✓ Request diterima: ${targeted.title}`);
        if (!audioPlayerNode || audioPlayerNode.paused) playNextQueueTrack();
    } else { triggerSystemNotice(`🗑️ Request musik ditolak`); }
    pendingUserRequests.splice(index, 1); renderAdminReviewDOM();
}

function openKickInterface() {
    const listContainer = document.getElementById('kick-user-list'); if(!listContainer) return;
    listContainer.innerHTML = ""; let userCount = 0;
    if (typeof NAF !== 'undefined' && NAF.entities && NAF.entities.entities) {
        Object.keys(NAF.entities.entities).forEach(clientId => {
            const remoteEntity = NAF.entities.entities[clientId];
            if (remoteEntity) {
                let rawName = remoteEntity.getAttribute('player-name') || "User_Asing"; userCount++;
                const item = document.createElement('div'); item.className = 'user-list-item'; item.innerText = rawName;
                item.onclick = () => { selectedKickClientId = clientId; selectedKickName = rawName; document.getElementById('kick-target-display').innerText = rawName; document.getElementById('kick-state-list').style.display = 'none'; document.getElementById('kick-state-confirm').style.display = 'block'; };
                listContainer.appendChild(item);
            }
        });
    }
    if (userCount === 0) {
        const item = document.createElement('div'); item.className = 'user-list-item'; item.innerText = "💥 Spammer_Test_User (Mock)";
        item.onclick = () => { selectedKickClientId = "mock123"; selectedKickName = "Spammer_Test_User"; document.getElementById('kick-target-display').innerText = "Spammer_Test_User"; document.getElementById('kick-state-list').style.display = 'none'; document.getElementById('kick-state-confirm').style.display = 'block'; };
        listContainer.appendChild(item);
    }
    document.getElementById('kick-state-list').style.display = 'block'; document.getElementById('kick-state-confirm').style.display = 'none'; document.getElementById('kick-modal').style.display = 'block';
}

function confirmKickAction() {
    document.getElementById('kick-modal').style.display = 'none'; triggerSystemNotice(`⚡ User ${selectedKickName} telah di kick!`, 3000);
    if (selectedKickClientId !== "mock123" && typeof NAF !== 'undefined') { const targetEntity = NAF.entities.entities[selectedKickClientId]; if (targetEntity) targetEntity.parentNode.removeChild(targetEntity); }
    selectedKickClientId = null; selectedKickName = "";
}
function cancelKickAction() { document.getElementById('kick-modal').style.display = 'none'; selectedKickClientId = null; selectedKickName = ""; }
function closeKickModal() { document.getElementById('kick-modal').style.display = 'none'; }

function adminAction(actionType) {
    if(chatLog) {
        if(actionType === 'clear') {
            chatLog.innerHTML = `<div class="chat-msg" style="color:var(--neon-admin)"><span class="sender">Sistem:</span> Log chat dibersihkan oleh Admin.</div>`; triggerSystemNotice("🧹 Chat Cleared!");
        } else if (actionType === 'sun') {
            const colors = ['#f05423', '#00ff66', '#ff2a5f', '#feb139', '#00e5ff'];
            document.getElementById('sunset-sun').setAttribute('material', 'color', colors[Math.floor(Math.random() * colors.length)]); triggerSystemNotice(`☀️ Warna Matahari Berubah!`);
        }
    }
}

function devAction(actionType) {
    if(actionType === 'tp') { document.getElementById('rig').setAttribute('position', '0 0 0'); triggerSystemNotice("🌀 Teleported to Center Room!"); } 
    else if(actionType === 'wireframe') {
        document.getElementById('mountains').object3D.traverse(node => { if (node.isMesh && node.material) node.material.wireframe = !node.material.wireframe; }); triggerSystemNotice("🕸️ Wireframe Toggled!");
    } else if(actionType === 'fps') {
        const sceneEl = document.querySelector('a-scene'); if (sceneEl.hasAttribute('stats')) { sceneEl.removeAttribute('stats'); } else { sceneEl.setAttribute('stats', ''); } triggerSystemNotice("📈 Engine Stats Toggled!");
    }
}

function toggleCameraMode() {
    window.isTpp = !window.isTpp;
    updateCameraView();
}

function updateCameraView() {
    const cameraEl = document.getElementById('main-camera'); const localMesh = document.querySelector('#player .avatar-mesh'); let baseHeight = window.isSitting ? 0.8 : 1.6;
    if(!cameraEl) return;
    if (window.isTpp) { cameraEl.setAttribute('position', `0 ${baseHeight + 0.6} 3.5`); camToggleBtn.innerText = '📷 Mode: TPP'; if (localMesh) localMesh.setAttribute('scale', '1 1 1'); } 
    else { cameraEl.setAttribute('position', `0 ${baseHeight} 0`); camToggleBtn.innerText = '📷 Mode: FPS'; if (localMesh) localMesh.setAttribute('scale', '0 0 0'); }
}

function toggleMinimize() {
    window.isChatMinimized = !window.isChatMinimized; const logArea = document.getElementById('chat-log'); const inputArea = document.getElementById('chat-input-area');
    if (window.isChatMinimized) { logArea.style.display = 'none'; inputArea.style.display = 'none'; chatContainer.style.height = '45px'; minimizeBtn.innerText = '＋'; } 
    else { logArea.style.display = 'flex'; inputArea.style.display = 'flex'; chatContainer.style.height = '400px'; minimizeBtn.innerText = '−'; }
    const localPlayer = document.getElementById('player');
    if(localPlayer && localPlayer.components['chat-bubble']) localPlayer.components['chat-bubble'].updateVisibility();
}

function toggleUserRequestPanel() {
    const panel = document.getElementById('user-request-panel'); if(panel) panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

// FIX: Target penembakan pointer lock dialihkan ke document.body agar kebal dari status canvas uninitialized
function toggleCameraLock(forceLock = false) {
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
        const targetElement = sceneEl.canvas || document.body;
        if (forceLock || document.pointerLockElement !== targetElement) {
            targetElement.requestPointerLock();
        } else {
            document.exitPointerLock();
        }
    }
}

// =========================================================================
// GRUP 4: PEMETAAN STRUKTUR WINDOW KE GLOBAL SCOPE
// =========================================================================
window.toggleAdminMinimize = toggleAdminMinimize; window.toggleDevMinimize = toggleDevMinimize;
window.openMusicController = openMusicController; window.closeMusicController = closeMusicController;
window.toggleMusicMinimize = toggleMusicMinimize; window.addAudioStreamTrackRoute = addAudioStreamTrackRoute;
window.controlAudio = controlAudio; window.submitUserSongRequest = submitUserSongRequest;
window.reviewRequestAction = reviewRequestAction; window.openKickInterface = openKickInterface;
window.confirmKickAction = confirmKickAction; window.cancelKickAction = cancelKickAction;
window.closeKickModal = closeKickModal; window.adminAction = adminAction; window.devAction = devAction;
window.toggleCameraMode = toggleCameraMode; window.toggleMinimize = toggleMinimize;
window.toggleUserRequestPanel = toggleUserRequestPanel; window.toggleCameraLock = toggleCameraLock;

// =========================================================================
// GRUP 5: INTERACTION CENTRAL INITIALIZATION (DOM Ready Engine)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    chatContainer = document.getElementById('chat-container');
    chatLog = document.getElementById('chat-log');
    chatInput = document.getElementById('chat-input');
    chatBtn = document.getElementById('chat-btn');
    minimizeBtn = document.getElementById('minimize-btn');
    camToggleBtn = document.getElementById('camera-toggle-btn');
    tipOverlay = document.getElementById('shortcut-tip');

    const btnCone = document.getElementById('btn-cone'); const btnBox = document.getElementById('btn-box'); const btnSphere = document.getElementById('btn-sphere');
    if (btnCone) btnCone.addEventListener('click', () => selectAvatarState('cone'));
    if (btnBox) btnBox.addEventListener('click', () => selectAvatarState('box'));
    if (btnSphere) btnSphere.addEventListener('click', () => selectAvatarState('sphere'));

    const roleUser = document.getElementById('role-user'); const roleAdmin = document.getElementById('role-admin'); const roleDeveloper = document.getElementById('role-developer');
    if (roleUser) roleUser.addEventListener('click', () => selectRoleState('user'));
    if (roleAdmin) roleAdmin.addEventListener('click', () => selectRoleState('admin'));
    if (roleDeveloper) roleDeveloper.addEventListener('click', () => selectRoleState('developer'));

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            executeStartGame();
        });
    }

    const userSongTrigger = document.getElementById('user-song-trigger-btn'); if (userSongTrigger) userSongTrigger.addEventListener('click', window.toggleUserRequestPanel);
    const closeUserReq = document.getElementById('close-user-req-btn'); if (closeUserReq) closeUserReq.addEventListener('click', window.toggleUserRequestPanel);
});

// =========================================================================
// GRUP 6: SHORTCUT KEYBOARD EVENT ENGINE (Penguncian Tombol Kontrol)
// =========================================================================
window.addEventListener('keydown', function(e) {
    if (document.activeElement === chatInput || document.activeElement.tagName === 'INPUT') return;
    
    // FIX: Penguncian kamera menggunakan tombol Control dipastikan aktif stabil
    if (e.key === 'Control') { 
        e.preventDefault(); 
        window.toggleCameraLock(false); 
    }
    if (e.key === '/') { e.preventDefault(); if (window.isChatMinimized) { window.toggleMinimize(); } if(chatInput) chatInput.focus(); }
    
    if (['w','a','s','d','W','A','S','D'].includes(e.key)) {
        if (window.isSitting) {
            window.isSitting = false; const rigEl = document.getElementById('rig');
            if(rigEl) { let currentPos = rigEl.getAttribute('position'); currentPos.y = 0; rigEl.setAttribute('position', currentPos); }
            updateCameraView(); triggerSystemNotice("🚶 Berdiri Normal");
        }
    }
});