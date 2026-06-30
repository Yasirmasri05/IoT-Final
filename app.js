// STATE MANAGEMENTS
let ws = null;
let jwtToken = null;
let chart = null;
let pingInterval = null;
let breakTimer = null;

// DOM ELEMENTS
const tbHostInput = document.getElementById('tb-host');
const tbUsernameInput = document.getElementById('tb-username');
const tbPasswordInput = document.getElementById('tb-password');
const tbDeviceIdInput = document.getElementById('tb-device-id');
const configForm = document.getElementById('config-form');
const connectBtn = document.getElementById('connect-btn');
const toggleConfigBtn = document.getElementById('toggle-config-btn');
const configPanel = document.getElementById('config-panel');
const connectionBadge = document.getElementById('connection-badge');

// DEVICE SETTINGS DOM ELEMENTS
const deviceSettingsCard = document.getElementById('device-settings-card');
const settingsForm = document.getElementById('settings-form');
const settingDistance = document.getElementById('setting-distance');
const settingDistanceVal = document.getElementById('setting-distance-val');
const settingBuzzer = document.getElementById('setting-buzzer');
const settingLight = document.getElementById('setting-light');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsStatus = document.getElementById('settings-status');

// METRICS
const valDistance = document.getElementById('val-distance');
const valLight = document.getElementById('val-light');
const valWork = document.getElementById('val-work');
const valMaxWork = document.getElementById('val-max-work');
const currentStatus = document.getElementById('current-status');
const statusDesc = document.getElementById('status-desc');
const statusIconWrapper = document.getElementById('status-icon-wrapper');
const statusSvg = document.getElementById('status-svg');

// PROGRESS BARS
const distanceProgress = document.getElementById('distance-progress');
const lightProgress = document.getElementById('light-progress');
const workProgress = document.getElementById('work-progress');

// FOOTER TEXTS
const distanceStatusText = document.getElementById('distance-status-text');
const lightStatusText = document.getElementById('light-status-text');
const workStatusText = document.getElementById('work-status-text');

// BREAK OVERLAY
const breakOverlay = document.getElementById('break-overlay');
const countdownRing = document.getElementById('countdown-ring');
const countdownNumber = document.getElementById('countdown-number');
const closeOverlayBtn = document.getElementById('close-overlay-btn');

// LOAD CREDENTIALS FROM STORAGE
document.addEventListener('DOMContentLoaded', () => {
    tbHostInput.value = localStorage.getItem('tb_host') || 'demo.thingsboard.io';
    tbUsernameInput.value = localStorage.getItem('tb_username') || '';
    tbPasswordInput.value = localStorage.getItem('tb_password') || '';
    tbDeviceIdInput.value = localStorage.getItem('tb_device-id') || '';

    // Initialize Chart
    initChart();
    
    // Auto-connect if credentials exist
    if (tbUsernameInput.value && tbPasswordInput.value && tbDeviceIdInput.value) {
        console.log("[SYSTEM] Kredensial ditemukan, mencoba menyambungkan secara otomatis...");
        connectToThingsBoard();
    } else {
        // Show config panel if empty credentials
        configPanel.classList.remove('hidden');
    }
});

// TOGGLE CONFIG PANEL VISIBILITY
toggleConfigBtn.addEventListener('click', () => {
    configPanel.classList.toggle('hidden');
});

// HANDLE CONFIG FORM SUBMIT
configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Save to LocalStorage
    localStorage.setItem('tb_host', tbHostInput.value.trim());
    localStorage.setItem('tb_username', tbUsernameInput.value.trim());
    localStorage.setItem('tb_password', tbPasswordInput.value.trim());
    localStorage.setItem('tb_device-id', tbDeviceIdInput.value.trim());
    
    connectToThingsBoard();
});

// CLOSE BREAK OVERLAY MANUALLY
closeOverlayBtn.addEventListener('click', () => {
    hideBreakOverlay();
});

