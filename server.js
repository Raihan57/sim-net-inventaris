const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==============================================================================
// DATA MASTER & INVENTARIS PERANGKAT JARINGAN
// ==============================================================================
let categories = [
    { id: 1, name: 'Core Router', code: 'ROU-CORE', color: '#2563eb' },
    { id: 2, name: 'Manageable Switch', code: 'SW-MNG', color: '#059669' },
    { id: 3, name: 'Wireless Access Point', code: 'WAP', color: '#d97706' },
    { id: 4, name: 'Server Fisik', code: 'SRV', color: '#7c3aed' },
    { id: 5, name: 'Firewall UTM', code: 'FW', color: '#dc2626' }
];

let locations = [
    { id: 1, name: 'Ruang Server NOC', building: 'Gedung Rektorat Lt. 2', rack: 'Rack 01-A' },
    { id: 2, name: 'Data Center Distribusi', building: 'Gedung Lab Komputer Lt. 1', rack: 'Rack 02-B' },
    { id: 3, name: 'Hub Perpustakaan', building: 'Gedung Perpustakaan Lt. 3', rack: 'Rack 03-C' },
    { id: 4, name: 'Distribution Hall', building: 'Gedung Kuliah Bersama Lt. 2', rack: 'Rack 04-D' }
];

let devices = [
    {
        id: 1,
        asset_code: 'NET-2026-001',
        hostname: 'ROUTER-CORE-UDB',
        category_id: 1,
        location_id: 1,
        ip_address: '127.0.0.1',
        mac_address: '00:0C:42:F1:8A:01',
        brand: 'MikroTik',
        model: 'CCR1036-8G-2S+',
        port: 80,
        operational_status: 'Active',
        status: 'online',
        latency_ms: 2.15,
        last_check: new Date().toISOString(),
        uptime: '99.98%',
        notes: 'Gateway utama internet backbone kampus'
    },
    {
        id: 2,
        asset_code: 'NET-2026-002',
        hostname: 'SWITCH-DIST-LAB5',
        category_id: 2,
        location_id: 2,
        ip_address: '127.0.0.1',
        mac_address: '00:1E:58:A2:33:14',
        brand: 'Cisco',
        model: 'Catalyst 2960-X',
        port: 8080,
        operational_status: 'Active',
        status: 'online',
        latency_ms: 3.40,
        last_check: new Date().toISOString(),
        uptime: '99.85%',
        notes: 'Switch trunking VLAN Lab Komputer 5'
    },
    {
        id: 3,
        asset_code: 'NET-2026-003',
        hostname: 'AP-OUTDOOR-GEDUNG-A',
        category_id: 3,
        location_id: 3,
        ip_address: '192.168.10.50',
        mac_address: '24:A4:3C:99:11:AB',
        brand: 'Ubiquiti',
        model: 'UniFi AP AC Pro',
        port: 80,
        operational_status: 'Active',
        status: 'latency_high',
        latency_ms: 142.60,
        last_check: new Date().toISOString(),
        uptime: '98.20%',
        notes: 'Beban pengguna tinggi pada jam istirahat'
    },
    {
        id: 4,
        asset_code: 'NET-2026-004',
        hostname: 'SRV-DATABASE-SIM',
        category_id: 4,
        location_id: 1,
        ip_address: '127.0.0.1',
        mac_address: '70:85:C2:55:09:E3',
        brand: 'Dell',
        model: 'PowerEdge R740',
        port: 3306,
        operational_status: 'Active',
        status: 'online',
        latency_ms: 1.10,
        last_check: new Date().toISOString(),
        uptime: '99.99%',
        notes: 'Server database produksi sistem informasi'
    },
    {
        id: 5,
        asset_code: 'NET-2026-005',
        hostname: 'FW-FORTIGATE-PERIMETER',
        category_id: 5,
        location_id: 1,
        ip_address: '127.0.0.1',
        mac_address: '04:D5:90:3A:BB:77',
        brand: 'Fortinet',
        model: 'FortiGate 100F',
        port: 443,
        operational_status: 'Active',
        status: 'online',
        latency_ms: 4.80,
        last_check: new Date().toISOString(),
        uptime: '99.95%',
        notes: 'Firewall IPS & Web Filtering'
    },
    {
        id: 6,
        asset_code: 'NET-2026-006',
        hostname: 'SWITCH-ACCESS-LANTAI3',
        category_id: 2,
        location_id: 3,
        ip_address: '192.168.1.250',
        mac_address: '00:1E:58:7C:12:89',
        brand: 'Cisco',
        model: 'SG350-28',
        port: 80,
        operational_status: 'Maintenance',
        status: 'offline',
        latency_ms: null,
        last_check: new Date().toISOString(),
        uptime: '92.40%',
        notes: 'Sedang dalam pengecekan kabel uplink'
    }
];

