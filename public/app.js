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
    // Nilai cadangan agar formulir tetap bisa dipakai bila endpoint metadata
    // gagal dimuat di deployment.
    const defaultCategories = [
        { id: 1, name: 'Core Router', code: 'ROU-CORE', color: '#2563eb' },
        { id: 2, name: 'Manageable Switch', code: 'SW-MNG', color: '#059669' },
        { id: 3, name: 'Wireless Access Point', code: 'WAP', color: '#d97706' },
        { id: 4, name: 'Server Fisik', code: 'SRV', color: '#7c3aed' },
        { id: 5, name: 'Firewall UTM', code: 'FW', color: '#dc2626' }
    ];
    const defaultLocations = [
        { id: 1, name: 'Ruang Server NOC', building: 'Gedung Rektorat Lt. 2', rack: 'Rack 01-A' },
        { id: 2, name: 'Data Center Distribusi', building: 'Gedung Lab Komputer Lt. 1', rack: 'Rack 02-B' },
        { id: 3, name: 'Hub Perpustakaan', building: 'Gedung Perpustakaan Lt. 3', rack: 'Rack 03-C' },
        { id: 4, name: 'Distribution Hall', building: 'Gedung Kuliah Bersama Lt. 2', rack: 'Rack 04-D' }
    ];

    try {
        const res = await fetch('/api/metadata');
        if (!res.ok) throw new Error('Endpoint metadata mengembalikan HTTP ' + res.status);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Metadata tidak tersedia');
        categoriesList = Array.isArray(data.categories) ? data.categories : [];
        locationsList = Array.isArray(data.locations) ? data.locations : [];
        if (!categoriesList.length) categoriesList = defaultCategories;
        if (!locationsList.length) locationsList = defaultLocations;
    } catch (e) {
        console.error('Metadata gagal dimuat, menggunakan data cadangan:', e);
        categoriesList = defaultCategories;
        locationsList = defaultLocations;
    }
    populateDropdowns();
}