// DEVICE SETTINGS EVENT LISTENERS
if (settingDistance) {
    settingDistance.addEventListener('input', (e) => {
        settingDistanceVal.textContent = `${e.target.value} cm`;
    });
}

if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const host = tbHostInput.value.trim();
        const deviceId = tbDeviceIdInput.value.trim();
        const newDistance = parseInt(settingDistance.value);
        const newBuzzer = settingBuzzer.checked;
        const newLight = parseInt(settingLight.value);
        
        if (!jwtToken || !deviceId) {
            alert("Perangkat belum terhubung ke ThingsBoard!");
            return;
        }
        
        saveSettingsBtn.disabled = true;
        saveSettingsBtn.innerHTML = '<span>Menyimpan...</span>';
        settingsStatus.textContent = "";
        settingsStatus.style.color = "var(--text-secondary)";
        
        try {
            const httpProto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
            const url = `${httpProto}://${host}/api/plugins/telemetry/DEVICE/${deviceId}/SHARED_SCOPE`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({
                    targetDistance: newDistance,
                    buzzerEnabled: newBuzzer,
                    darkThreshold: newLight
                })
            });
            
            if (!response.ok) {
                throw new Error(`Gagal menyimpan (Status: ${response.status})`);
            }
            
            saveSettingsBtn.innerHTML = '<span>Tersimpan ✓</span>';
            saveSettingsBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            settingsStatus.textContent = "Pengaturan berhasil terkirim ke alat!";
            settingsStatus.style.color = "var(--color-safe)";
            
            setTimeout(() => {
                saveSettingsBtn.disabled = false;
                saveSettingsBtn.innerHTML = '<span>Simpan Pengaturan</span>';
                saveSettingsBtn.style.background = '';
                settingsStatus.textContent = "";
            }, 3000);
            
        } catch (err) {
            console.error("[API] Gagal menyimpan pengaturan perangkat:", err);
            saveSettingsBtn.disabled = false;
            saveSettingsBtn.innerHTML = '<span>Simpan Pengaturan</span>';
            settingsStatus.textContent = "Gagal menyimpan!";
            settingsStatus.style.color = "var(--color-alert)";
            alert(`Gagal menyimpan pengaturan:\n${err.message}`);
        }
    });
}

// 1. AUTHENTICATE AND CONNECT
async function connectToThingsBoard() {
    const host = tbHostInput.value.trim();
    const username = tbUsernameInput.value.trim();
    const password = tbPasswordInput.value.trim();
    
    updateConnectionStatus(false, 'Mencoba Masuk...');
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span>Menyambungkan...</span>';
    
    try {
        // HTTP API REST login URL
        const httpProto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const loginUrl = `${httpProto}://${host}/api/auth/login`;
        
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            throw new Error(`Kredensial salah atau host tidak dapat dijangkau (Status: ${response.status})`);
        }
        
        const data = await response.json();
        jwtToken = data.token;
        console.log("[API] Autentikasi berhasil! Token JWT didapatkan.");
        
        // Connect to WebSocket
        initWebSocket(host, jwtToken);
        
    } catch (error) {
        console.error("[API] Gagal masuk ke ThingsBoard:", error);
        alert(`Gagal terhubung ke ThingsBoard:\n${error.message}`);
        updateConnectionStatus(false, 'Gagal Masuk');
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<span>Hubungkan & Sinkronkan</span>';
    }
}

