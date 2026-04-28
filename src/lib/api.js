// API 클라이언트 — fetch 래퍼 + 인증 관리
// 토큰은 HttpOnly 쿠키로 서버가 관리 (XSS 탈취 방지)
// 사용자 정보(이름, 관리자 여부)만 localStorage에 저장

const USER_KEY = 'user';

// 사용자 정보 저장/조회/삭제
export function setAuthUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}
export function clearAuth() {
  localStorage.removeItem(USER_KEY);
}

// 로그인 상태 확인 (사용자 정보 존재 여부로 판단)
export function isLoggedIn() {
  return !!getAuthUser();
}

// 인증 포함 fetch — 쿠키 자동 전송 (credentials: 'include')
export async function apiFetch(url, options = {}) {
  const headers = {
    ...options.headers,
  };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('인증이 만료되었습니다.');
  }
  return res;
}

// GET 편의 함수
export async function apiGet(url) {
  const res = await apiFetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `요청 실패 (${res.status})`);
  }
  return res.json();
}

// POST 편의 함수
export async function apiPost(url, body) {
  const res = await apiFetch(url, { method: 'POST', body });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `요청 실패 (${res.status})`);
  }
  return res.json();
}
