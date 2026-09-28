const STORAGE_KEY = "parcelflow.workspace.v1";
const SHIPMENT_STATUSES = ["Booked", "In Transit", "Out for Delivery", "Delivered", "Delayed", "Cancelled"];
const THEME_KEY = "parcelflow.theme";
const state = loadState();

function loadState() {
    const emptyState = { customers: [], shipments: [], agents: [], branches: [], updates: [], invoices: [] };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!saved || typeof saved !== "object") return emptyState;
        return Object.fromEntries(Object.keys(emptyState).map(key => [key, Array.isArray(saved[key]) ? saved[key] : []]));
    } catch (error) {
        console.warn("ParcelFlow could not read saved workspace data.", error);
        return emptyState;
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("ParcelFlow could not save workspace data.", error);
        return false;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function valueOf(id) {
    return document.getElementById(id).value.trim();
}

function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function notify(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.textContent = message;
    document.getElementById("toastRegion").append(toast);
    window.setTimeout(() => toast.remove(), 3600);
}

function showSection(sectionId) {
    const selected = document.getElementById(sectionId);
    if (!selected) return;
    document.querySelectorAll(".section").forEach(section => section.classList.toggle("active", section === selected));
    document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.section === sectionId));
    const sectionTitles = { dashboard: "Overview", shipments: "Shipments", customers: "Customers", agents: "Delivery agents", branches: "Branches", updates: "Delivery updates", invoice: "Invoices" };
    document.getElementById("breadcrumbTitle").textContent = sectionTitles[sectionId] || "Overview";
    closeMobileNav();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeMobileNav() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").classList.remove("active");
}

function statusBadge(status) {
    const className = String(status || "booked").toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "");
    return `<span class="status-badge status-${className}">${escapeHTML(status)}</span>`;
}

function emptyRow(message, columns) {
    return `<tr><td class="empty-row" colspan="${columns}">${escapeHTML(message)}</td></tr>`;
}

function renderCustomers() {
    const body = document.getElementById("customerTable");
    body.innerHTML = state.customers.length ? state.customers.map(customer => `
        <tr><td>#${customer.id}</td><td><strong>${escapeHTML(customer.name)}</strong></td><td>${escapeHTML(customer.email)}</td><td>${escapeHTML(customer.phone)}</td><td>${escapeHTML(customer.city)}</td><td><button class="action-button" data-delete="customers" data-id="${customer.id}" aria-label="Delete customer">Remove</button></td></tr>`).join("") : emptyRow("No customers yet — add your first customer above.", 6);
    document.getElementById("customerTotal").textContent = `${state.customers.length} customer${state.customers.length === 1 ? "" : "s"}`;
}

function renderShipments() {
    const query = document.getElementById("shipmentFilter").value.trim().toLowerCase();
    const filtered = [...state.shipments].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).filter(shipment =>
        [shipment.tracking, shipment.customer, shipment.source, shipment.destination, shipment.status].some(value => String(value || "").toLowerCase().includes(query))
    );
    document.getElementById("shipmentTable").innerHTML = filtered.length ? filtered.map(shipment => `
        <tr><td class="tracking-id">${escapeHTML(shipment.tracking)}</td><td>${escapeHTML(shipment.customer)}</td><td class="route-cell">${escapeHTML(shipment.source)} <span>→</span> ${escapeHTML(shipment.destination)}</td><td>${escapeHTML(shipment.weight)} kg</td><td>${statusBadge(shipment.status)}</td><td><button class="action-button" data-delete="shipments" data-id="${shipment.id}" aria-label="Delete shipment">Remove</button></td></tr>`).join("") : emptyRow(query ? "No shipments match your search." : "No shipments yet — create your first consignment above.", 6);
    const total = state.shipments.length;
    document.getElementById("shipmentTotal").textContent = query ? `${filtered.length} of ${total} shipments` : `${total} shipment${total === 1 ? "" : "s"}`;
    document.getElementById("navShipmentCount").textContent = total;
}

