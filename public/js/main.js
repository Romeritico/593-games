const galleryGrid = document.getElementById("gallery-grid");
const downloadForm = document.getElementById("download-form");
const codigoInput = document.getElementById("codigo-input");
const downloadBtn = document.getElementById("download-btn");
const formMessage = document.getElementById("form-message");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function isVideoUrl(url) {
  return /\.(mp4|webm|ogg)$/i.test(url);
}

function renderGameCard(juego, index) {
  const tagClass = juego.etiqueta === "Entretenimiento" ? "entretenimiento" : "";
  const media = juego.demoUrl
    ? isVideoUrl(juego.demoUrl)
      ? `<video src="${escapeHtml(juego.demoUrl)}" muted loop playsinline autoplay></video>`
      : `<img src="${escapeHtml(juego.demoUrl)}" alt="Demo de ${escapeHtml(juego.nombre)}" loading="lazy" />`
    : `<div class="media-fallback">${escapeHtml(juego.nombre)}</div>`;

  const demoButton = juego.demoUrl
    ? `<a class="btn-demo" href="${escapeHtml(juego.demoUrl)}" target="_blank" rel="noopener">Ver demo</a>`
    : "";

  const card = document.createElement("article");
  card.className = "game-card";
  card.style.animationDelay = `${Math.min(index * 60, 400)}ms`;
  card.innerHTML = `
    <div class="game-media">
      ${media}
      <span class="game-tag ${tagClass}">${escapeHtml(juego.etiqueta || "Para negocios")}</span>
    </div>
    <div class="game-body">
      <h3>${escapeHtml(juego.nombre)}</h3>
      ${demoButton}
    </div>
  `;
  return card;
}

async function loadGallery() {
  try {
    const res = await fetch("/api/juegos");
    if (!res.ok) throw new Error("No se pudo cargar el catálogo.");
    const juegosList = await res.json();

    galleryGrid.innerHTML = "";

    if (!Array.isArray(juegosList) || juegosList.length === 0) {
      galleryGrid.innerHTML = `<div class="gallery-empty">Muy pronto vas a ver aquí nuestros juegos disponibles.</div>`;
      return;
    }

    juegosList.forEach((juego, i) => {
      galleryGrid.appendChild(renderGameCard(juego, i));
    });
  } catch (err) {
    galleryGrid.innerHTML = `<div class="gallery-empty">No se pudo cargar el catálogo. Intenta recargar la página.</div>`;
  }
}

function setLoading(isLoading) {
  downloadBtn.disabled = isLoading;
  downloadBtn.querySelector(".btn-spinner").hidden = !isLoading;
  downloadBtn.querySelector(".btn-label").textContent = isLoading ? "Verificando…" : "Descargar mi juego";
}

function setMessage(text, kind) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${kind || ""}`.trim();
}

downloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const codigo = codigoInput.value.trim();

  if (!codigo) {
    setMessage("Ingresa tu código antes de continuar.", "error");
    codigoInput.focus();
    return;
  }

  setMessage("", "");
  setLoading(true);

  try {
    const res = await fetch("/api/descargar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Código no válido. Verifica e intenta nuevamente.", "error");
      return;
    }

    setMessage(`¡Listo! Abriendo "${data.nombre}"…`, "success");

    if (data.tipo === "pdf") {
      window.open(data.url, "_blank", "noopener");
    } else {
      window.location.href = data.url;
    }
  } catch (err) {
    setMessage("Ocurrió un error de conexión. Intenta nuevamente.", "error");
  } finally {
    setLoading(false);
  }
});

loadGallery();
