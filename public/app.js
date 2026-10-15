// ==============================================================================
// CLIENT APPLICATION LOGIC: SIM-NET INVENTARIS & MONITORING
// ==============================================================================

let devicesList = [];
let categoriesList = [];
let locationsList = [];

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    loadMetadata();
    loadStats();
    loadDevices();
    loadMaintenance();

    // Auto-refresh monitoring setiap 45 detik
    setInterval(() => {
        loadStats();
        loadDevices(false);
    }, 45000);
});

function initClock() {
    const clockEl = document.getElementById('liveClock');
    const update = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + 
            ' • ' + now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
    };
    update();
    setInterval(update, 1000);
}

// 1. Load Metadata Kategori & Lokasi
async function loadMetadata() {
    try {
        const res = await fetch('/api/metadata');
        const data = await res.json();
        if (data.success) {
            categoriesList = data.categories;
            locationsList = data.locations;
            populateDropdowns();
        }
    } catch (e) {
        console.error('Error load metadata:', e);
    }
}

function populateDropdowns() {
    const filterCat = document.getElementById('filterCategory');
    const newCat = document.getElementById('newCategory');
    const newLoc = document.getElementById('newLocation');

    filterCat.innerHTML = '<option value="all">Semua Kategori</option>';
    newCat.innerHTML = '';
    categoriesList.forEach(c => {
        filterCat.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        newCat.innerHTML += `<option value="${c.id}">${c.name} (${c.code})</option>`;
    });

    newLoc.innerHTML = '';
    locationsList.forEach(l => {
        newLoc.innerHTML += `<option value="${l.id}">${l.name} - ${l.rack}</option>`;
    });
}

// 2. Load Stats KPI
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (data.success) {
            const s = data.stats;
            document.getElementById('statTotal').textContent = s.total_devices;
            document.getElementById('statOnline').textContent = s.online_count;
            document.getElementById('statLatency').textContent = s.latency_high_count;
            document.getElementById('statOffline').textContent = s.offline_count;
            document.getElementById('statUptime').textContent = s.overall_uptime;
        }
    } catch (e) {
        console.error('Error load stats:', e);
    }
}

// 3. Load Devices
async function loadDevices(renderLoading = true) {
    const tbody = document.getElementById('deviceTableBody');
    if (renderLoading) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 20px; color: var(--text-muted);">Memuat inventaris perangkat...</td></tr>`;
    }

    try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        if (data.success) {
            devicesList = data.data;
            renderDevicesTable(devicesList);
            populateMaintDeviceDropdown();
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 20px; color: #ef4444;">Gagal memuat data inventaris.</td></tr>`;
    }
}