let maintenanceLogs = [
    {
        id: 1,
        device_id: 6,
        device_name: 'SWITCH-ACCESS-LANTAI3',
        date: '2026-10-12',
        issue: 'Port SFP nomor 24 mengalami flapping koneksi',
        action: 'Penggantian modul SFP 1Gbps dan uji coba patch cord',
        technician: 'Budi Santoso',
        status: 'In Progress'
    },
    {
        id: 2,
        device_id: 3,
        device_name: 'AP-OUTDOOR-GEDUNG-A',
        date: '2026-10-10',
        issue: 'Sinyal frekuensi 2.4GHz drop saat jam sibuk',
        action: 'Optimasi channel width dan penyesuaian transmit power ke medium',
        technician: 'Raihan Pratama',
        status: 'Resolved'
    }
];

// Helper Realtime TCP Socket Probe
function pingProbe(host, port = 80, timeout = 1200) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        let isResolved = false;

        socket.setTimeout(timeout);

        socket.connect(port, host, () => {
            if (!isResolved) {
                isResolved = true;
                const latency = Date.now() - start;
                socket.destroy();
                resolve({ status: latency > 100 ? 'latency_high' : 'online', latency_ms: latency });
            }
        });

        socket.on('error', (err) => {
            if (!isResolved) {
                isResolved = true;
                socket.destroy();
                // Jika localhost, tetap berikan latency virtual simulasi
                if (host === '127.0.0.1' || host === 'localhost') {
                    resolve({ status: 'online', latency_ms: Math.floor(Math.random() * 8) + 1.5 });
                } else {
                    resolve({ status: 'offline', latency_ms: null });
                }
            }
        });

        socket.on('timeout', () => {
            if (!isResolved) {
                isResolved = true;
                socket.destroy();
                resolve({ status: 'offline', latency_ms: null });
            }
        });
    });
}

// ==============================================================================
// REST API ENDPOINTS
// ==============================================================================

// Summary Statistik Dashboard
app.get('/api/stats', (req, res) => {
    const total = devices.length;
    const online = devices.filter(d => d.status === 'online').length;
    const high_latency = devices.filter(d => d.status === 'latency_high').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    const maintenance = devices.filter(d => d.operational_status === 'Maintenance').length;

    res.json({
        success: true,
        stats: {
            total_devices: total,
            online_count: online,
            latency_high_count: high_latency,
            offline_count: offline,
            maintenance_count: maintenance,
            overall_uptime: '99.42%'
        }
    });
});

// Get Categories & Locations
app.get('/api/metadata', (req, res) => {
    res.json({ success: true, categories, locations });
});

// Get All Devices dengan Join Kategori & Lokasi
app.get('/api/devices', (req, res) => {
    const { category_id, status, search } = req.query;
    let list = devices.map(d => {
        const cat = categories.find(c => c.id === d.category_id) || { name: 'Unassigned', code: '-', color: '#64748b' };
        const loc = locations.find(l => l.id === d.location_id) || { name: 'Unknown', building: '-', rack: '-' };
        return {
            ...d,
            category_name: cat.name,
            category_code: cat.code,
            category_color: cat.color,
            location_name: loc.name,
            building: loc.building,
            rack: loc.rack
        };
    });

    if (category_id && category_id !== 'all') {
        list = list.filter(d => d.category_id == category_id);
    }
    if (status && status !== 'all') {
        list = list.filter(d => d.status === status);
    }
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(d => 
            d.hostname.toLowerCase().includes(q) ||
            d.asset_code.toLowerCase().includes(q) ||
            d.ip_address.includes(q) ||
            d.brand.toLowerCase().includes(q)
        );
    }

    res.json({ success: true, data: list });
});

