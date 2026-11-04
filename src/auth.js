// Đăng nhập Google bằng Google Identity Services (chạy hoàn toàn trên trình duyệt, không cần backend).
// Google trả về một ID token (JWT); app đọc payload để lấy định danh người dùng và tách dữ liệu theo tài khoản.

const SESSION_KEY = 'lich-hen-mini.session';
const GUEST = Object.freeze({ id: 'guest', name: 'Khách', email: '', picture: '', guest: true });
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

function decodeBase64Url(part) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes); // giữ đúng tên có dấu tiếng Việt
}

// Đọc và kiểm tra các claim của ID token. Không kiểm chữ ký: việc đó cần server,
// và ở đây dữ liệu chỉ nằm trên chính trình duyệt của người dùng (xem docs/DECISIONS.md D9).
export function parseGoogleCredential(credential, { clientId, now = Date.now() } = {}) {
  const parts = typeof credential === 'string' ? credential.split('.') : [];
  if (parts.length !== 3) return { ok: false, error: 'Token không đúng định dạng.' };

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return { ok: false, error: 'Không đọc được token.' };
  }

  if (!GOOGLE_ISSUERS.includes(payload.iss)) return { ok: false, error: 'Token không phải do Google cấp.' };
  if (clientId && payload.aud !== clientId) return { ok: false, error: 'Token không dành cho ứng dụng này.' };
  if (!payload.exp || payload.exp * 1000 <= now) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' };
  if (!payload.sub) return { ok: false, error: 'Token thiếu mã người dùng.' };

  return {
    ok: true,
    user: {
      id: `google:${payload.sub}`,
      name: payload.name || payload.email || 'Người dùng Google',
      email: payload.email ?? '',
      picture: payload.picture ?? '',
      guest: false,
    },
  };
}

export const guestUser = () => ({ ...GUEST });

export function loadSession() {
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return user && typeof user.id === 'string' ? user : null;
  } catch {
    return null;
  }
}

export function saveSession(user) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// Nạp thư viện GIS và vẽ nút "Đăng nhập bằng Google" vào container.
export function renderGoogleButton(container, { clientId, onLogin, onError }) {
  const init = () => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        const r = parseGoogleCredential(credential, { clientId });
        if (r.ok) onLogin(r.user);
        else onError(r.error);
      },
    });
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi' });
  };

  if (window.google?.accounts?.id) return init();
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = init;
  script.onerror = () => onError('Không tải được Google Sign-In (kiểm tra kết nối mạng).');
  document.head.append(script);
}

export function signOutGoogle() {
  window.google?.accounts?.id?.disableAutoSelect();
}