function renderAgents() {
    document.getElementById("agentTable").innerHTML = state.agents.length ? state.agents.map(agent => `
        <tr><td>#${agent.id}</td><td><strong>${escapeHTML(agent.name)}</strong></td><td>${escapeHTML(agent.email)}</td><td>${escapeHTML(agent.phone)}</td><td>${statusBadge(agent.status)}</td><td><button class="action-button" data-delete="agents" data-id="${agent.id}" aria-label="Remove agent">Remove</button></td></tr>`).join("") : emptyRow("No delivery agents added yet.", 6);
    document.getElementById("agentTotal").textContent = `${state.agents.length} agent${state.agents.length === 1 ? "" : "s"}`;
}

function renderBranches() {
    document.getElementById("branchTable").innerHTML = state.branches.length ? state.branches.map(branch => `
        <tr><td><strong>${escapeHTML(branch.name)}</strong></td><td class="tracking-id">${escapeHTML(branch.code)}</td><td>${escapeHTML(branch.city)}</td><td>${escapeHTML(branch.state)}</td><td><button class="action-button" data-delete="branches" data-id="${branch.id}" aria-label="Remove branch">Remove</button></td></tr>`).join("") : emptyRow("No branches yet — add a location to your network.", 5);
    document.getElementById("branchTotal").textContent = `${state.branches.length} branch${state.branches.length === 1 ? "" : "es"}`;
}