// 2. ESTABLISH WEBSOCKET CONNECTION
function initWebSocket(host, token) {
    if (ws) {
        ws.close();
    }
    
    const wsProto = host.includes('localhost') || host.includes('127.0.0.1') ? 'ws' : 'wss';
    const wsUrl = `${wsProto}://${host}/api/ws/plugins/telemetry?token=${token}`;
    
    console.log(`[WS] Membuka WebSocket ke: ${wsUrl}`);
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log("[WS] Koneksi WebSocket Terbuka!");
        updateConnectionStatus(true, 'Tersambung');
        
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<span>Tersambung ✓</span>';
        connectBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
        // Enable Settings Card
        if (deviceSettingsCard) {
            deviceSettingsCard.classList.remove('disabled-card');
        }
        
        // Hide config panel automatically on success
        setTimeout(() => {
            configPanel.classList.add('hidden');
        }, 1000);
        
        // Start Ping telemetry server interval to keep WS alive
        startPingInterval();
        
        // Subscribe to Device Telemetry
        subscribeToDeviceTelemetry();
    };
    
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleWSData(msg);
        } catch (e) {
            console.warn("[WS] Gagal memparsing data masuk:", e);
        }
    };
    
    ws.onerror = (error) => {
        console.error("[WS] Terjadi kesalahan WebSocket:", error);
    };
    
    ws.onclose = (event) => {
        console.log("[WS] Koneksi WebSocket ditutup:", event);
        updateConnectionStatus(false, 'Terputus');
        stopPingInterval();
        
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<span>Hubungkan & Sinkronkan</span>';
        connectBtn.style.background = '';
        
        // Disable Settings Card
        if (deviceSettingsCard) {
            deviceSettingsCard.classList.add('disabled-card');
        }
        
        // Retry connection if it wasn't intentional
        if (event.code !== 1000) {
            console.log("[WS] Mencoba menyambungkan kembali dalam 5 detik...");
            setTimeout(connectToThingsBoard, 5000);
        }
    };
}

// Keep connection alive with Ping command
function startPingInterval() {
    stopPingInterval();
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
        }
    }, 30000);
}

function stopPingInterval() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

// 3. SUBSCRIBE TO DEVICE TELEMETRY KEYS
function subscribeToDeviceTelemetry() {
    const deviceId = tbDeviceIdInput.value.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    const subCmd = {
        tsSubCmds: [
            {
                entityType: "DEVICE",
                entityId: deviceId,
                keys: "distance,light,work_duration,max_work_duration,status,dark_warning,too_close_warning",
                cmdId: 1
            }
        ],
        historyCmds: [],
        attrSubCmds: [
            {
                entityType: "DEVICE",
                entityId: deviceId,
                keys: "targetDistance,buzzerEnabled,darkThreshold",
                cmdId: 2
            }
        ]
    };
    
    console.log(`[WS] Berlangganan telemetri & shared attributes untuk Device ID: ${deviceId}`);
    ws.send(JSON.stringify(subCmd));
}

// 4. PARSE & PROCESS INCOMING DATA
function handleWSData(msg) {
    if (!msg.data) return;
    
    // Check if subscription data exists
    const telemetry = {};
    for (const key in msg.data) {
        const values = msg.data[key];
        if (values && values.length > 0) {
            // Get the newest value [timestamp, value]
            telemetry[key] = values[values.length - 1][1];
        }
    }
    
    if (Object.keys(telemetry).length === 0) return;
    
    console.log("[DATA] Telemetri Baru:", telemetry);
    
    // Cast types
    const distance = telemetry.distance !== undefined ? parseFloat(telemetry.distance) : null;
    const light = telemetry.light !== undefined ? parseInt(telemetry.light) : null;
    const workDuration = telemetry.work_duration !== undefined ? parseInt(telemetry.work_duration) : null;
    const maxWorkDuration = telemetry.max_work_duration !== undefined ? parseInt(telemetry.max_work_duration) : 20;
    const status = telemetry.status || null;
    const darkWarning = telemetry.dark_warning === "true" || telemetry.dark_warning === true;
    const tooCloseWarning = telemetry.too_close_warning === "true" || telemetry.too_close_warning === true;
    
    // Sync settings form with attributes if received
    if (telemetry.targetDistance !== undefined) {
        const parsedDistance = parseInt(telemetry.targetDistance);
        settingDistance.value = parsedDistance;
        settingDistanceVal.textContent = `${parsedDistance} cm`;
    }
    if (telemetry.buzzerEnabled !== undefined) {
        settingBuzzer.checked = telemetry.buzzerEnabled === "true" || telemetry.buzzerEnabled === true;
    }
    if (telemetry.darkThreshold !== undefined) {
        settingLight.value = parseInt(telemetry.darkThreshold);
    }
    
    // Update Widgets
    updateUIWidgets(distance, light, workDuration, maxWorkDuration, status, darkWarning, tooCloseWarning);
    
    // Update Chart
    updateChart(distance, light);
}

