const form = document.getElementById("leadForm");
const statusEl = document.getElementById("formStatus");

if (form && statusEl) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const company = String(formData.get("company") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!name || !email || !company) {
      statusEl.textContent = "Заполните обязательные поля: имя, e-mail и компания.";
      statusEl.style.color = "#b32828";
      return;
    }

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmailValid) {
      statusEl.textContent = "Проверьте e-mail: формат адреса некорректен.";
      statusEl.style.color = "#b32828";
      return;
    }

    // Demo mode: показываем успешную отправку без серверной части.
    statusEl.textContent =
      `Спасибо, ${name}! Заявка принята. Мы свяжемся с вами по адресу ${email}.`;
    statusEl.style.color = "#11865d";

    form.reset();
    console.info("Lead captured", { name, email, company, message });
  });
}
