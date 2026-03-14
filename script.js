// Auth Check
async function checkAuthAndInit(){
    console.log("Dashboard checking auth...");
    
    // Give Supabase a moment to pick up the session from localStorage if needed
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        console.log("Dashboard: No session found. Redirecting to login.");
        window.location.href = "login.html";
        return;
    }

    const user = session.user;
    currentUserEmail = user.email; // Global capture
    console.log("Dashboard: User authenticated:", user.phone || user.email);

    const role = sessionStorage.getItem('selectedRole');
    if (role === 'admin') {
        isAdmin = true;
        window.location.href = "admin.html";
        return;
    }

    console.log("Logged in user:", user.email)
    document.getElementById("logout-btn").style.display = "block";
    
    // Start the app
    loadSlots()
    setupRealtimeSubscription()
}

// Global user state
let currentUserEmail = null;
let isAdmin = false;
let remindedSlots = new Set();

checkAuthAndInit()

async function logout() {
    await supabaseClient.auth.signOut()
    window.location = "login.html"
}

// Global slots state
let slotsData = [];

// API Calls
async function loadSlots() {
    let { data, error } = await supabaseClient
        .from("slots")
        .select("*")
        .order("id", { ascending: true })

    if (error) {
        showToast("Error loading slots: " + error.message, "error");
        console.log(error)
        return
    }

    slotsData = data;
    renderDashboard();
}

let currentBookingSlot = null;

async function bookSlot(slotName) {
    currentBookingSlot = slotName;
    document.getElementById("target-slot-name").textContent = slotName;
    
    // Set minimum date/time to now
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
    
    const startInput = document.getElementById("start-time");
    const endInput = document.getElementById("end-time");
    
    startInput.min = localISOTime;
    endInput.min = localISOTime;
    
    document.getElementById("booking-modal").style.display = "flex";
}

function closeBookingModal() {
    document.getElementById("booking-modal").style.display = "none";
    currentBookingSlot = null;
    
    // Clear inputs
    document.getElementById("vehicle-number").value = "";
    document.getElementById("vehicle-type").value = "Car";
    document.getElementById("start-time").value = "";
    document.getElementById("end-time").value = "";
    
    // Reset min attributes
    document.getElementById("start-time").removeAttribute("min");
    document.getElementById("end-time").removeAttribute("min");
}

async function confirmBooking() {
    if (!currentBookingSlot) return;

    const vNumber = document.getElementById("vehicle-number").value.trim();
    const vType = document.getElementById("vehicle-type").value;
    const startTimeStr = document.getElementById("start-time").value;
    const endTimeStr = document.getElementById("end-time").value;
    const btn = document.getElementById("confirm-booking-btn");

    if (!vNumber || !startTimeStr || !endTimeStr) {
        showToast("Please fill in all booking details", "error");
        return;
    }

    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    const now = new Date();

    // Validation
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        showToast("Invalid date format selected.", "error");
        return;
    }

    if (start.getTime() < now.getTime() - (5 * 60 * 1000)) {
        showToast(`Start time cannot be in the past.`, "error");
        return;
    }

    if (end.getTime() <= start.getTime()) {
        showToast(`End time must be later than Start time.`, "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Booking...';

    const partsStart = startTimeStr.split(/[-T :]/);
    const partsEnd = endTimeStr.split(/[-T :]/);
    
    const startObj = new Date(partsStart[0], partsStart[1]-1, partsStart[2], partsStart[3] || 0, partsStart[4] || 0);
    const endObj = new Date(partsEnd[0], partsEnd[1]-1, partsEnd[2], partsEnd[3] || 0, partsEnd[4] || 0);

    const startTimeISO = startObj.toISOString();
    const endTimeISO = endObj.toISOString();

    const durationMs = endObj.getTime() - startObj.getTime();
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
    
    let hourlyRate = 50; 
    if (vType === 'Bike') hourlyRate = 20;
    else if (vType === 'Truck') hourlyRate = 100;
    
    const totalAmount = durationHours * hourlyRate;

    let { error } = await supabaseClient
        .from("slots")
        .update({ 
            status: "booked",
            vehicle: vNumber,
            vehicle_type: vType,
            start_time: startTimeISO,
            end_time: endTimeISO,
            user_email: currentUserEmail,
            fine_amount: 0,
            fine_start_time: null
        })
        .eq("slot", currentBookingSlot);

    btn.disabled = false;
    btn.textContent = "Confirm";

    if (error) {
        showToast("Failed to book slot: " + error.message, "error");
    } else {
        showToast(`Slot ${currentBookingSlot} reserved! Redirecting...`, "success");
        setTimeout(() => {
            const queryParams = new URLSearchParams({
                slot: currentBookingSlot,
                amount: totalAmount,
                vehicle: vType,
                duration: durationHours,
                vNumber: vNumber,
                start: startTimeISO,
                end: endTimeISO
            }).toString();
            window.location.href = `payment.html?${queryParams}`;
        }, 1500);
    }
}

function getFineAmount(slot) {
    if (slot.status !== "booked" || !slot.end_time) return 0;
    const expiry = parseSafeDate(slot.end_time);
    const now = new Date();
    const diff = now.getTime() - expiry.getTime();
    if (diff <= 1000) return 0;
    const lateMinutes = Math.max(1, Math.ceil(diff / (1000 * 60)));
    return lateMinutes * 2; 
}

function safeToast(msg, type) {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        alert(`${type.toUpperCase()}: ${msg}`);
    }
}

