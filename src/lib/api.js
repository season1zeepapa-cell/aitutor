// API 클라이언트 — fetch 래퍼 + 토큰 관리

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// 토큰 저장/조회/삭제
export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// 사용자 정보 저장/조회
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

// 인증 헤더 포함 fetch
export async function apiFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    clearAuthToken();
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