// 5. UPDATE DASHBOARD UI
function updateUIWidgets(distance, light, work, maxWork, status, darkWarning, tooCloseWarning) {
    const timestamp = new Date().toLocaleTimeString();

    // -- 1. Status Overview Card --
    if (status) {
        currentStatus.textContent = status;
        
        // Remove old state classes
        statusIconWrapper.className = 'icon-pulse-wrapper';
        
        if (status === "Sedang Istirahat") {
            currentStatus.textContent = "Waktu Istirahat Mata!";
            statusDesc.textContent = "Siklus aturan 20-20-20 berjalan. Istirahatkan mata Anda.";
            statusIconWrapper.classList.add('status-color-inactive');
            showBreakOverlay(5); // Show break popup overlay (usually simulated 5 seconds)
        } else if (tooCloseWarning) {
            statusDesc.textContent = "Bahaya! Posisi kepala Anda terlalu dekat dengan layar komputer.";
            statusIconWrapper.classList.add('status-color-alert');
            hideBreakOverlay();
        } else if (darkWarning) {
            statusDesc.textContent = "Pencahayaan ruangan redup. Harap nyalakan lampu agar mata tidak lelah.";
            statusIconWrapper.classList.add('status-color-warning');
            hideBreakOverlay();
        } else if (status === "Tidak di Tempat") {
            statusDesc.textContent = "Sistem menjeda waktu kerja karena Anda tidak di depan laptop.";
            statusIconWrapper.classList.add('status-color-inactive');
            hideBreakOverlay();
        } else {
            statusDesc.textContent = "Bagus! Jarak mata dan intensitas cahaya ruangan dalam batas aman.";
            statusIconWrapper.classList.add('status-color-safe');
            hideBreakOverlay();
        }
    }

    // -- 2. Distance Widget --
    if (distance !== null) {
        if (distance > 500) {
            valDistance.textContent = "N/A";
            distanceProgress.style.width = "0%";
            distanceStatusText.textContent = "Objek tidak terdeteksi";
            distanceStatusText.style.color = 'var(--text-muted)';
        } else {
            valDistance.textContent = distance.toFixed(1);
            // Math map distance 0-100cm to 0-100% progress
            const distPercent = Math.min(Math.max((distance / 100) * 100, 0), 100);
            distanceProgress.style.width = `${distPercent}%`;
            
            if (distance < 40) {
                distanceStatusText.textContent = "Terlalu Dekat (< 40cm)";
                distanceStatusText.style.color = 'var(--color-alert)';
            } else if (distance < 80) {
                distanceStatusText.textContent = "Jarak Aman (Ideal)";
                distanceStatusText.style.color = 'var(--color-safe)';
            } else {
                distanceStatusText.textContent = "Diluar Area Deteksi (> 80cm)";
                distanceStatusText.style.color = 'var(--text-secondary)';
            }
        }
    }

    // -- 3. Light Sensor Widget --
    if (light !== null) {
        valLight.textContent = light;
        // LDR range 0 (terang) - 4095 (gelap). Map to percentage.
        // Let's show "Gelap %" or map to intensity: 100% is very dark.
        const lightPercent = Math.min(Math.max((light / 4095) * 100, 0), 100);
        lightProgress.style.width = `${lightPercent}%`;
        
        if (darkWarning) {
            lightStatusText.textContent = "Terlalu Gelap! (> 2500 ADC)";
            lightStatusText.style.color = 'var(--color-warning)';
        } else {
            lightStatusText.textContent = "Pencahayaan Cukup";
            lightStatusText.style.color = 'var(--color-safe)';
        }
    }

    // -- 4. Work Duration Widget --
    if (work !== null) {
        valWork.textContent = work;
        valMaxWork.textContent = maxWork;
        
        const workPercent = Math.min(Math.max((work / maxWork) * 100, 0), 100);
        workProgress.style.width = `${workPercent}%`;
        
        if (work >= maxWork) {
            workStatusText.textContent = "Waktunya Istirahat!";
            workStatusText.style.color = 'var(--color-alert)';
        } else if (work > (maxWork * 0.75)) {
            workStatusText.textContent = "Mendekati Batas Lelah";
            workStatusText.style.color = 'var(--color-warning)';
        } else {
            workStatusText.textContent = "Bekerja secara aktif";
            workStatusText.style.color = 'var(--color-primary)';
        }
    }
}