async function freeSlot(slotName) {
    try {
        const slot = slotsData.find(s => s.slot === slotName);
        if (!slot) return;

        const currentFine = getFineAmount(slot);

        if (currentFine > 0) {
            if (confirm(`You have a pending fine of ₹${currentFine}. Pay now?`)) {
                const queryParams = new URLSearchParams({
                    slot: slotName,
                    amount: currentFine,
                    vehicle: slot.vehicle_type,
                    duration: 0,
                    type: 'fine'
                }).toString();
                window.location.href = `payment.html?${queryParams}`;
            }
            return;
        }

        if (!isAdmin && slot.user_email !== currentUserEmail) {
            safeToast("You can only free your own slots.", "error");
            return;
        }

        if (!confirm(`Release slot ${slotName}?`)) return;

        let { error } = await supabaseClient
            .from("slots")
            .update({ 
                status: "available",
                vehicle: null,
                vehicle_type: null,
                start_time: null,
                end_time: null,
                user_email: null,
                fine_amount: 0,
                fine_start_time: null
            })
            .eq("slot", slotName);

        if (error) {
            safeToast("Failed to empty slot", "error");
        } else {
            safeToast(`Slot ${slotName} is now available`, "success");
            remindedSlots.delete(slotName);
        }
    } catch (err) {
        console.error("Fatal error in freeSlot:", err);
    }
}

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

async function checkExpiredBookings() {
    const now = new Date();
    for (const slot of slotsData) {
        if (slot.status === "booked" && slot.end_time) {
            const expiry = parseSafeDate(slot.end_time);
            if (!expiry) continue;
            const diff = expiry.getTime() - now.getTime();
            if (diff > 0 && diff <= 5 * 60 * 1000 && !remindedSlots.has(slot.slot)) {
                if (slot.user_email === currentUserEmail) {
                    showToast(`Slot ${slot.slot} expires in 5 minutes!`, "info");
                }
                remindedSlots.add(slot.slot);
            }
            if (diff < 0) {
                const lateMinutes = Math.floor(Math.abs(diff) / (1000 * 60));
                const currentFine = lateMinutes * 2;
                if (currentFine !== slot.fine_amount) {
                    await supabaseClient
                        .from("slots")
                        .update({ 
                            fine_amount: currentFine,
                            fine_start_time: slot.fine_start_time || slot.end_time
                        })
                        .eq("slot", slot.slot);
                }
            }
        }
    }
}

setInterval(checkExpiredBookings, 10000);

function renderDashboard() {
    const data = slotsData;
    let output = ""
    let total = data.length
    let available = 0
    let booked = 0

    data.forEach(slot => {
        const isOwner = slot.user_email === currentUserEmail;
        const expiry = parseSafeDate(slot.end_time);
        const now = new Date();
        const diff = expiry ? expiry.getTime() - now.getTime() : 0;
        const isNearExpiry = diff > 0 && diff <= 5 * 60 * 1000;
        const isOverstay = diff < 0 && slot.status === "booked";
        const currentFine = getFineAmount(slot);

        if(slot.status === "available"){
            available++
            output += `<div class="slot available glass-effect" onclick="bookSlot('${slot.slot}')" style="animation: scaleIn 0.5s ease backwards; animation-delay: ${0.1 + (available * 0.05)}s;">
                <span class="slot-name">${slot.slot}</span>
                <span class="slot-status">Available</span>
            </div>`
        } else {
            booked++
            const fineDisplay = currentFine > 0 ? `<div class="fine-badge">Fine: ₹${currentFine}</div>` : "";
            const statusText = isOverstay ? "Overstay ⚠" : "Booked";
            const warningText = isNearExpiry ? `<div class="reminder-warning">5 mins remaining</div>` : "";
            
            let statusClass = "";
            if (isOverstay || isNearExpiry) {
                statusClass = "status-warning";
                if (isOverstay) statusClass += " status-overstay";
            }

            const actionBtn = (isOwner || isAdmin) ? 
                (isOverstay ? 
                    `<button class="btn-pay-fine" onclick="freeSlot('${slot.slot}')">Pay Fine & Leave</button>` : 
                    `<button class="btn-cancel" onclick="freeSlot('${slot.slot}')">Leave Slot</button>`
                ) : "";

            output += `<div class="slot booked glass-effect ${statusClass}" style="animation: scaleIn 0.5s ease backwards; animation-delay: ${0.1 + (booked * 0.05)}s;">
                <span class="slot-name">${slot.slot}</span>
                <span class="slot-status">${statusText}</span>
                <div class="slot-details">
                    <span class="vehicle-no">${slot.vehicle || ""}</span>
                    ${fineDisplay}
                    ${warningText}
                </div>
                ${actionBtn}
            </div>`
        }
    })

    document.getElementById("parking").innerHTML = output

    document.getElementById("stats").innerHTML = `
        <div class="card total glass-effect card-total">
            <div class="card-icon">🅿️</div>
            <div class="card-info">
                <h3>Total Slots</h3>
                <p class="slot-count">${total}</p>
            </div>
        </div>
        <div class="card glass-effect card-available">
            <div class="card-icon">🟢</div>
            <div class="card-info">
                <h3>Available</h3>
                <p class="slot-count">${available}</p>
            </div>
        </div>
        <div class="card glass-effect card-booked">
            <div class="card-icon">🔴</div>
            <div class="card-info">
                <h3>Booked</h3>
                <p class="slot-count">${booked}</p>
            </div>
        </div>
    `
}

function setupRealtimeSubscription() {
    supabaseClient
        .channel('public:slots')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => { loadSlots() })
        .subscribe()
}