// ===== CONFIGURACIÓN DE SUPABASE =====
const SUPABASE_URL = 'https://mmvrmtqimjiiwjzrkrbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdnJtdHFpbWppaXdqenJrcmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTU3NDMsImV4cCI6MjA4MTQzMTc0M30.jtd3EKHOO1uN3aN1jM1aD84YQS9-Lsr9XVqI-g7LyNA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== ELEMENTOS DEL DOM =====
const form = document.getElementById('download-form');
const codigoInput = document.getElementById('codigo-input');
const messageEl = document.getElementById('form-message');
const submitBtn = document.getElementById('download-btn');
const btnLabel = submitBtn.querySelector('.btn-label');
const btnSpinner = submitBtn.querySelector('.btn-spinner');

// ===== FUNCIONES DE UTILIDAD =====
function mostrarMensaje(texto, tipo = 'info') {
  messageEl.textContent = texto;
  messageEl.className = 'form-message ' + tipo;
}

function setLoading(estado) {
  if (estado) {
    btnLabel.hidden = true;
    btnSpinner.hidden = false;
    submitBtn.disabled = true;
  } else {
    btnLabel.hidden = false;
    btnSpinner.hidden = true;
    submitBtn.disabled = false;
  }
}

// ===== DESCARGA DE ARCHIVO =====
async function descargarArchivo(url, nombreArchivo) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo obtener el archivo');
  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ===== VERIFICAR CONEXIÓN A SUPABASE =====
async function verificarConexion() {
  try {
    // Hacer una consulta simple para verificar la conexión
    const { data, error } = await supabase
      .from('juegos')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error de conexión a Supabase:', error);
      return false;
    }
    console.log('✅ Conexión a Supabase establecida');
    return true;
  } catch (err) {
    console.error('Error al conectar con Supabase:', err);
    return false;
  }
}

// ===== MANEJO DEL FORMULARIO =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = codigoInput.value.trim();

  if (!codigo) {
    mostrarMensaje('⚠️ Por favor, ingresa un código.', 'error');
    return;
  }

  mostrarMensaje('Buscando juego...', 'info');
  setLoading(true);

  try {
    const { data: juego, error } = await supabase
      .from('juegos')
      .select('*')
      .eq('codigo', codigo)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!juego) {
      mostrarMensaje('❌ Código no válido. Verifica el código e intenta de nuevo.', 'error');
      setLoading(false);
      return;
    }

    if (!juego.archivo_base64) {
      mostrarMensaje('❌ Este juego no tiene un archivo asociado.', 'error');
      setLoading(false);
      return;
    }

    // Decodificar archivo
    const binaryString = atob(juego.archivo_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });

    const extension = juego.nombre_archivo.split('.').pop() || 'html';
    const nombreDescarga = `${juego.codigo}.${extension}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreDescarga;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    mostrarMensaje(`✅ ¡Descarga iniciada! Juego: ${juego.nombre || juego.codigo}`, 'success');

  } catch (err) {
    console.error(err);
    mostrarMensaje('❌ Error al procesar la solicitud. Intenta de nuevo más tarde.', 'error');
  } finally {
    setLoading(false);
  }
});

// ===== CARGAR MENSAJE DE YOUTUBE EN LA GALERÍA =====
async function cargarJuegos() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  // Verificar conexión a Supabase
  const conectado = await verificarConexion();

  // Mostrar mensaje de YouTube (siempre visible, independientemente de la conexión)
  grid.innerHTML = `
    <div class="youtube-message" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
      <div style="font-size: 4rem; margin-bottom: 20px;">🎮</div>
      <h3 style="color: #2d3436; font-family: 'Poppins', sans-serif; font-size: 1.8rem; margin-bottom: 15px; font-weight: 700;">
        ¡Síguenos en YouTube!
      </h3>
      <p style="color: #636e72; font-family: 'Inter', sans-serif; font-size: 1.1rem; max-width: 500px; margin: 0 auto 30px auto; line-height: 1.6;">
        En nuestro canal de YouTube puedes ver la transmisión en vivo de nuestros juegos
      </p>
      <a href="https://www.youtube.com/@SUPERBINGOEC" 
         target="_blank" 
         rel="noopener noreferrer"
         style="
           display: inline-block;
           background: #ff0000;
           color: white;
           font-family: 'Poppins', sans-serif;
           font-size: 1.1rem;
           font-weight: 600;
           padding: 16px 40px;
           border-radius: 50px;
           text-decoration: none;
           transition: all 0.3s ease;
           box-shadow: 0 4px 15px rgba(255, 0, 0, 0.3);
         "
         onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(255, 0, 0, 0.4)';"
         onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(255, 0, 0, 0.3)';">
        <span style="margin-right: 10px;">▶</span> Visitar canal
      </a>
      <p style="color: #b2bec3; font-family: 'Inter', sans-serif; font-size: 0.9rem; margin-top: 20px;">
        @SUPERBINGOEC
      </p>
      ${conectado ? '' : `<p style="color: #e17055; font-family: 'Inter', sans-serif; font-size: 0.8rem; margin-top: 15px;">⚠️ Conectando con Supabase...</p>`}
    </div>
  `;
}

// ===== INICIALIZAR =====
document.addEventListener('DOMContentLoaded', () => {
  cargarJuegos();
});