function renderDevicesTable(list) {
    const tbody = document.getElementById('deviceTableBody');
    const countLabel = document.getElementById('deviceCountLabel');
    countLabel.textContent = `Menampilkan ${list.length} dari ${devicesList.length} perangkat`;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 24px; color: var(--text-muted);">Tidak ada perangkat yang sesuai filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((d, idx) => {
        let statusBadge = '';
        if (d.status === 'online') {
            statusBadge = `<span class="badge badge-online">● Online</span>`;
        } else if (d.status === 'latency_high') {
            statusBadge = `<span class="badge badge-latency">⚠️ High Latency</span>`;
        } else {
            statusBadge = `<span class="badge badge-offline">🔴 Offline</span>`;
        }

        const opBadge = d.operational_status === 'Active' 
            ? `<span style="color:#15803d; font-weight:600;">Active</span>` 
            : `<span style="color:#b45309; font-weight:600;">Maintenance</span>`;

        const latencyDisplay = d.latency_ms !== null 
            ? `<strong>${d.latency_ms} ms</strong>` 
            : `<span style="color:#94a3b8;">-</span>`;

        return `
            <tr>
                <td style="color:var(--text-muted); font-weight:600;">${idx + 1}</td>
                <td><strong>${d.asset_code}</strong></td>
                <td>
                    <div style="font-weight:700;">${d.hostname}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${d.brand} ${d.model}</div>
                </td>
                <td>
                    <span class="badge-tag" style="background-color: ${d.category_color};">
                        ${d.category_name}
                    </span>
                </td>
                <td><code>${d.ip_address}:${d.port}</code></td>
                <td><code style="font-size:11.5px; color:#475569;">${d.mac_address}</code></td>
                <td>
                    <div>${d.location_name}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${d.rack}</div>
                </td>
                <td>${opBadge}</td>
                <td>${statusBadge}</td>
                <td>${latencyDisplay}</td>
                <td style="font-weight:600; color:#0284c7;">${d.uptime}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-outline" title="Ping Perangkat Ini" onclick="quickPingDevice('${d.ip_address}', ${d.port})">🔍</button>
                        <button class="btn btn-sm btn-outline" style="color:#ef4444;" title="Hapus Aset" onclick="deleteDevice(${d.id})">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter Function
function filterDevices() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('filterCategory').value;
    const stat = document.getElementById('filterStatus').value;

    let filtered = devicesList.filter(d => {
        const matchesQuery = d.hostname.toLowerCase().includes(q) ||
                             d.asset_code.toLowerCase().includes(q) ||
                             d.ip_address.includes(q) ||
                             d.brand.toLowerCase().includes(q);
        const matchesCat = (cat === 'all') || (d.category_id == cat);
        const matchesStat = (stat === 'all') || (d.status === stat);
        return matchesQuery && matchesCat && matchesStat;
    });

    renderDevicesTable(filtered);
}

// 4. Quick Ping Single Device
async function quickPingDevice(ip, port) {
    document.getElementById('probeIpInput').value = ip;
    document.getElementById('probePortInput').value = port;
    runProbeTest();
}

async function runProbeTest() {
    const ip = document.getElementById('probeIpInput').value.trim();
    const port = document.getElementById('probePortInput').value.trim();
    const box = document.getElementById('probeResultBox');

    if (!ip) {
        alert('Masukkan IP Address target pengujian');
        return;
    }

    box.style.display = 'block';
    box.style.background = '#f1f5f9';
    box.innerHTML = `Mengirim paket probe soket TCP ke <code>${ip}:${port}</code>...`;

    try {
        const res = await fetch('/api/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port })
        });
        const data = await res.json();
        if (data.status === 'online') {
            box.style.background = '#dcfce7';
            box.style.color = '#15803d';
            box.innerHTML = `🟢 <strong>ONLINE / REACHABLE:</strong> Host <code>${ip}:${port}</code> merespons normal dengan waktu tempuh latensi <strong>${data.latency_ms} ms</strong>.`;
        } else if (data.status === 'latency_high') {
            box.style.background = '#fef3c7';
            box.style.color = '#b45309';
            box.innerHTML = `⚠️ <strong>LATENCY TINGGI:</strong> Host <code>${ip}:${port}</code> merespons dengan latensi lambat <strong>${data.latency_ms} ms</strong> (>100ms). Perlu pengecekan bandwidth/load.`;
        } else {
            box.style.background = '#fee2e2';
            box.style.color = '#b91c1c';
            box.innerHTML = `🔴 <strong>OFFLINE / UNREACHABLE:</strong> Tidak ada respons dari host <code>${ip}:${port}</code> (Connection Refused atau Timeout). Periksa kabel LAN, power supply, atau firewall.`;
        }
    } catch (e) {
        box.style.background = '#fee2e2';
        box.innerHTML = `Gagal menjalankan pengujian jaringan.`;
    }
}

// 5. Re-scan Semua Perangkat
async function rescanAllDevices() {
    const btn = event.target;
    btn.textContent = '⏳ Memindai...';
    btn.disabled = true;

    try {
        await fetch('/api/probe-all', { method: 'POST' });
        await loadStats();
        await loadDevices(false);
    } catch (e) {
        console.error('Error rescan:', e);
    } finally {
        btn.textContent = '🔄 Scan Jaringan Sekarang';
        btn.disabled = false;
    }
}

// 6. Tambah Perangkat Modal
function openAddModal() {
    document.getElementById('modalAddDevice').classList.add('active');
}
function closeAddModal() {
    document.getElementById('modalAddDevice').classList.remove('active');
    document.getElementById('formAddDevice').reset();
}

async function submitNewDevice(e) {
    e.preventDefault();
    const payload = {
        asset_code: document.getElementById('newAssetCode').value.trim(),
        hostname: document.getElementById('newHostname').value.trim(),
        category_id: document.getElementById('newCategory').value,
        location_id: document.getElementById('newLocation').value,
        ip_address: document.getElementById('newIpAddress').value.trim(),
        port: document.getElementById('newPort').value,
        brand: document.getElementById('newBrand').value.trim(),
        model: document.getElementById('newModel').value.trim(),
        mac_address: document.getElementById('newMac').value.trim(),
        notes: document.getElementById('newNotes').value.trim()
    };

    try {
        const res = await fetch('/api/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeAddModal();
            loadStats();
            loadDevices();
        } else {
            alert(data.message || 'Gagal menambahkan perangkat');
        }
    } catch (e) {
        alert('Terjadi kesalahan saat menyimpan perangkat.');
    }
}

// 7. Delete Device
async function deleteDevice(id) {
    if (!confirm('Hapus perangkat ini dari master inventaris?')) return;
    try {
        const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadStats();
            loadDevices();
        }
    } catch (e) {
        alert('Gagal menghapus perangkat');
    }
}

// 8. Maintenance Logs
async function loadMaintenance() {
    const tbody = document.getElementById('maintenanceTableBody');
    try {
        const res = await fetch('/api/maintenance');
        const data = await res.json();
        if (data.success) {
            tbody.innerHTML = data.data.map(m => `
                <tr>
                    <td style="font-weight:600;">${m.date}</td>
                    <td><strong>${m.device_name}</strong></td>
                    <td style="color:#b91c1c;">${m.issue}</td>
                    <td>${m.action}</td>
                    <td>${m.technician}</td>
                    <td>
                        <span class="badge ${m.status === 'Resolved' ? 'badge-online' : 'badge-latency'}">
                            ${m.status}
                        </span>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Error load maintenance:', e);
    }
}

