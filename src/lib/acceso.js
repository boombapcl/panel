import { createClient } from '@supabase/supabase-js';

// Clave pública (publishable): puede ir en el código. Los datos los protege Supabase:
// la bandeja solo responde a usuarios admin de Noise y solo los aprobadores pueden decidir.
const URL = 'https://zyldzmaeykxwildnpetx.supabase.co';
const CLAVE = 'sb_publishable_Bh83LlgBrB46eFs1bBPbmA_g7F1g9Fc';

export const sb = createClient(URL, CLAVE, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'boombap-panel' },
});

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function esAdmin(usuario) {
  const { data, error } = await sb.rpc('has_role', { _user_id: usuario.id, _role: 'admin' });
  return !error && data === true;
}

function pantalla(mensaje) {
  let caja = document.getElementById('acceso');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'acceso';
    caja.className = 'acceso';
    document.body.appendChild(caja);
  }
  caja.innerHTML = `
    <form class="acceso-in" autocomplete="on">
      <img src="/logo-boombap.png" alt="Boombap" width="150">
      <h1>Panel Células</h1>
      <p class="acceso-sub">Entra con tu usuario de Noise.</p>
      <label>Correo<input name="email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="acceso-err" role="alert">${esc(mensaje || '')}</p>
      <button type="submit">Entrar</button>
    </form>`;
  return caja;
}

/** Resuelve con el usuario cuando hay sesión de un admin. Si no la hay, muestra el acceso. */
export async function exigirSesion() {
  const { data } = await sb.auth.getSession();
  const actual = data?.session?.user;
  if (actual && await esAdmin(actual)) return actual;
  if (actual) await sb.auth.signOut();

  document.documentElement.classList.add('sin-sesion');
  return new Promise(resolve => {
    const caja = pantalla(actual ? 'Tu usuario no tiene acceso a este panel.' : '');
    const armar = () => {
      const form = caja.querySelector('form');
      form.email.focus();
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const boton = form.querySelector('button');
        boton.disabled = true; boton.textContent = 'Entrando…';
        const { data: r, error } = await sb.auth.signInWithPassword({
          email: form.email.value.trim(), password: form.password.value,
        });
        if (error || !r?.user) { pantalla('Correo o contraseña incorrectos.'); return armar(); }
        if (!await esAdmin(r.user)) {
          await sb.auth.signOut();
          pantalla('Tu usuario no tiene acceso a este panel.'); return armar();
        }
        caja.remove();
        document.documentElement.classList.remove('sin-sesion');
        resolve(r.user);
      });
    };
    armar();
  });
}

export async function salir() {
  await sb.auth.signOut();
  location.reload();
}