function formatDate(date) {
    if (!date) return "—";
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function renderUpdates() {
    const sorted = [...state.updates].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    document.getElementById("updateTable").innerHTML = sorted.length ? sorted.map(update => `
        <tr><td class="tracking-id">${escapeHTML(update.tracking)}</td><td>${statusBadge(update.status)}</td><td>${escapeHTML(update.remarks)}</td><td>${escapeHTML(formatDate(update.createdAt))}</td></tr>`).join("") : emptyRow("No delivery events yet. Updates will appear here.", 4);
    document.getElementById("updateTotal").textContent = `${state.updates.length} update${state.updates.length === 1 ? "" : "s"}`;
}

function renderInvoices() {
    document.getElementById("invoiceTable").innerHTML = state.invoices.length ? [...state.invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map(invoice => `
        <tr><td><strong>${escapeHTML(invoice.number)}</strong></td><td class="tracking-id">${escapeHTML(invoice.tracking)}</td><td>₹${Number(invoice.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>${statusBadge(invoice.payment)}</td><td><button class="action-button" data-delete="invoices" data-id="${invoice.id}" aria-label="Delete invoice">Remove</button></td></tr>`).join("") : emptyRow("No invoices yet — create one for a shipment above.", 5);
    document.getElementById("invoiceTotal").textContent = `${state.invoices.length} invoice${state.invoices.length === 1 ? "" : "s"}`;
}

function renderRecentShipments() {
    const recent = [...state.shipments].sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")).slice(0, 6);
    document.getElementById("recentShipments").innerHTML = recent.length ? recent.map(shipment => `
        <tr><td class="tracking-id">${escapeHTML(shipment.tracking)}</td><td>${escapeHTML(shipment.customer)}</td><td>${escapeHTML(shipment.destination)}</td><td>${statusBadge(shipment.status)}</td></tr>`).join("") : emptyRow("Your newest consignments will show up here.", 4);
}

function renderStatusBreakdown() {
    const counts = Object.fromEntries(SHIPMENT_STATUSES.map(status => [status, 0]));
    state.shipments.forEach(shipment => { counts[shipment.status] = (counts[shipment.status] || 0) + 1; });
    const total = state.shipments.length;
    document.getElementById("statusBreakdown").innerHTML = SHIPMENT_STATUSES.map(status => {
        const count = counts[status] || 0;
        const width = total ? Math.round(count / total * 100) : 0;
        const slug = status.toLowerCase().replace(/[^a-z]+/g, "-");
        return `<div class="status-line"><i class="status-color color-${slug}"></i><span>${escapeHTML(status)}</span><span class="status-number">${count}</span><div class="status-track"><span style="width:${width}%"></span></div></div>`;
    }).join("");
}

function updateDashboard() {
    const delivered = state.shipments.filter(shipment => shipment.status === "Delivered").length;
    const inTransit = state.shipments.filter(shipment => ["In Transit", "Out for Delivery"].includes(shipment.status)).length;
    const activeAgents = state.agents.filter(agent => agent.status === "Active").length;
    document.getElementById("customerCount").textContent = state.customers.length;
    document.getElementById("shipmentCount").textContent = state.shipments.length;
    document.getElementById("agentCount").textContent = activeAgents;
    document.getElementById("deliveredCount").textContent = delivered;
    document.getElementById("transitCount").textContent = inTransit;
    document.getElementById("deliveryRate").textContent = state.shipments.length ? `${Math.round(delivered / state.shipments.length * 100)}%` : "0%";
    renderRecentShipments();
    renderStatusBreakdown();
}

function renderAll() {
    renderCustomers();
    renderShipments();
    renderAgents();
    renderBranches();
    renderUpdates();
    renderInvoices();
    updateDashboard();
}

function addCustomer(event) {
    event.preventDefault();
    const email = valueOf("customerEmail");
    if (state.customers.some(customer => customer.email.toLowerCase() === email.toLowerCase())) {
        notify("A customer with that email address already exists.", true);
        document.getElementById("customerEmail").focus();
        return;
    }
    state.customers.push({ id: nextId(state.customers), name: valueOf("customerName"), email, phone: valueOf("customerPhone"), city: valueOf("customerCity"), createdAt: new Date().toISOString() });
    event.currentTarget.reset();
    commit("Customer added to your directory.");
}

function addShipment(event) {
    event.preventDefault();
    const tracking = valueOf("tracking");
    if (state.shipments.some(shipment => shipment.tracking.toLowerCase() === tracking.toLowerCase())) {
        notify("That tracking number is already in use.", true);
        document.getElementById("tracking").focus();
        return;
    }
    const now = new Date().toISOString();
    const shipment = { id: nextId(state.shipments), tracking, customer: valueOf("shipmentCustomer"), source: valueOf("source"), destination: valueOf("destination"), weight: Number(valueOf("weight")), status: valueOf("shipmentStatus"), createdAt: now, updatedAt: now };
    state.shipments.push(shipment);
    state.updates.push({ id: nextId(state.updates), tracking, status: shipment.status, remarks: "Shipment created", createdAt: now });
    event.currentTarget.reset();
    commit(`Shipment ${tracking} created successfully.`);
}

function addAgent(event) {
    event.preventDefault();
    const email = valueOf("agentEmail");
    if (state.agents.some(agent => agent.email.toLowerCase() === email.toLowerCase())) {
        notify("A delivery agent with that email address already exists.", true);
        document.getElementById("agentEmail").focus();
        return;
    }
    state.agents.push({ id: nextId(state.agents), name: valueOf("agentName"), email, phone: valueOf("agentPhone"), status: valueOf("agentStatus"), createdAt: new Date().toISOString() });
    event.currentTarget.reset();
    commit("Delivery agent added to your team.");
}

function addBranch(event) {
    event.preventDefault();
    const code = valueOf("branchCode");
    if (state.branches.some(branch => branch.code.toLowerCase() === code.toLowerCase())) {
        notify("A branch with that code already exists.", true);
        document.getElementById("branchCode").focus();
        return;
    }
    state.branches.push({ id: nextId(state.branches), name: valueOf("branchName"), code, city: valueOf("branchCity"), state: valueOf("branchState"), createdAt: new Date().toISOString() });
    event.currentTarget.reset();
    commit("Branch added to your network.");
}

function addUpdate(event) {
    event.preventDefault();
    const tracking = valueOf("updateTracking");
    const shipment = state.shipments.find(item => item.tracking.toLowerCase() === tracking.toLowerCase());
    if (!shipment) {
        notify("No shipment found with that tracking number.", true);
        document.getElementById("updateTracking").focus();
        return;
    }
    const now = new Date().toISOString();
    const status = valueOf("updateStatus");
    shipment.status = status === "Delayed" ? "Delayed" : status;
    shipment.updatedAt = now;
    state.updates.push({ id: nextId(state.updates), tracking: shipment.tracking, status, remarks: valueOf("remarks"), createdAt: now });
    event.currentTarget.reset();
    commit(`Tracking updated: ${shipment.tracking} is ${status.toLowerCase()}.`);
}

function addInvoice(event) {
    event.preventDefault();
    const number = valueOf("invoiceNumber");
    const tracking = valueOf("invoiceTracking");
    if (state.invoices.some(invoice => invoice.number.toLowerCase() === number.toLowerCase())) {
        notify("That invoice number is already in use.", true);
        document.getElementById("invoiceNumber").focus();
        return;
    }
    if (!state.shipments.some(shipment => shipment.tracking.toLowerCase() === tracking.toLowerCase())) {
        notify("Create a shipment with this tracking number before invoicing it.", true);
        document.getElementById("invoiceTracking").focus();
        return;
    }
    state.invoices.push({ id: nextId(state.invoices), number, tracking, amount: Number(valueOf("invoiceAmount")), payment: valueOf("paymentStatus"), createdAt: new Date().toISOString() });
    event.currentTarget.reset();
    commit(`Invoice ${number} created successfully.`);
}

function commit(message) {
    const saved = saveState();
    renderAll();
    notify(saved ? message : "Changes are visible for now, but could not be saved. Check browser storage settings.", !saved);
}

function lookupParcel(tracking) {
    const cleanTracking = tracking.trim();
    if (!cleanTracking) return;
    const shipment = state.shipments.find(item => item.tracking.toLowerCase() === cleanTracking.toLowerCase());
    if (!shipment) {
        notify(`No parcel found for ${cleanTracking}. Check the tracking ID and try again.`, true);
        return;
    }
    showSection("dashboard");
    const latestUpdate = [...state.updates].filter(update => update.tracking.toLowerCase() === shipment.tracking.toLowerCase()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
    notify(`${shipment.tracking}: ${shipment.status}${latestUpdate?.remarks ? ` — ${latestUpdate.remarks}` : ""}`);
}

function deleteRecord(collection, id) {
    const numericId = Number(id);
    const record = state[collection].find(item => Number(item.id) === numericId);
    if (!record) return;
    if (collection === "shipments") {
        state.updates = state.updates.filter(update => update.tracking.toLowerCase() !== record.tracking.toLowerCase());
        state.invoices = state.invoices.filter(invoice => invoice.tracking.toLowerCase() !== record.tracking.toLowerCase());
    }
    state[collection] = state[collection].filter(item => Number(item.id) !== numericId);
    commit(collection === "shipments" ? "Shipment and its linked events and invoices removed." : "Record removed successfully.");
}

function exportShipments() {
    if (!state.shipments.length) {
        notify("There are no shipments to export yet.", true);
        return;
    }
    const rows = [["Tracking ID", "Customer", "Origin", "Destination", "Weight (kg)", "Status", "Created"]];
    state.shipments.forEach(item => rows.push([item.tracking, item.customer, item.source, item.destination, item.weight, item.status, formatDate(item.createdAt)]));
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `parcelflow-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Shipment CSV exported.");
}

function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    const button = document.getElementById("themeToggle");
    button.textContent = isDark ? "☀" : "☾";
    button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    button.title = `Switch to ${isDark ? "light" : "dark"} mode`;
    try {
        localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {
        console.warn("ParcelFlow could not save the theme preference.", error);
    }
}

function loadDemoData() {
    const hasData = Object.values(state).some(collection => collection.length > 0);
    if (hasData && !window.confirm("Your workspace already has data. Add the sample records too?")) return;
    const stamp = Date.now();
    const ago = minutes => new Date(stamp - minutes * 60000).toISOString();
    const sampleShipments = [
        { tracking: "PF-24091", customer: "Ananya Sharma", source: "Chennai", destination: "Bengaluru", weight: 2.4, status: "In Transit", minutes: 32 },
        { tracking: "PF-24092", customer: "Rahul Mehta", source: "Mumbai", destination: "Pune", weight: 1.2, status: "Out for Delivery", minutes: 68 },
        { tracking: "PF-24093", customer: "Diya Patel", source: "Ahmedabad", destination: "Jaipur", weight: 4.1, status: "Delivered", minutes: 140 },
        { tracking: "PF-24094", customer: "Arjun Nair", source: "Kochi", destination: "Hyderabad", weight: 0.8, status: "Booked", minutes: 205 },
        { tracking: "PF-24095", customer: "Mira Iyer", source: "Delhi", destination: "Lucknow", weight: 3.6, status: "Delayed", minutes: 265 }
    ];
    sampleShipments.forEach((sample, index) => {
        if (state.shipments.some(item => item.tracking.toLowerCase() === sample.tracking.toLowerCase())) return;
        const createdAt = ago(sample.minutes);
        const shipment = { id: nextId(state.shipments), tracking: sample.tracking, customer: sample.customer, source: sample.source, destination: sample.destination, weight: sample.weight, status: sample.status, createdAt, updatedAt: createdAt };
        state.shipments.push(shipment);
        state.updates.push({ id: nextId(state.updates), tracking: shipment.tracking, status: shipment.status, remarks: ["Parcel processed at origin hub", "Courier is on the way", "Successfully handed to recipient", "Shipment booked and awaiting pickup", "Weather delay reported on route"][index], createdAt });
    });
    if (!state.customers.length) {
        state.customers.push(
            { id: nextId(state.customers), name: "Ananya Sharma", email: "ananya@example.com", phone: "+91 98765 43210", city: "Chennai", createdAt: ago(300) },
            { id: nextId(state.customers), name: "Rahul Mehta", email: "rahul@example.com", phone: "+91 98765 43211", city: "Mumbai", createdAt: ago(280) },
            { id: nextId(state.customers), name: "Diya Patel", email: "diya@example.com", phone: "+91 98765 43212", city: "Ahmedabad", createdAt: ago(260) }
        );
    }
    if (!state.agents.length) {
        state.agents.push(
            { id: nextId(state.agents), name: "Kiran Kumar", email: "kiran@example.com", phone: "+91 98765 41001", status: "Active" },
            { id: nextId(state.agents), name: "Sana Khan", email: "sana@example.com", phone: "+91 98765 41002", status: "Active" },
            { id: nextId(state.agents), name: "Vikram Rao", email: "vikram@example.com", phone: "+91 98765 41003", status: "On Leave" }
        );
    }
    if (!state.branches.length) {
        state.branches.push(
            { id: nextId(state.branches), name: "Central Hub", code: "CHN-01", city: "Chennai", state: "Tamil Nadu" },
            { id: nextId(state.branches), name: "West Point", code: "MUM-02", city: "Mumbai", state: "Maharashtra" },
            { id: nextId(state.branches), name: "South Gateway", code: "BLR-03", city: "Bengaluru", state: "Karnataka" }
        );
    }
    if (!state.invoices.length) {
        state.invoices.push(
            { id: nextId(state.invoices), number: "INV-2026-001", tracking: "PF-24091", amount: 680, payment: "Paid", createdAt: ago(25) },
            { id: nextId(state.invoices), number: "INV-2026-002", tracking: "PF-24092", amount: 420, payment: "Pending", createdAt: ago(20) }
        );
    }
    commit("Sample workspace loaded — explore the dashboard and modules.");
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showSection(button.dataset.section)));
document.querySelector(".brand").addEventListener("click", event => {
    event.preventDefault();
    showSection("dashboard");
});
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showSection(button.dataset.go)));
document.getElementById("customerForm").addEventListener("submit", addCustomer);
document.getElementById("shipmentForm").addEventListener("submit", addShipment);
document.getElementById("agentForm").addEventListener("submit", addAgent);
document.getElementById("branchForm").addEventListener("submit", addBranch);
document.getElementById("updateForm").addEventListener("submit", addUpdate);
document.getElementById("invoiceForm").addEventListener("submit", addInvoice);
document.getElementById("shipmentFilter").addEventListener("input", renderShipments);
document.getElementById("trackForm").addEventListener("submit", event => {
    event.preventDefault();
    lookupParcel(valueOf("trackingLookup"));
});
document.getElementById("globalSearch").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        lookupParcel(event.currentTarget.value);
    }
});
document.getElementById("exportShipments").addEventListener("click", exportShipments);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("loadDemoData").addEventListener("click", loadDemoData);
document.body.addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (button) deleteRecord(button.dataset.delete, button.dataset.id);
});
document.getElementById("mobileMenu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("scrim").classList.toggle("active");
});
document.getElementById("scrim").addEventListener("click", closeMobileNav);
document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("globalSearch").focus();
    }
    if (event.key === "Escape") closeMobileNav();
});
window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
        Object.assign(state, loadState());
        renderAll();
        notify("Workspace refreshed from another open tab.");
    }
});

document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat([], { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
document.getElementById("yearNow").textContent = new Date().getFullYear();
if (localStorage.getItem(THEME_KEY) === "dark") {
    document.body.classList.add("dark-theme");
    document.getElementById("themeToggle").textContent = "☀";
    document.getElementById("themeToggle").setAttribute("aria-label", "Switch to light mode");
    document.getElementById("themeToggle").title = "Switch to light mode";
}
renderAll();