function populateDropdowns() {
    const filterCat = document.getElementById('filterCategory');
    const newCat = document.getElementById('newCategory');
    const newLoc = document.getElementById('newLocation');
    if (!filterCat || !newCat || !newLoc) return;

    filterCat.innerHTML = '<option value="all">Semua Kategori</option>';
    newCat.innerHTML = '<option value="">Pilih kategori perangkat</option>';
    categoriesList.forEach(c => {
        filterCat.add(new Option(c.name, c.id));
        newCat.add(new Option(`${c.name} (${c.code})`, c.id));
    });

    newLoc.innerHTML = '<option value="">Pilih lokasi / rack</option>';
    locationsList.forEach(l => {
        newLoc.add(new Option(`${l.name} - ${l.rack}`, l.id));
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


// =============================================================================
// UX IMPROVEMENTS: LOCAL PERSISTENCE FOR ADDED ASSETS
// Asset baru dan penghapusan disimpan di browser agar tetap terlihat setelah
// halaman di-refresh. Untuk berbagi data antar pengguna/perangkat dibutuhkan DB.
(() => {
  const ASSET_KEY = 'simnet_custom_assets_v1';
  const DELETED_KEY = 'simnet_deleted_assets_v1';

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      alert('Penyimpanan browser penuh atau tidak tersedia. Coba hapus beberapa data browser.');
      return false;
    }
  }
  function getCustomAssets() { return readStore(ASSET_KEY, []); }
  function getDeletedIds() { return readStore(DELETED_KEY, []); }

  window.loadDevices = async function(renderLoading = true) {
    const tbody = document.getElementById('deviceTableBody');
    if (renderLoading && tbody) {
      tbody.innerHTML = '<tr><td colspan="12" class="empty-state">Memuat inventaris perangkat...</td></tr>';
    }
    try {
      const response = await fetch('/api/devices');
      if (!response.ok) throw new Error('Gagal mengambil inventaris');
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Data tidak tersedia');
      const deleted = new Set(getDeletedIds().map(String));
      const base = data.data.filter(d => !deleted.has(String(d.id)));
      const custom = getCustomAssets().filter(d => !deleted.has(String(d.id)));
      devicesList = [...custom, ...base];
      renderDevicesTable(devicesList);
      populateMaintDeviceDropdown();
      window.loadStats();
    } catch (error) {
      console.error(error);
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" class="empty-state">Data gagal dimuat. Pastikan aplikasi berjalan melalui server SIM-NET.</td></tr>';
    }
  };

  window.loadStats = async function() {
    const total = devicesList.length;
    const online = devicesList.filter(d => d.status === 'online').length;
    const high = devicesList.filter(d => d.status === 'latency_high').length;
    const offline = devicesList.filter(d => d.status === 'offline').length;
    const values = { statTotal: total, statOnline: online, statLatency: high, statOffline: offline };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
    const uptime = document.getElementById('statUptime');
    if (uptime && !uptime.textContent) uptime.textContent = '—';
  };

  window.submitNewDevice = async function(e) {
    e.preventDefault();
    const payload = {
      asset_code: document.getElementById('newAssetCode').value.trim(),
      hostname: document.getElementById('newHostname').value.trim(),
      category_id: Number(document.getElementById('newCategory').value) || 1,
      location_id: Number(document.getElementById('newLocation').value) || 1,
      ip_address: document.getElementById('newIpAddress').value.trim(),
      port: Number(document.getElementById('newPort').value) || 80,
      brand: document.getElementById('newBrand').value.trim() || 'Generic',
      model: document.getElementById('newModel').value.trim() || 'Standard',
      mac_address: document.getElementById('newMac').value.trim() || '00:00:00:00:00:00',
      notes: document.getElementById('newNotes').value.trim()
    };
    if (!payload.asset_code || !payload.hostname || !payload.ip_address) {
      alert('Kode aset, nama perangkat, dan IP address wajib diisi.');
      return;
    }
    if (devicesList.some(d => String(d.asset_code).toLowerCase() === payload.asset_code.toLowerCase())) {
      alert('Kode aset tersebut sudah digunakan. Gunakan kode aset yang berbeda.');
      return;
    }
    const category = categoriesList.find(c => c.id === payload.category_id) || { name: 'Lainnya', code: 'OTH', color: '#64748b' };
    const location = locationsList.find(l => l.id === payload.location_id) || { name: 'Belum ditentukan', building: '-', rack: '-' };
    const asset = {
      ...payload,
      id: Date.now() + Math.floor(Math.random() * 1000),
      category_name: category.name,
      category_code: category.code,
      category_color: category.color,
      location_name: location.name,
      building: location.building,
      rack: location.rack,
      operational_status: 'Active',
      status: 'offline',
      latency_ms: null,
      last_check: new Date().toISOString(),
      uptime: '—'
    };
    const custom = getCustomAssets();
    custom.unshift(asset);
    if (!writeStore(ASSET_KEY, custom)) return;
    closeAddModal();
    await loadDevices(false);
    alert('Aset berhasil ditambahkan. Data tersimpan di browser ini.');
  };

  window.deleteDevice = async function(id) {
    const device = devicesList.find(d => String(d.id) === String(id));
    if (!device || !confirm('Hapus aset ' + device.asset_code + ' dari inventaris?')) return;
    const custom = getCustomAssets().filter(d => String(d.id) !== String(id));
    const deleted = getDeletedIds();
    if (!deleted.map(String).includes(String(id))) deleted.push(id);
    if (!writeStore(ASSET_KEY, custom) || !writeStore(DELETED_KEY, deleted)) return;
    await loadDevices(false);
  };

  // Tombol tutup modal juga bisa memakai Escape.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.getElementById('modalAddDevice')?.classList.remove('active');
      document.getElementById('modalMaintenance')?.classList.remove('active');
    }
  });
})();
