// ==========================================
// CONFIGURACIÓN DE SUPABASE - CLIENTE GLOBAL
// ==========================================
const SUPABASE_URL = 'https://pchhkvsfnqmtclwjzkvc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sGq6SIuJg1f0PQut1BvLFg_CuPTh8TL';

// Inicialización global del cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
// CONSULTA A SUPABASE USANDO SDK
// ==========================================
async function consultarCodigoBingo(codigo) {
  console.log('🔍 Iniciando consulta de código:', codigo);
  console.log('📡 URL de Supabase:', SUPABASE_URL);
  console.log('🔑 API Key (primeros 10 chars):', SUPABASE_ANON_KEY.substring(0, 10) + '...');
  
  try {
    const { data, error } = await supabase
      .from('codigos_bingo')
      .select('*')
      .eq('codigo_mostrador', codigo);
    
    console.log('📊 Resultado de consulta:', { data, error });
    
    if (error) {
      console.error('❌ Error en consulta Supabase:', error);
      throw new Error(`Error en consulta: ${error.message}`);
    }
    
    console.log('✅ Consulta exitosa, registros encontrados:', data?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ Error consultando código:', error);
    throw error;
  }
}

// ==========================================
// DESCARGA DESDE STORAGE
// ==========================================
async function descargarCarton(numeroCarton, fileNameFromDB = null) {
  console.log('📥 Iniciando descarga del cartón:', numeroCarton);
  
  // Construir el nombre del archivo: usar url_tabla si está disponible, sino formato doble con guion
  let fileName;
  if (fileNameFromDB) {
    fileName = fileNameFromDB;
    console.log('📁 Usando nombre desde DB:', fileName);
  } else {
    fileName = `carton_${numeroCarton}-${numeroCarton}.html`;
    console.log('📁 Construyendo nombre con formato doble:', fileName);
  }
  
  console.log('🗂️ Bucket de Storage: tablas');
  
  try {
    // Primero verificar si el archivo existe listando el bucket
    const { data: files, error: listError } = await supabase
      .storage
      .from('tablas')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (listError) {
      console.error('❌ Error listando bucket:', listError);
      console.error('Esto podría indicar problema con permisos RLS o bucket inexistente');
    } else {
      console.log('📋 Archivos en bucket tablas:', files.map(f => f.name));
      const fileExists = files.some(f => f.name === fileName);
      
      if (!fileExists) {
        console.error(`❌ El archivo ${fileName} NO existe en el bucket 'tablas'`);
        console.error('📝 Archivos disponibles:', files.map(f => f.name).join(', '));
        throw new Error(`El archivo ${fileName} no existe en el bucket de Storage. Por favor verifica que el archivo haya sido subido correctamente.`);
      }
    }
    
    // Intentar descargar el archivo
    const { data, error } = await supabase.storage.from('tablas').download(fileName);
    
    if (error) {
      console.error('❌ Error descargando archivo:', error);
      console.error('Código de error:', error.message);
      
      if (error.message.includes('Object not found')) {
        throw new Error(`El archivo ${fileName} no existe en el bucket 'tablas'. Verifica que los archivos hayan sido subidos correctamente al Storage de Supabase.`);
      } else if (error.message.includes('permission')) {
        throw new Error('Error de permisos. Verifica las políticas RLS del bucket "tablas" para permitir lectura pública.');
      }
      
      throw new Error(`Error descargando archivo: ${error.message}`);
    }
    
    console.log('✅ Archivo descargado exitosamente');
    
    // Crear blob y descargar con headers correctos
    const blob = new Blob([data], { type: 'text/html; charset=utf-8' });
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
// CARGA DE GALERÍA (Simplificada para Vercel)
// ==========================================
async function loadGallery() {
  console.log('🖼️ Cargando galería de juegos...');
  
  // En Vercel no tenemos la API /api/juegos configurada, así que mostramos mensaje amigable
  // Esta funcionalidad requiere configuración de backend en Vercel (API Routes)
  galleryGrid.innerHTML = `<div class="gallery-empty">En nuestro canal de youtube:@SUPERBINGOEC puedes ver la transmisión en vivo de nuestros juegos .</div>`;
  console.log('ℹ️ Galería deshabilitada - requiere configuración de API Routes en Vercel');
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
    // Consultar código en Supabase usando el SDK
    const resultado = await consultarCodigoBingo(codigo);
    
    console.log('📋 Resultado de búsqueda:', resultado);
    
    // Verificar si se encontró el código
    if (!Array.isArray(resultado) || resultado.length === 0) {
      console.log('⚠️ Código no encontrado en base de datos');
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
    
    console.log('📋 Datos del código:', codigoData);
    
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
    
    // Intentar usar url_tabla si está disponible, sino usar formato doble con guion
    let fileNameFromDB = null;
    if (codigoData.url_tabla) {
      console.log('📁 url_tabla original:', codigoData.url_tabla);
      
      // Detectar si url_tabla tiene el formato incorrecto "https://supabase.co_X-X.html"
      if (codigoData.url_tabla.includes('supabase.co_')) {
        // Extraer el número después de "supabase.co_"
        const numeroExtraido = codigoData.url_tabla.split('supabase.co_')[1];
        if (numeroExtraido) {
          // Construir el nombre correcto del archivo
          fileNameFromDB = `carton_${numeroExtraido}`;
          console.log('📁 Nombre corregido desde url_tabla:', fileNameFromDB);
        }
      } else {
        // Si tiene formato normal, extraer solo el nombre del archivo
        fileNameFromDB = codigoData.url_tabla.split('/').pop();
        console.log('📁 Nombre normal desde url_tabla:', fileNameFromDB);
      }
    }
    
    setMessage("Descargando tu juego...", "success");
    await descargarCarton(numeroCarton, fileNameFromDB);
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
// PRUEBA DE CONEXIÓN CON SUPABASE
// ==========================================
async function probarConexionSupabase() {
  console.log('🧪 Iniciando prueba de conexión con Supabase...');
  
  try {
    // Primero verificar si el cliente se inicializó correctamente
    if (!supabase) {
      console.error('❌ Cliente de Supabase no inicializado');
      return false;
    }
    
    console.log('✅ Cliente de Supabase inicializado correctamente');
    
    // Intentar una consulta simple para verificar conexión
    const { data, error } = await supabase
      .from('codigos_bingo')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error de conexión con Supabase:', error);
      console.error('Detalles del error:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      });
      
      // Mensaje específico según el tipo de error
      if (error.code === '42P01') {
        console.error('❌ La tabla "codigos_bingo" no existe en la base de datos');
      } else if (error.code === '42501') {
        console.error('❌ Error de permisos (RLS). Verifica las políticas de acceso');
      }
      
      return false;
    }
    
    console.log('✅ Conexión exitosa con Supabase');
    console.log('📊 Total de registros en codigos_bingo:', data);
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de conexión:', error);
    console.error('Tipo de error:', error.constructor.name);
    console.error('Mensaje:', error.message);
    return false;
  }
}

// ==========================================
// VERIFICACIÓN DE ESTRUCTURA DE BASE DE DATOS
// ==========================================
async function verificarEstructuraBD() {
  console.log('🔍 Verificando estructura de la base de datos...');
  
  try {
    // Verificar si la tabla codigos_bingo existe haciendo una consulta directa
    const { data: sampleData, error: sampleError } = await supabase
      .from('codigos_bingo')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error al acceder a tabla codigos_bingo:', sampleError);
      
      if (sampleError.code === '42P01') {
        console.error('❌ La tabla "codigos_bingo" NO existe. Debes crearla en Supabase.');
        console.error('📝 Estructura sugerida:');
        console.error('   - id (serial, primary key)');
        console.error('   - codigo_mostrador (text, unique)');
        console.error('   - numero_carton (text)');
        console.error('   - cliente_id (integer, foreign key)');
        console.error('   - fecha_expiracion (timestamp, opcional)');
      }
    } else {
      console.log('✅ Tabla codigos_bingo existe y es accesible');
      console.log('📊 Estructura de registro de ejemplo:', sampleData);
    }
    
    // Verificar el bucket de Storage
    console.log('🗂️ Verificando bucket de Storage...');
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error al listar buckets:', bucketsError);
    } else {
      console.log('📋 Buckets disponibles:', buckets.map(b => b.name));
      const tablasBucket = buckets.find(b => b.name === 'tablas');
      
      if (!tablasBucket) {
        console.error('❌ El bucket "tablas" NO existe en Storage');
        console.error('📝 Debes crear el bucket "tablas" en Supabase Storage');
        console.error('📝 Ejecuta el script SQL proporcionado para crearlo');
      } else {
        console.log('✅ Bucket "tablas" existe');
        console.log('📢 ¿Es público?', tablasBucket.public ? 'Sí ✅' : 'No ❌ (debe ser público)');
        
        if (!tablasBucket.public) {
          console.error('❌ El bucket "tablas" no es público. Debes hacerlo público para permitir descargas.');
        }
        
        // Listar archivos en el bucket
        const { data: files, error: filesError } = await supabase
          .storage
          .from('tablas')
          .list('', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (filesError) {
          console.error('❌ Error listando archivos del bucket:', filesError);
          console.error('Esto puede indicar problemas con permisos RLS');
        } else {
          console.log('📁 Archivos en bucket "tablas":', files.map(f => f.name));
          
          if (files.length === 0) {
            console.error('❌ El bucket "tablas" está vacío. No hay archivos para descargar.');
            console.error('📝 Debes subir los archivos carton_*.html al bucket');
          }
        }
      }
    }
    
    if (sampleError) {
      console.error('❌ Error al acceder a tabla codigos_bingo:', sampleError);
      
      if (sampleError.code === '42P01') {
        console.error('❌ La tabla "codigos_bingo" NO existe. Debes crearla en Supabase.');
        console.error('📝 Estructura sugerida:');
        console.error('   - id (serial, primary key)');
        console.error('   - codigo_mostrador (text, unique)');
        console.error('   - numero_carton (text)');
        console.error('   - cliente_id (integer, foreign key)');
        console.error('   - fecha_expiracion (timestamp, opcional)');
      }
    } else {
      console.log('✅ Tabla codigos_bingo existe y es accesible');
      console.log('📊 Estructura de registro de ejemplo:', sampleData);
    }
    
  } catch (error) {
    console.error('❌ Error verificando estructura:', error);
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log('🚀 Aplicación iniciada');
  console.log('🔧 Supabase URL:', SUPABASE_URL);
  console.log('🔧 Supabase Key disponible:', !!SUPABASE_ANON_KEY);
  console.log('🔧 Supabase Key (formato):', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  
  // Probar conexión con Supabase
  const conexionExitosa = await probarConexionSupabase();
  
  if (!conexionExitosa) {
    console.warn('⚠️ No se pudo conectar con Supabase. Verifica las credenciales.');
    await verificarEstructuraBD();
  } else {
    console.log('✅ Conexión establecida correctamente');
    await verificarEstructuraBD();
  }
  
  loadGallery();
  updateUIForBlockState(); // Verificar estado de bloqueo al cargar
});
