const db = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

let registrations = [];
let currentRegistration = null;

const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const secretInput = document.getElementById("secretInput");
const registrationsList = document.getElementById("registrationsList");
const detailModal = document.getElementById("detailModal");
const detailContent = document.getElementById("detailContent");
const confirmDeleteModal = document.getElementById("confirmDeleteModal");
const adminNotification = document.getElementById("adminNotification");
let notificationTimeout;

document.getElementById("adminLogo").src = CONFIG.logoUrl;

if (localStorage.getItem("rle_admin_login") === "true") {
  showDashboard();
}

function loginAdmin() {
  if (secretInput.value === CONFIG.secretKey) {
    localStorage.setItem("rle_admin_login", "true");
    showDashboard();
  } else {
    showNotification("Secret key salah.", "error");
  }
}

function showNotification(message, type = "success") {
  clearTimeout(notificationTimeout);
  adminNotification.textContent = message;
  adminNotification.dataset.type = type;
  adminNotification.classList.remove("hidden");
  notificationTimeout = setTimeout(() => {
    adminNotification.classList.add("hidden");
  }, 5000);
}

function logoutAdmin() {
  localStorage.removeItem("rle_admin_login");
  location.reload();
}

async function showDashboard() {
  loginBox.classList.add("hidden");
  dashboard.classList.remove("hidden");
  await loadRegistrations();
}

async function loadRegistrations() {
  const { data, error } = await db
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showNotification("Gagal mengambil data: " + error.message, "error");
    return;
  }

  registrations = data || [];
  updateStats();
  renderRegistrations();
}

function updateStats() {
  document.getElementById("totalCount").textContent = registrations.length;
  document.getElementById("pendingCount").textContent =
    registrations.filter((x) => x.status === "pending").length;
  document.getElementById("approvedCount").textContent =
    registrations.filter((x) => x.status === "approved").length;
  document.getElementById("rejectedCount").textContent =
    registrations.filter((x) => x.status === "rejected").length;
}

function renderRegistrations() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const filter = document.getElementById("filterStatus").value;

  let filtered = registrations.filter((item) => {
    const matchSearch =
      item.full_name.toLowerCase().includes(search) ||
      item.whatsapp.toLowerCase().includes(search) ||
      item.toe_nick.toLowerCase().includes(search);

    const matchStatus = filter === "all" || item.status === filter;

    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    registrationsList.innerHTML = `
      <div class="registration-card glass">
        <div>
          <h3>Belum ada data</h3>
          <p>Pendaftar belum ditemukan.</p>
        </div>
      </div>
    `;
    return;
  }

  registrationsList.innerHTML = filtered
    .map(
      (item) => `
        <div class="registration-card glass">
          <div>
            <h3>${item.full_name}</h3>
            <p>${item.toe_nick} • ${item.city}</p>
          </div>

          <div>
            <p>${item.whatsapp}</p>
          </div>

          <span class="status ${item.status}">
            ${item.status}
          </span>

          <button class="view-btn" onclick="openDetail('${item.id}')">
            Lihat
          </button>
        </div>
      `
    )
    .join("");
}

function openDetail(id) {
  currentRegistration = registrations.find((item) => item.id === id);
  if (!currentRegistration) return;

  detailContent.innerHTML = `
    <div class="detail-item"><small>Nama Lengkap</small><b>${currentRegistration.full_name}</b></div>
    <div class="detail-item"><small>Nama Panggilan</small><b>${currentRegistration.nick_name}</b></div>
    <div class="detail-item"><small>Umur</small><b>${currentRegistration.age}</b></div>
    <div class="detail-item"><small>WhatsApp</small><b>${currentRegistration.whatsapp}</b></div>
    <div class="detail-item"><small>Email</small><b>${currentRegistration.email || "-"}</b></div>
    <div class="detail-item"><small>Kota Asal</small><b>${currentRegistration.city}</b></div>
    <div class="detail-item"><small>Nickname TOE3</small><b>${currentRegistration.toe_nick}</b></div>
    <div class="detail-item"><small>Username Discord</small><b>${currentRegistration.toe_uid}</b></div>
    <div class="detail-item"><small>Alasan Bergabung</small><b>${currentRegistration.reason}</b></div>
    <div class="detail-item"><small>Status</small><b>${currentRegistration.status}</b></div>
  `;

  detailModal.classList.remove("hidden");
}

function closeModal() {
  detailModal.classList.add("hidden");
}

async function updateStatus(status) {
  if (!currentRegistration) return false;

  const { error } = await db
    .from("registrations")
    .update({ status })
    .eq("id", currentRegistration.id);

  if (error) {
    showNotification("Gagal update status: " + error.message, "error");
    return false;
  }

  currentRegistration.status = status;

  const index = registrations.findIndex((x) => x.id === currentRegistration.id);
  if (index !== -1) registrations[index].status = status;

  updateStats();
  renderRegistrations();
  openDetail(currentRegistration.id);
  return true;
}

async function approveCurrent() {
  if (!currentRegistration) return;

  const { error } = await db
    .from("registrations")
    .update({ status: "approved" })
    .eq("id", currentRegistration.id);

  if (error) {
    showNotification("Gagal approve: " + error.message, "error");
    return;
  }

  currentRegistration.status = "approved";

  const message = `Halo ${currentRegistration.full_name} 👋

Selamat! Pendaftaran Anda di komunitas resmi PT. Rans Logistik Europe telah disetujui.

Silakan bergabung melalui grup berikut:
${CONFIG.waGroupLink}

Selamat bergabung dan semoga betah bersama keluarga besar PT. RLE 🚛✨

Fahrizal,
Admin PT. RLE`;

  const waLink = `https://api.whatsapp.com/send?phone=${currentRegistration.whatsapp}&text=${encodeURIComponent(message)}`;

  showNotification("Berhasil approve. Tombol WhatsApp tersedia di detail pendaftar.");

  detailContent.insertAdjacentHTML("beforeend", `
    <a href="${waLink}" target="_blank" class="whatsapp-btn" style="display:block;margin-top:16px;">
      📩 Kirim WhatsApp Sekarang
    </a>
  `);

  await loadRegistrations();
}

async function rejectCurrent() {
  if (!currentRegistration || !(await updateStatus("rejected"))) return;

  showNotification("Pendaftaran berhasil ditolak.");
}

async function deleteCurrent() {
  if (!currentRegistration) return;

  confirmDeleteModal.classList.remove("hidden");
}

function cancelDelete() {
  confirmDeleteModal.classList.add("hidden");
}

async function confirmDelete() {
  if (!currentRegistration) return;

  const { error } = await db
    .from("registrations")
    .delete()
    .eq("id", currentRegistration.id);

  cancelDelete();

  if (error) {
    showNotification("Gagal hapus data: " + error.message, "error");
    return;
  }

  registrations = registrations.filter((x) => x.id !== currentRegistration.id);

  closeModal();
  updateStats();
  renderRegistrations();
  currentRegistration = null;
  showNotification("Data pendaftar berhasil dihapus.");
}