// Auth Check tailored for Admin
async function checkAuthAndInitAdmin(){
    console.log("Admin Dashboard checking auth...");
    
    // Explicitly parse the OAuth hash fragment before checking user
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        console.log("Admin Dashboard: No session. Redirecting to login.");
        window.location.href = "login.html";
        return;
    }

    const { user } = session;
    console.log("Admin Dashboard: User authenticated:", user.phone || user.email);

    const role = sessionStorage.getItem('selectedRole');
    console.log("Admin Dashboard: Role in session:", role);

    if(role !== 'admin') {
        console.warn("Admin Dashboard: Access denied. Redirecting to user index.");
        showToast("Access Denied: You do not have admin privileges.", "error");
        setTimeout(() => {
            window.location = "index.html";
        }, 2000);
        return;
    }

    console.log("Logged in admin:", user.phone)
    document.getElementById("logout-btn").style.display = "block";
    document.getElementById("view-live-btn").style.display = "block";
    
    // Start the app
    loadAdminSlots()
    setupRealtimeSubscriptionAdmin()
}

checkAuthAndInitAdmin()

async function logout() {
    await supabaseClient.auth.signOut()
    sessionStorage.removeItem('selectedRole');
    window.location = "login.html"
}

// State
let adminSlots = [];

function parseSafeDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.endsWith('Z') || dateStr.includes('+')) {
        return new Date(dateStr);
    }
    const parts = dateStr.split(/[-T :]/);
    if (parts.length >= 5) {
        return new Date(Date.UTC(parts[0], parts[1]-1, parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0));
    }
    return new Date(dateStr);
}

// Fetch Slots
async function loadAdminSlots() {
    let { data, error } = await supabaseClient
        .from("slots")
        .select("*")
        .order("id", { ascending: true })

    if (error) {
        showToast("Error loading slots: " + error.message, "error");
        return
    }

    adminSlots = data;
    renderAdminTable();
}

// Render Table
function renderAdminTable() {
    const tbody = document.getElementById("admin-table-body");
    if (adminSlots.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 20px;">No slots found.</td></tr>`;
        return;
    }

    let output = "";
    adminSlots.forEach(slot => {
        const badgeClass = slot.status === 'available' ? 'badge-success' : 'badge-danger';
        const displayStatus = slot.status.charAt(0).toUpperCase() + slot.status.slice(1);
        
        let userInfo = `<span style="color: var(--text-secondary); font-size: 13px;">N/A</span>`;
        if (slot.status === 'booked' && slot.vehicle) {
            userInfo = `<button class="btn btn-outline btn-sm" onclick='showBookingDetails(${slot.id})'>Details</button>`;
        }

        output += `
            <tr>
                <td style="color: var(--text-secondary)">#${slot.id}</td>
                <td style="font-weight: 600; font-size: 16px;">${slot.slot}</td>
                <td><span class="status-badge ${badgeClass}">${displayStatus}</span></td>
                <td>${userInfo}</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn btn-outline btn-sm" onclick="openEditModal(${slot.id}, '${slot.slot}', '${slot.status}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSlot(${slot.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = output;
}

// --- Modals & CRUD ---
function openAddModal() {
    document.getElementById('modal-title').innerText = "Add New Slot";
    document.getElementById('modal-mode').value = "add";
    document.getElementById('modal-slot-id').value = "";
    document.getElementById('modal-slot-name').value = "";
    document.getElementById('modal-slot-status').value = "available";
    toggleAdminBookingFields();
    document.getElementById('slot-modal').style.display = "flex";
}

function openEditModal(id, name, status) {
    document.getElementById('modal-title').innerText = "Edit Slot";
    document.getElementById('modal-mode').value = "edit";
    document.getElementById('modal-slot-id').value = id;
    document.getElementById('modal-slot-name').value = name;
    document.getElementById('modal-slot-status').value = status;
    toggleAdminBookingFields();
    document.getElementById('slot-modal').style.display = "flex";
}

function toggleAdminBookingFields() {
    const status = document.getElementById('modal-slot-status').value;
    const fields = document.getElementById('admin-booking-fields');
    if (status === 'booked') fields.style.display = "block";
    else fields.style.display = "none";
}

function closeModal() {
    document.getElementById('slot-modal').style.display = "none";
}

function showBookingDetails(id) {
    const slot = adminSlots.find(s => s.id === id);
    if (!slot) return;
    const content = document.getElementById('details-content');
    const start = slot.start_time ? parseSafeDate(slot.start_time).toLocaleString() : "N/A";
    const end = slot.end_time ? parseSafeDate(slot.end_time).toLocaleString() : "N/A";

    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p style="font-size: 12px; color: var(--text-secondary);">User Email</p>
            <p style="font-weight: 600;">${slot.user_email || "N/A"}</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div><label style="font-size: 12px; color: var(--text-secondary);">Vehicle</label><p>${slot.vehicle}</p></div>
            <div><label style="font-size: 12px; color: var(--text-secondary);">Type</label><p>${slot.vehicle_type}</p></div>
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 15px;">
            <div style="margin-bottom: 10px;"><label style="font-size: 12px; color: var(--text-secondary);">Start</label><p>${start}</p></div>
            <div><label style="font-size: 12px; color: var(--text-secondary);">End</label><p>${end}</p></div>
        </div>
    `;
    document.getElementById('details-modal').style.display = "flex";
}

function closeDetailsModal() {
    document.getElementById('details-modal').style.display = "none";
}

async function saveSlot() {
    const mode = document.getElementById('modal-mode').value;
    const slotId = document.getElementById('modal-slot-id').value;
    const name = document.getElementById('modal-slot-name').value.trim();
    const status = document.getElementById('modal-slot-status').value;
    const btn = document.getElementById('save-slot-btn');

    if (!name) return showToast("Name required", "error");

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    const updates = { slot: name, status: status };
    if (status === 'available') {
        updates.vehicle = null;
        updates.vehicle_type = null;
        updates.start_time = null;
        updates.end_time = null;
        updates.user_email = null;
    }

    let error;
    if (mode === "add") {
        ({ error } = await supabaseClient.from('slots').insert([updates]));
    } else {
        ({ error } = await supabaseClient.from('slots').update(updates).eq('id', slotId));
    }

    btn.disabled = false;
    btn.textContent = "Save";

    if (error) showToast("Error: " + error.message, "error");
    else {
        showToast("Success!", "success");
        closeModal();
        loadAdminSlots();
    }
}

async function deleteSlot(id) {
    if (!confirm("Delete this slot?")) return;
    const { error } = await supabaseClient.from('slots').delete().eq('id', id);
    if (error) showToast("Error: " + error.message, "error");
    else loadAdminSlots();
}

function setupRealtimeSubscriptionAdmin() {
    supabaseClient.channel('public:admin_slots').on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => { loadAdminSlots() }).subscribe();
}

async function downloadCSVReport() {
    const { data } = await supabaseClient.from('slots').select('*').eq('status', 'booked');
    if (!data || data.length === 0) return showToast("No active bookings", "info");
    const csv = ["Slot,Vehicle,Type,User"].concat(data.map(r => `${r.slot},${r.vehicle},${r.vehicle_type},${r.user_email}`)).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ParkGrid_Report.csv";
    a.click();
}