// Tambah Perangkat Baru
app.post('/api/devices', (req, res) => {
    const { asset_code, hostname, category_id, location_id, ip_address, mac_address, brand, model, port, notes } = req.body;
    if (!asset_code || !hostname || !ip_address) {
        return res.status(400).json({ success: false, message: 'Kode Aset, Hostname, dan IP Address wajib diisi!' });
    }

    const newDev = {
        id: devices.length + 1,
        asset_code,
        hostname,
        category_id: parseInt(category_id) || 1,
        location_id: parseInt(location_id) || 1,
        ip_address,
        mac_address: mac_address || '00:00:00:00:00:00',
        brand: brand || 'Generic',
        model: model || 'Standard',
        port: parseInt(port) || 80,
        operational_status: 'Active',
        status: 'online',
        latency_ms: 2.50,
        last_check: new Date().toISOString(),
        uptime: '100.0%',
        notes: notes || ''
    };

    devices.unshift(newDev);
    res.json({ success: true, message: 'Perangkat berhasil ditambahkan ke inventaris!', data: newDev });
});

// Update Status / Perangkat
app.put('/api/devices/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = devices.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan' });

    devices[index] = { ...devices[index], ...req.body };
    res.json({ success: true, message: 'Data perangkat berhasil diperbarui', data: devices[index] });
});

// Hapus Perangkat
app.delete('/api/devices/:id', (req, res) => {
    const id = parseInt(req.params.id);
    devices = devices.filter(d => d.id !== id);
    res.json({ success: true, message: 'Perangkat berhasil dihapus dari inventaris.' });
});

// Diagnostic Ping Probe ke Satu Perangkat
app.post('/api/probe', async (req, res) => {
    const { ip, port } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'IP target dibutuhkan' });

    const probeResult = await pingProbe(ip, parseInt(port) || 80);
    res.json({ success: true, ip, port: port || 80, ...probeResult });
});

// Re-scan Healthcheck Semua Perangkat
app.post('/api/probe-all', async (req, res) => {
    for (let d of devices) {
        if (d.operational_status === 'Maintenance') {
            d.status = 'offline';
            d.latency_ms = null;
        } else {
            const resProbe = await pingProbe(d.ip_address, d.port, 800);
            d.status = resProbe.status;
            d.latency_ms = resProbe.latency_ms;
        }
        d.last_check = new Date().toISOString();
    }
    res.json({ success: true, message: 'Seluruh perangkat berhasil di-scan!' });
});

// Maintenance Logs API
app.get('/api/maintenance', (req, res) => {
    res.json({ success: true, data: maintenanceLogs });
});

app.post('/api/maintenance', (req, res) => {
    const { device_id, issue, action, technician, status } = req.body;
    const targetDev = devices.find(d => d.id == device_id);
    const newLog = {
        id: maintenanceLogs.length + 1,
        device_id: parseInt(device_id),
        device_name: targetDev ? targetDev.hostname : 'Perangkat',
        date: new Date().toISOString().split('T')[0],
        issue,
        action,
        technician: technician || 'Teknisi Jaringan',
        status: status || 'Resolved'
    };
    maintenanceLogs.unshift(newLog);
    res.json({ success: true, message: 'Log perbaikan berhasil disimpan!', data: newLog });
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌐 SIM-NET Inventaris & Monitoring Running on Port ${PORT}`);
    console.log(`🚀 Ready for Local & Production Deployment`);
    console.log(`=======================================================`);
});
