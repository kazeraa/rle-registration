const db = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

let currentStep = 0;

const loader = document.getElementById("loader");
const landing = document.getElementById("landing");
const formSection = document.getElementById("formSection");
const successBox = document.getElementById("successBox");
const registerForm = document.getElementById("registerForm");
const steps = document.querySelectorAll(".step");
const progressFill = document.getElementById("progressFill");
const reviewBox = document.getElementById("reviewBox");

document.getElementById("companyName").textContent = CONFIG.companyName;
document.getElementById("slogan").textContent = CONFIG.slogan;

document.getElementById("mainLogo").src = CONFIG.logoUrl;
document.getElementById("loaderLogo").src = CONFIG.logoUrl;

window.addEventListener("load", () => {
  setTimeout(() => {
    loader.classList.add("hide");
  }, 1800);
});

function showForm() {
  landing.classList.add("hidden");
  formSection.classList.remove("hidden");
}

function backHome() {
  formSection.classList.add("hidden");
  landing.classList.remove("hidden");
}

function updateStep() {
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === currentStep);
  });

  const percent = ((currentStep + 1) / steps.length) * 100;
  progressFill.style.width = percent + "%";
}

function validateStep() {
  const activeStep = steps[currentStep];
  const inputs = activeStep.querySelectorAll("input, textarea");

  for (const input of inputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return false;
    }
  }

  return true;
}

function nextStep() {
  if (!validateStep()) return;

  if (currentStep < steps.length - 1) {
    currentStep++;
    updateStep();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    updateStep();
  }
}

function getFormData() {
  const formData = new FormData(registerForm);

  return {
    fullName: formData.get("fullName").trim(),
    nickName: formData.get("nickName").trim(),
    age: Number(formData.get("age")),
    whatsapp: formData.get("whatsapp").trim(),
    email: formData.get("email").trim(),
    city: formData.get("city").trim(),
    toeNick: formData.get("toeNick").trim(),
    toeUid: formData.get("toeUid").trim(),
    reason: formData.get("reason").trim()
  };
}

function showReview() {
  if (!validateStep()) return;

  const data = getFormData();

  reviewBox.innerHTML = `
    <div class="review-item">
      <small>Nama Lengkap</small>
      <b>${data.fullName}</b>
    </div>

    <div class="review-item">
      <small>Nama Panggilan</small>
      <b>${data.nickName}</b>
    </div>

    <div class="review-item">
      <small>Umur</small>
      <b>${data.age}</b>
    </div>

    <div class="review-item">
      <small>WhatsApp</small>
      <b>${data.whatsapp}</b>
    </div>

    <div class="review-item">
      <small>Kota Asal</small>
      <b>${data.city}</b>
    </div>

    <div class="review-item">
      <small>Nickname TOE3</small>
      <b>${data.toeNick}</b>
    </div>

    <div class="review-item">
      <small>UID TOE3</small>
      <b>${data.toeUid}</b>
    </div>
  `;

  nextStep();
}

function normalizeWhatsApp(number) {
  let clean = number.replace(/\D/g, "");

  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  }

  if (!clean.startsWith("62")) {
    clean = "62" + clean;
  }

  return clean;
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateStep()) return;

  const data = getFormData();

  const submitButton = registerForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Mengirim...";

  const { error } = await db.from("registrations").insert([
    {
      full_name: data.fullName,
      nick_name: data.nickName,
      age: data.age,
      whatsapp: normalizeWhatsApp(data.whatsapp),
      email: data.email || null,
      city: data.city,
      toe_nick: data.toeNick,
      toe_uid: data.toeUid,
      reason: data.reason,
      status: "pending"
    }
  ]);

  if (error) {
    alert("Gagal mengirim pendaftaran: " + error.message);
    submitButton.disabled = false;
    submitButton.textContent = "Kirim";
    return;
  }

  formSection.classList.add("hidden");
  successBox.classList.remove("hidden");
});