// 6. CONTROL BREAK COUNTDOWN OVERLAY
function showBreakOverlay(seconds) {
    if (!breakOverlay.classList.contains('hidden')) return; // Already showing
    
    breakOverlay.classList.remove('hidden');
    
    let countdown = seconds;
    countdownNumber.textContent = `${countdown}s`;
    
    // Reset ring animation
    countdownRing.style.strokeDashoffset = '0';
    const totalOffset = 314.16;
    
    if (breakTimer) clearInterval(breakTimer);
    
    breakTimer = setInterval(() => {
        countdown--;
        if (countdown < 0) {
            clearInterval(breakTimer);
            hideBreakOverlay();
        } else {
            countdownNumber.textContent = `${countdown}s`;
            // Calculate offset logic
            const offset = totalOffset - (countdown / seconds) * totalOffset;
            countdownRing.style.strokeDashoffset = offset;
        }
    }, 1000);
}

function hideBreakOverlay() {
    if (breakTimer) {
        clearInterval(breakTimer);
        breakTimer = null;
    }
    breakOverlay.classList.add('hidden');
}

// 7. CHART FUNCTIONS
function initChart() {
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Timestamps
            datasets: [
                {
                    label: 'Jarak (cm)',
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 3,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.35,
                    fill: true,
                    data: [],
                    yAxisID: 'y'
                },
                {
                    label: 'Cahaya (ADC)',
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.2,
                    fill: false,
                    data: [],
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f3f4f6',
                        font: {
                            family: 'Plus Jakarta Sans',
                            weight: '600'
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxTicksLimit: 8
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 0,
                    max: 120,
                    title: {
                        display: true,
                        text: 'Jarak (cm)',
                        color: '#06b6d4',
                        font: { weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 4096,
                    title: {
                        display: true,
                        text: 'Cahaya (ADC)',
                        color: '#f59e0b',
                        font: { weight: 'bold' }
                    },
                    grid: {
                        drawOnChartArea: false // Only draw grid for left axis
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                }
            }
        }
    });
}

function updateChart(distance, light) {
    if (!chart) return;
    
    const now = new Date().toLocaleTimeString();
    
    // Add new label and data
    chart.data.labels.push(now);
    
    // Avoid plotting large out of bounds ultrasonic values
    const safeDistance = (distance !== null && distance < 150) ? distance : null;
    chart.data.datasets[0].data.push(safeDistance);
    chart.data.datasets[1].data.push(light);
    
    // Limit to 20 points
    if (chart.data.labels.length > 20) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
    }
    
    chart.update('none'); // Update without full animation for better performance
}

// Connection State UI Helper
function updateConnectionStatus(isConnected, text) {
    if (isConnected) {
        connectionBadge.className = 'badge status-connected';
        connectionBadge.innerHTML = `<span class="pulse-dot"></span> ${text}`;
    } else {
        connectionBadge.className = 'badge status-disconnected';
        connectionBadge.innerHTML = `<span class="pulse-dot"></span> ${text}`;
    }
}
