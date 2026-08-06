// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://pchhkvsfnqmtclwjzkvc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sGq6SIuJg1f0PQut1BvLFg_CuPTh8TL";

// ==========================================
// SISTEMA DE SEGURIDAD CONTRA FUERZA BRUTA
// ==========================================
const SECURITY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BLOCK_DURATION: 30 * 60 * 1000, // 30 minutos en milisegundos
  STORAGE_KEY: 'bingo_security_state'
};

function getSecurityState() {
  try {
    const stored = localStorage.getItem(SECURITY_CONFIG.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading security state:', e);
  }
  return { attempts: 0, blockedUntil: null };
}

function setSecurityState(state) {
  try {
    localStorage.setItem(SECURITY_CONFIG.STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving security state:', e);
  }
}

function isBlocked() {
  const state = getSecurityState();
  if (!state.blockedUntil) return false;
  
  const now = Date.now();
  if (now >= state.blockedUntil) {
    // El bloqueo ha expirado, limpiar el estado
    setSecurityState({ attempts: 0, blockedUntil: null });
    return false;
  }
  
  return true;
}

function getRemainingBlockTime() {
  const state = getSecurityState();
  if (!state.blockedUntil) return 0;
  
  const now = Date.now();
  const remaining = state.blockedUntil - now;
  return Math.max(0, remaining);
}

function recordFailedAttempt() {
  const state = getSecurityState();
  const newAttempts = (state.attempts || 0) + 1;
  
  if (newAttempts >= SECURITY_CONFIG.MAX_ATTEMPTS) {
    // Bloquear al usuario
    const blockedUntil = Date.now() + SECURITY_CONFIG.BLOCK_DURATION;
    setSecurityState({ attempts: newAttempts, blockedUntil });
    return { blocked: true, attempts: newAttempts };
  }
  
  setSecurityState({ attempts: newAttempts, blockedUntil: null });
  return { blocked: false, attempts: newAttempts };
}

function resetSecurityState() {
  setSecurityState({ attempts: 0, blockedUntil: null });
}

function formatBlockTime(remainingMs) {
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return `${minutes} minuto${minutes !== 1 ? 's' : ''} y ${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}

// ==========================================
// CONSULTA A SUPABASE
// ==========================================
async function consultarCodigoBingo(codigo) {
  const url = `${SUPABASE_URL}/rest/v1/codigos_bingo?codigo_mostrador=eq.${encodeURIComponent(codigo)}&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Error en consulta: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// ==========================================
// DESCARGA DESDE STORAGE
// ==========================================
async function descargarCarton(numeroCarton) {
  const fileName = `carton_${numeroCarton}.html`;
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/tablas/${fileName}`;
  
  try {
    const response = await fetch(storageUrl);
    
    if (!response.ok) {
      throw new Error(`Error descargando archivo: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Crear URL temporal y descargar con headers correctos
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Nombre dinámico del archivo descargado
    a.download = `Bingo-Carton-${numeroCarton}.html`;
    
    document.body.appendChild(a);
    a.click();
    
    // Limpieza
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true };
  } catch (error) {
    console.error('Error en descarga:', error);
    throw error;
  }
}

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
const galleryGrid = document.getElementById("gallery-grid");
const downloadForm = document.getElementById("download-form");
const codigoInput = document.getElementById("codigo-input");
const downloadBtn = document.getElementById("download-btn");
const formMessage = document.getElementById("form-message");

// ==========================================
// FUNCIONES DE UI
// ==========================================
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

function setLoading(isLoading) {
  downloadBtn.disabled = isLoading;
  downloadBtn.querySelector(".btn-spinner").hidden = !isLoading;
  downloadBtn.querySelector(".btn-label").textContent = isLoading ? "Verificando…" : "Descargar mi juego";
}

function setMessage(text, kind) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${kind || ""}`.trim();
}

function updateUIForBlockState() {
  if (isBlocked()) {
    const remaining = getRemainingBlockTime();
    const timeText = formatBlockTime(remaining);
    
    codigoInput.disabled = true;
    downloadBtn.disabled = true;
    setMessage(`Has superado el límite de intentos. Por seguridad, espera ${timeText} para intentar ingresar nuevamente tu código.`, "error");
    
    // Configurar actualización del contador
    updateBlockCounter();
  } else {
    codigoInput.disabled = false;
    downloadBtn.disabled = false;
  }
}

function updateBlockCounter() {
  if (!isBlocked()) {
    // El bloqueo ha expirado
    codigoInput.disabled = false;
    downloadBtn.disabled = false;
    setMessage("", "");
    return;
  }
  
  const remaining = getRemainingBlockTime();
  const timeText = formatBlockTime(remaining);
  setMessage(`Has superado el límite de intentos. Por seguridad, espera ${timeText} para intentar ingresar nuevamente tu código.`, "error");
  
  // Actualizar cada segundo
  setTimeout(updateBlockCounter, 1000);
}

// ==========================================
// CARGA DE GALERÍA (Manteniendo función original)
// ==========================================
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

// ==========================================
// MANEJO DEL FORMULARIO DE DESCARGA
// ==========================================
downloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const codigo = codigoInput.value.trim();

  if (!codigo) {
    setMessage("Ingresa tu código antes de continuar.", "error");
    codigoInput.focus();
    return;
  }

  // Verificar si el usuario está bloqueado
  if (isBlocked()) {
    updateUIForBlockState();
    return;
  }

  setMessage("", "");
  setLoading(true);

  try {
    // Consultar código en Supabase
    const resultado = await consultarCodigoBingo(codigo);
    
    // Verificar si se encontró el código
    if (!Array.isArray(resultado) || resultado.length === 0) {
      // Código no encontrado - contar como intento fallido
      const attemptResult = recordFailedAttempt();
      
      if (attemptResult.blocked) {
        // Usuario bloqueado
        updateUIForBlockState();
      } else {
        const remaining = SECURITY_CONFIG.MAX_ATTEMPTS - attemptResult.attempts;
        const message = remaining === 1 
          ? "Código incorrecto. Te queda 1 intento más."
          : `Código incorrecto. Te quedan ${remaining} intentos más.`;
        setMessage(message, "error");
      }
      
      codigoInput.value = "";
      codigoInput.focus();
      return;
    }
    
    // Código encontrado - verificar si está expirado
    const codigoData = resultado[0];
    
    // Aquí puedes agregar lógica para verificar expiración si tu tabla tiene un campo de fecha
    // Por ejemplo: if (codigoData.fecha_expiracion && new Date(codigoData.fecha_expiracion) < new Date()) { ... }
    
    // Código válido - limpiar contador de intentos
    resetSecurityState();
    
    // Descargar cartón desde Storage
    const numeroCarton = codigoData.numero_carton;
    if (!numeroCarton) {
      setMessage("Error: No se encontró el número de cartón asociado.", "error");
      return;
    }
    
    setMessage("Descargando tu juego...", "success");
    await descargarCarton(numeroCarton);
    setMessage(`¡Listo! Tu cartón "${numeroCarton}" ha sido descargado.`, "success");
    
  } catch (err) {
    console.error('Error en proceso de descarga:', err);
    
    // Tratar errores generales como intentos fallidos
    const attemptResult = recordFailedAttempt();
    
    if (attemptResult.blocked) {
      updateUIForBlockState();
    } else {
      const remaining = SECURITY_CONFIG.MAX_ATTEMPTS - attemptResult.attempts;
      const message = remaining === 1 
        ? "Error de conexión. Te queda 1 intento más."
        : `Error de conexión. Te quedan ${remaining} intentos más.`;
      setMessage(message, "error");
    }
  } finally {
    setLoading(false);
  }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadGallery();
  updateUIForBlockState(); // Verificar estado de bloqueo al cargar
});
