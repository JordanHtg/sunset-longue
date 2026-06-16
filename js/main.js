/**
 * Sunset Social Hub - Core System Logic
 * Standard 30 Years Experienced Architecture Optimization
 */
const chatContainer = document.getElementById('chat-container');
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatBtn = document.getElementById('chat-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const camToggleBtn = document.getElementById('camera-toggle-btn');
const tipOverlay = document.getElementById('shortcut-tip');

let notificationTimeout; let myUsername = ""; let currentSelectedAvatar = "cone"; let currentSelectedRole = "developer";
let audioPlayerNode = null; let audioPlaylistQueue = []; let pendingUserRequests = []; 
let selectedKickClientId = null; let selectedKickName = "";
let isTrackLooping = false; let currentVolumeLevel = 70;

if (typeof NAF !== 'undefined') {
    ['#avatar-cone', '#avatar-box', '#avatar-sphere'].forEach(templateId => {
        NAF.schemas.add({
            template: templateId,
            components: ['position', 'rotation', 'chat-bubble', 'player-name']
        });
    });
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
    audioPlayerNode.addEventListener('ended', () => {
        if (isTrackLooping) { audioPlayerNode.currentTime = 0; audioPlayerNode.play(); } 
        else { playNextQueueTrack(); }
    });
    audioPlayerNode.addEventListener('error', () => {
        triggerSystemNotice("❌ [JUKEBOX] URL Audio Rusak atau Terblokir CORS!", 4000);
        playNextQueueTrack();
    });
}

function openMusicController() { document.getElementById('music-controller-panel').style.display = 'block'; }
function closeMusicController() { document.getElementById('music-controller-panel').style.display = 'none'; }

function toggleMusicMinimize() {
    window.isMusicMinimized = !window.isMusicMinimized;
    const mPanel = document.getElementById('music-controller-panel');
    mPanel.classList.toggle('minimized', window.isMusicMinimized);
    document.getElementById('music-title-header').innerText = window.isMusicMinimized ? "🎵 Player Minimized..." : "🎵 IMVU Room Music Player";
}

function addAudioStreamTrackRoute() {
    const input = document.getElementById('music-url-direct');
    const targetUrl = input.value.trim();
    
    const check = Security.validateAudioURL(targetUrl);
    if (!check.valid) { triggerSystemNotice(`❌ [SECURE] ${check.error}`); return; }

    const parsedTitle = cleanAudioFilename(targetUrl);
    audioPlaylistQueue.push({ title: parsedTitle, url: targetUrl });
    input.value = ""; 
    triggerSystemNotice(`📥 Ditambahkan ke Antrean:<br>${parsedTitle}`);
    
    if (!audioPlayerNode || audioPlayerNode.paused) playNextQueueTrack();
}

function playNextQueueTrack() {
    if(audioPlaylistQueue.length === 0) {
        document.getElementById('current-track-title').innerText = "Antrean kosong.";
        if(audioPlayerNode) audioPlayerNode.pause(); return;
    }
    const nextTrack = audioPlaylistQueue.shift();
    if (audioPlayerNode) {
        audioPlayerNode.src = nextTrack.url;
        audioPlayerNode.volume = currentVolumeLevel / 100;
        audioPlayerNode.loop = isTrackLooping;
        document.getElementById('current-track-title').innerText = nextTrack.title;
        triggerSystemNotice(`🎵 Streaming: ${nextTrack.title}`);
        audioPlayerNode.play().catch(() => console.log("Autoplay ditahan browser. Menunggu interaksi."));
    }
}

function controlAudio(action) {
    if(!audioPlayerNode) return;
    switch(action) {
        case 'play':
            if (!audioPlayerNode.paused) { audioPlayerNode.pause(); triggerSystemNotice("⏸ Musik Dijeda"); } 
            else { audioPlayerNode.play(); triggerSystemNotice("▶ Musik Dilanjutkan"); }
            break;
        case 'loop':
            isTrackLooping = !isTrackLooping; audioPlayerNode.loop = isTrackLooping;
            document.getElementById('btn-loop-toggle').innerText = isTrackLooping ? "🔁 Loop: On" : "🔁 Loop: Off";
            triggerSystemNotice(isTrackLooping ? "🔁 Loop Lagu Aktif" : "🔁 Loop Lagu Mati");
            break;
        case 'replay': audioPlayerNode.currentTime = 0; audioPlayerNode.play(); triggerSystemNotice("🔄 Reset Track"); break;
        case 'vol-up': currentVolumeLevel = Math.min(100, currentVolumeLevel + 10); audioPlayerNode.volume = currentVolumeLevel / 100; triggerSystemNotice(`🔊 Volume: ${currentVolumeLevel}%`); break;
        case 'vol-down': currentVolumeLevel = Math.max(0, currentVolumeLevel - 10); audioPlayerNode.volume = currentVolumeLevel / 100; triggerSystemNotice(`🔉 Volume: ${currentVolumeLevel}%`); break;
        case 'skip': triggerSystemNotice("⏭ Skip Lagu"); playNextQueueTrack(); break;
    }
}

function toggleUserRequestPanel() {
    const panel = document.getElementById('user-request-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

function submitUserSongRequest() {
    const input = document.getElementById('user-song-link-input');
    const targetUrl = input.value.trim();
    
    const check = Security.validateAudioURL(targetUrl);
    if (!check.valid) { triggerSystemNotice(`❌ [SECURE] ${check.error}`); return; }

    const parsedTitle = cleanAudioFilename(targetUrl);
    pendingUserRequests.push({ title: parsedTitle, url: targetUrl, sender: myUsername });
    input.value = ""; toggleUserRequestPanel();
    triggerSystemNotice("🚀 Request terkirim ke Admin.");
    renderAdminReviewDOM();
}

function renderAdminReviewDOM() {
    const container = document.getElementById('admin-request-review-list'); container.innerHTML = "";
    if(pendingUserRequests.length === 0) {
        container.innerHTML = `<div style="font-size:11px; color:#666; text-align:center; padding-top:10px;">Belum ada request.</div>`; return;
    }
    pendingUserRequests.forEach((req, index) => {
        const div = document.createElement('div');
        div.style = "background:rgba(255,255,255,0.05); padding:6px; border-radius:4px; margin-bottom:5px; font-size:11px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(0,229,255,0.1);";
        div.innerHTML = `
            <div style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><b>${req.sender}</b>: ${req.title}</div>
            <div style="display:flex; gap:4px;">
                <button style="background:var(--neon-dev); border:none; border-radius:3px; padding:2px 6px; font-weight:bold; cursor:pointer;" onclick="reviewRequestAction(${index}, true)">✓</button>
                <button style="background:var(--neon-admin); border:none; border-radius:3px; padding:2px 6px; font-weight:bold; color:white; cursor:pointer;" onclick="reviewRequestAction(${index}, false)">X</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function reviewRequestAction(index, isAccepted) {
    const targeted = pendingUserRequests[index];
    if(isAccepted) {
        audioPlaylistQueue.push({ title: targeted.title, url: targeted.url });
        triggerSystemNotice(`✓ Request diterima: ${targeted.title}`);
        if (!audioPlayerNode || audioPlayerNode.paused) playNextQueueTrack();
    } else { triggerSystemNotice(`🗑️ Request ditolak`); }
    pendingUserRequests.splice(index, 1); renderAdminReviewDOM();
}

function toggleAdminMinimize() {
    const panel = document.getElementById('admin-menu-panel'); const body = document.getElementById('admin-panel-body');
    window.isAdminMinimized = !window.isAdminMinimized;
    body.style.display = window.isAdminMinimized ? 'none' : 'block';
    panel.style.height = window.isAdminMinimized ? '40px' : '185px';
    document.getElementById('admin-min-btn').innerText = window.isAdminMinimized ? '＋' : '−';
}

function toggleDevMinimize() {
    const panel = document.getElementById('dev-menu-panel'); const body = document.getElementById('dev-panel-body');
    window.isDevMinimized = !window.isDevMinimized;
    body.style.display = window.isDevMinimized ? 'none' : 'block';
    panel.style.height = window.isDevMinimized ? '40px' : '195px';
    document.getElementById('dev-min-btn').innerText = window.isDevMinimized ? '＋' : '−';
}

function triggerSystemNotice(messageText, customDuration = 2000) {
    clearTimeout(notificationTimeout); tipOverlay.innerHTML = messageText; tipOverlay.style.display = 'block'; tipOverlay.offsetHeight; tipOverlay.style.opacity = '1';
    notificationTimeout = setTimeout(() => {
        tipOverlay.style.opacity = '0';
        setTimeout(() => { if(tipOverlay.style.opacity === '0') tipOverlay.style.display = 'none'; }, 400); 
    }, customDuration); 
}

function toggleCameraLock() {
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl && sceneEl.canvas) {
        if (document.pointerLockElement !== sceneEl.canvas) sceneEl.canvas.requestPointerLock();
        else document.exitPointerLock();
    }
}

document.addEventListener('pointerlockchange', () => {
    const sceneEl = document.querySelector('a-scene');
    if (document.pointerLockElement === sceneEl.canvas) triggerSystemNotice("🔒 Kamera Terkunci<br><small>Mouse untuk melihat sekeliling 360°</small>");
    else triggerSystemNotice("🔓 Kamera Bebas<br><small>Tekan CTRL untuk mengunci kembali</small>");
});

function openKickInterface() {
    const listContainer = document.getElementById('kick-user-list'); listContainer.innerHTML = ""; let userCount = 0;
    if (typeof NAF !== 'undefined' && NAF.entities && NAF.entities.entities) {
        Object.keys(NAF.entities.entities).forEach(clientId => {
            const remoteEntity = NAF.entities.entities[clientId];
            if (remoteEntity) {
                let rawName = remoteEntity.getAttribute('player-name') || "User_Asing"; userCount++;
                const item = document.createElement('div'); item.className = 'user-list-item'; item.innerText = rawName;
                item.onclick = () => initiateKickConfirmation(clientId, rawName); listContainer.appendChild(item);
            }
        });
    }
    if (userCount === 0) {
        const dummyItem = document.createElement('div'); dummyItem.className = 'user-list-item'; dummyItem.innerText = "💥 Spammer_Test_User (Mock)";
        dummyItem.onclick = () => initiateKickConfirmation("mock123", "Spammer_Test_User"); listContainer.appendChild(dummyItem);
    }
    document.getElementById('kick-state-list').style.display = 'block'; document.getElementById('kick-state-confirm').style.display = 'none'; document.getElementById('kick-modal').style.display = 'block';
}

function initiateKickConfirmation(clientId, username) {
    selectedKickClientId = clientId; selectedKickName = username; document.getElementById('kick-target-display').innerText = username;
    document.getElementById('kick-state-list').style.display = 'none'; document.getElementById('kick-state-confirm').style.display = 'block';
}

function confirmKickAction() {
    document.getElementById('kick-modal').style.display = 'none'; triggerSystemNotice(`⚡ User ${selectedKickName} telah di kick!`, 3000);
    if (selectedKickClientId !== "mock123" && typeof NAF !== 'undefined') {
        const targetEntity = NAF.entities.entities[selectedKickClientId]; if (targetEntity) targetEntity.parentNode.removeChild(targetEntity);
    }
    selectedKickClientId = null; selectedKickName = "";
}
function cancelKickAction() { document.getElementById('kick-modal').style.display = 'none'; selectedKickClientId = null; selectedKickName = ""; }
function closeKickModal() { document.getElementById('kick-modal').style.display = 'none'; }

function selectAvatarState(type) { currentSelectedAvatar = type; document.querySelectorAll('.avatar-btn').forEach(btn => btn.classList.remove('selected')); document.getElementById(`btn-${type}`).classList.add('selected'); }

document.querySelectorAll('.avatar-btn, .role-btn, #start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setTimeout(() => {
            const sceneEl = document.querySelector('a-scene');
            if(sceneEl && sceneEl.canvas) sceneEl.canvas.requestPointerLock();
        }, 600);
    });
});

function selectRoleState(role) { currentSelectedRole = role; document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected')); document.getElementById(`role-${role}`).classList.add('selected'); }

function executeStartGame() {
    const nameInput = document.getElementById('username-input');
    myUsername = Security.sanitizeHTML(nameInput.value.trim());
    if(myUsername === "") myUsername = "User_" + Math.floor(Math.random() * 9000 + 1000);

    window.myRole = currentSelectedRole; 
    document.getElementById('avatar-selector').style.display = 'none'; camToggleBtn.style.display = 'block';
    initImvuAudioEngine();

    if (window.myRole === 'developer') {
        document.getElementById('admin-menu-panel').style.display = 'block'; document.getElementById('dev-menu-panel').style.display = 'block';
    } else if (window.myRole === 'admin') {
        document.getElementById('admin-menu-panel').style.display = 'block';
    } else {
        document.getElementById('user-song-trigger-btn').style.display = 'block';
    }

    const prefixTag = window.myRole === 'developer' ? '[DEV] ' : (window.myRole === 'admin' ? '[ADMIN] ' : '');
    const finalIdentityString = prefixTag + myUsername;
    triggerSystemNotice(`👋 Selamat Datang, ${myUsername}!<br>Level Anda: <b>${window.myRole.toUpperCase()}</b>`);

    const playerEl = document.getElementById('player');
    playerEl.setAttribute('networked', `template:#avatar-${currentSelectedAvatar}; attachTemplateToLocal:true;`);
    playerEl.setAttribute('player-name', finalIdentityString);

    setTimeout(() => { updateCameraView(); }, 500); bindChatSystem(playerEl);
    chatLog.innerHTML = `<div class="chat-msg"><span class="sender">Sistem:</span> Anda terhubung sebagai <b>${finalIdentityString}</b>.</div>`;
}

function adminAction(actionType) {
    if(actionType === 'clear') {
        chatLog.innerHTML = `<div class="chat-msg" style="color:var(--neon-admin)"><span class="sender">Sistem:</span> Log chat dibersihkan oleh Admin.</div>`; triggerSystemNotice("🧹 Chat Cleared!");
    } else if (actionType === 'sun') {
        const colors = ['#f05423', '#00ff66', '#ff2a5f', '#feb139', '#00e5ff'];
        document.getElementById('sunset-sun').setAttribute('material', 'color', colors[Math.floor(Math.random() * colors.length)]);
        triggerSystemNotice(`☀️ Warna Matahari Berubah!`);
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

window.addEventListener('keydown', function(e) {
    if (document.activeElement === chatInput || document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'Control') { e.preventDefault(); toggleCameraLock(); }
    if (e.key === '/') { e.preventDefault(); if (window.isChatMinimized) { toggleMinimize(); } chatInput.focus(); }
    if (['w','a','s','d','W','A','S','D'].includes(e.key)) {
        if (window.isSitting) {
            window.isSitting = false; const rigEl = document.getElementById('rig'); let currentPos = rigEl.getAttribute('position'); currentPos.y = 0; rigEl.setAttribute('position', currentPos); updateCameraView(); triggerSystemNotice("🚶 Berdiri Normal");
        }
    }
});

function toggleMinimize() {
    window.isChatMinimized = !window.isChatMinimized; const logArea = document.getElementById('chat-log'); const inputArea = document.getElementById('chat-input-area');
    if (window.isChatMinimized) { logArea.style.display = 'none'; inputArea.style.display = 'none'; chatContainer.style.height = '45px'; minimizeBtn.innerText = '＋'; } 
    else { logArea.style.display = 'flex'; inputArea.style.display = 'flex'; chatContainer.style.height = '400px'; minimizeBtn.innerText = '−'; }
    document.getElementById('player').components['chat-bubble'].updateVisibility();
}

function bindChatSystem(activePlayerEl) {
    let bubbleTimeout;
    function executeSend() {
        const text = Security.sanitizeHTML(chatInput.value.trim()); 
        if (text === '') return;
        activePlayerEl.setAttribute('chat-bubble', text);
        
        const senderPrefix = (window.myRole === 'developer' ? '[DEV] ' : (window.myRole === 'admin' ? '[ADMIN] ' : ''));
        appendToLog(senderPrefix + myUsername, text); 
        chatInput.value = ''; chatInput.blur(); 
        
        clearTimeout(bubbleTimeout); 
        bubbleTimeout = setTimeout(() => { activePlayerEl.setAttribute('chat-bubble', ''); }, 6000);
    }
    chatBtn.onclick = executeSend; chatInput.onkeypress = (e) => { if (e.key === 'Enter') executeSend(); };
}

function appendToLog(senderName, message) {
    const msgEl = document.createElement('div'); msgEl.className = 'chat-msg';
    const senderSpan = document.createElement('span'); senderSpan.className = 'sender'; senderSpan.innerText = senderName + ": ";
    msgEl.appendChild(senderSpan);
    msgEl.appendChild(document.createTextNode(message)); 
    chatLog.appendChild(msgEl); chatLog.scrollTop = chatLog.scrollHeight;
}

function toggleCameraMode() { window.isTpp = !window.isTpp; updateCameraView(); }
function updateCameraView() {
    const cameraEl = document.getElementById('main-camera'); const localMesh = document.querySelector('#player .avatar-mesh'); let baseHeight = window.isSitting ? 0.8 : 1.6;
    if (window.isTpp) {
        cameraEl.setAttribute('position', `0 ${baseHeight + 0.6} 3.5`); camToggleBtn.innerText = '📷 Mode: TPP'; if (localMesh) localMesh.setAttribute('scale', '1 1 1');
    } else {
        cameraEl.setAttribute('position', `0 ${baseHeight} 0`); camToggleBtn.innerText = '📷 Mode: FPS'; if (localMesh) localMesh.setAttribute('scale', '0 0 0');
    }
}