function populateMaintDeviceDropdown() {
    const sel = document.getElementById('maintDeviceSelect');
    sel.innerHTML = '';
    devicesList.forEach(d => {
        sel.innerHTML += `<option value="${d.id}">${d.hostname} (${d.ip_address})</option>`;
    });
}

function openMaintenanceModal() {
    document.getElementById('modalMaintenance').classList.add('active');
}
function closeMaintenanceModal() {
    document.getElementById('modalMaintenance').classList.remove('active');
}

async function submitMaintenance(e) {
    e.preventDefault();
    const payload = {
        device_id: document.getElementById('maintDeviceSelect').value,
        issue: document.getElementById('maintIssue').value.trim(),
        action: document.getElementById('maintAction').value.trim(),
        technician: document.getElementById('maintTech').value.trim(),
        status: document.getElementById('maintStatus').value
    };

    try {
        const res = await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeMaintenanceModal();
            loadMaintenance();
        }
    } catch (e) {
        alert('Gagal menyimpan log pemeliharaan.');
    }
}

// 9. Export CSV
function exportDataCSV() {
    if (!devicesList || devicesList.length === 0) {
        alert('Tidak ada data inventaris');
        return;
    }

    let csv = "No,Kode Aset,Hostname,Brand,Model,Kategori,IP Address,Port,MAC Address,Lokasi,Rack,Status Fisik,Status Monitoring,Latensi (ms),Uptime\n";
    devicesList.forEach((d, idx) => {
        csv += `${idx + 1},"${d.asset_code}","${d.hostname}","${d.brand}","${d.model}","${d.category_name}","${d.ip_address}",${d.port},"${d.mac_address}","${d.location_name}","${d.rack}","${d.operational_status}","${d.status}",${d.latency_ms || 0},"${d.uptime}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventaris_Jaringan_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
