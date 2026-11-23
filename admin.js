const db = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

let registrations = [];
let currentRegistration = null;

const loginBox = document.getElementById("loginBox");
const loginForm = document.getElementById("loginForm");
const dashboard = document.getElementById("dashboard");
const registrationsList = document.getElementById("registrationsList");
const detailModal = document.getElementById("detailModal");
const detailContent = document.getElementById("detailContent");
const confirmDeleteModal = document.getElementById("confirmDeleteModal");
const adminNotification = document.getElementById("adminNotification");
let notificationTimeout;

document.getElementById("adminLogo").src = CONFIG.logoUrl;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
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

async function showDashboard(user) {
  const { data, error } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    await db.auth.signOut();
    loginBox.classList.remove("hidden");
    dashboard.classList.add("hidden");
    showNotification("Akun ini tidak memiliki akses Admin atau Manajemen.", "error");
    return;
  }

  loginBox.classList.add("hidden");
  dashboard.classList.remove("hidden");
  await loadRegistrations();
}

async function initializeAdmin() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    showNotification(`Gagal memeriksa sesi: ${error.message}`, "error");
    return;
  }

  if (data.session) {
    try {
      await showDashboard(data.session.user);
    } catch (sessionError) {
      console.error("Gagal memeriksa akses Admin.", sessionError);
      showNotification("Akses Admin gagal diverifikasi.", "error");
    }
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  button.disabled = true;

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showNotification(`Login gagal: ${error.message}`, "error");
    button.disabled = false;
    return;
  }

  try {
    await showDashboard(data.user);
    loginForm.reset();
  } catch (sessionError) {
    console.error("Gagal memeriksa hak akses Admin.", sessionError);
    await db.auth.signOut();
    showNotification("Hak akses tidak dapat diverifikasi.", "error");
  } finally {
    button.disabled = false;
  }
});

async function logoutAdmin() {
  const { error } = await db.auth.signOut();
  if (error) {
    showNotification(`Gagal logout: ${error.message}`, "error");
    return;
  }

  registrations = [];
  currentRegistration = null;
  loginBox.classList.remove("hidden");
  dashboard.classList.add("hidden");
  showNotification("Berhasil logout.");
}

async function loadRegistrations() {
  const { data, error } = await db
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showNotification(`Gagal mengambil data: ${error.message}`, "error");
    return;
  }

  registrations = data || [];
  updateStats();
  renderRegistrations();
}

function updateStats() {
  document.getElementById("totalCount").textContent = registrations.length;
  document.getElementById("pendingCount").textContent =
    registrations.filter((item) => item.status === "pending").length;
  document.getElementById("approvedCount").textContent =
    registrations.filter((item) => item.status === "approved").length;
  document.getElementById("rejectedCount").textContent =
    registrations.filter((item) => item.status === "rejected").length;
}

function renderRegistrations() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const filter = document.getElementById("filterStatus").value;

  const filtered = registrations.filter((item) => {
    const matchSearch = [
      item.full_name,
      item.whatsapp,
      item.toe_nick
    ].some((value) => String(value || "").toLowerCase().includes(search));

    return matchSearch && (filter === "all" || item.status === filter);
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
    .map((item) => `
      <div class="registration-card glass">
        <div>
          <h3>${escapeHtml(item.full_name)}</h3>
          <p>${escapeHtml(item.toe_nick)} • ${escapeHtml(item.city)}</p>
        </div>

        <div>
          <p>${escapeHtml(item.whatsapp)}</p>
        </div>

        <span class="status ${escapeHtml(item.status)}">
          ${escapeHtml(item.status)}
        </span>

        <button class="view-btn" data-registration-id="${escapeHtml(item.source_registration_id)}">
          Lihat
        </button>
      </div>
    `)
    .join("");
}

function openDetail(id) {
  currentRegistration = registrations.find((item) => item.source_registration_id === id);
  if (!currentRegistration) return;

  const fields = [
    ["Nama Lengkap", currentRegistration.full_name],
    ["Nama Panggilan", currentRegistration.nick_name],
    ["Umur", currentRegistration.age],
    ["WhatsApp", currentRegistration.whatsapp],
    ["Email", currentRegistration.email || "-"],
    ["Kota Asal", currentRegistration.city],
    ["Nickname TOE3", currentRegistration.toe_nick],
    ["Username Discord", currentRegistration.toe_uid],
    ["Alasan Bergabung", currentRegistration.reason],
    ["Status", currentRegistration.status]
  ];

  detailContent.innerHTML = fields
    .map(([label, value]) => `
      <div class="detail-item">
        <small>${escapeHtml(label)}</small>
        <b>${escapeHtml(value)}</b>
      </div>
    `)
    .join("");

  detailModal.classList.remove("hidden");
}

function closeModal() {
  detailModal.classList.add("hidden");
}

async function updateStatus(status) {
  if (!currentRegistration) return false;

  const { data, error } = await db
    .from("registrations")
    .update({ status })
    .eq("source_registration_id", currentRegistration.source_registration_id)
    .select("*")
    .single();

  if (error) {
    showNotification(`Gagal update status: ${error.message}`, "error");
    return false;
  }

  currentRegistration = data;
  const index = registrations.findIndex(
    (item) => item.source_registration_id === data.source_registration_id
  );
  if (index !== -1) registrations[index] = data;

  updateStats();
  renderRegistrations();
  openDetail(data.source_registration_id);
  return true;
}

async function approveCurrent() {
  if (!currentRegistration) return;

  const { data: memberId, error } = await db.rpc("approve_registration", {
    p_registration_id: currentRegistration.source_registration_id
  });
  if (error) {
    showNotification(`Gagal approve: ${error.message}`, "error");
    return;
  }

  currentRegistration.status = "approved";
  currentRegistration.member_id = memberId;
  const index = registrations.findIndex(
    (item) => item.source_registration_id === currentRegistration.source_registration_id
  );
  if (index !== -1) registrations[index] = currentRegistration;
  updateStats();
  renderRegistrations();
  openDetail(currentRegistration.source_registration_id);

  const message = `Halo ${currentRegistration.full_name} 👋

Selamat! Pendaftaran Anda di komunitas resmi PT. Rans Logistik Europe telah disetujui.

Silakan bergabung melalui grup berikut:
${CONFIG.waGroupLink}

Selamat bergabung dan semoga betah bersama keluarga besar PT. RLE 🚛✨

Fahrizal,
Admin PT. RLE`;
  const phone = encodeURIComponent(currentRegistration.whatsapp || "");
  const waLink = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  const link = document.createElement("a");
  link.href = waLink;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "whatsapp-btn";
  link.style.display = "block";
  link.style.marginTop = "16px";
  link.textContent = "📩 Kirim WhatsApp Sekarang";
  detailContent.appendChild(link);

  showNotification(`Pendaftaran disetujui. ID anggota: ${memberId}`);
}

async function rejectCurrent() {
  if (!currentRegistration || !(await updateStatus("rejected"))) return;
  showNotification("Pendaftaran berhasil ditolak.");
}

function deleteCurrent() {
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
    .eq("source_registration_id", currentRegistration.source_registration_id);

  cancelDelete();
  if (error) {
    showNotification(`Gagal hapus data: ${error.message}`, "error");
    return;
  }

  registrations = registrations.filter(
    (item) => item.source_registration_id !== currentRegistration.source_registration_id
  );
  closeModal();
  currentRegistration = null;
  updateStats();
  renderRegistrations();
  showNotification("Data pendaftar berhasil dihapus.");
}

registrationsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-registration-id]");
  if (button) openDetail(button.dataset.registrationId);
});

void initializeAdmin();
