"""HMAC-SHA256 JWT 검증 (메인 api/auth.js 와 동일 구현)
REBUILD21 — Python Lambda inference 자체 인증
payload: { sub, email, uid, name, admin, exp, iat }
"""
import os
import hmac
import hashlib
import json
import base64
from typing import Optional, Dict, Any

TOKEN_SECRET = (os.environ.get('AUTH_TOKEN_SECRET') or '').strip()
TOKEN_SECRET_VALID = len(TOKEN_SECRET) >= 32
if not TOKEN_SECRET_VALID:
    print('[Auth] AUTH_TOKEN_SECRET 미설정 또는 32자 미만')


def _b64decode(s: str) -> bytes:
    s = s.replace('-', '+').replace('_', '/')
    while len(s) % 4:
        s += '='
    return base64.b64decode(s)


def verify_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token or not TOKEN_SECRET_VALID:
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        signing_input = (parts[0] + '.' + parts[1]).encode('utf-8')
        expected_sig = hmac.new(TOKEN_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
        # Base64URL 인코딩 (메인과 동일 — '=' 패딩 제거)
        expected_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b'=').decode('ascii')

        # 타이밍 안전 비교
        if not hmac.compare_digest(expected_b64, parts[2]):
            return None

        payload = json.loads(_b64decode(parts[1]))

        # 만료 체크
        import time
        if payload.get('exp') and payload['exp'] < int(time.time()):
            return None

        return payload
    except Exception as e:
        print(f'[verify_token] {e}')
        return None


def extract_token(request) -> Optional[str]:
    """FastAPI Request 에서 토큰 추출 (Cookie 우선, Authorization 폴백)"""
    # 1) Cookie
    cookie_header = request.headers.get('cookie') or request.headers.get('Cookie') or ''
    for c in cookie_header.split(';'):
        c = c.strip()
        if c.startswith('token='):
            return c[len('token='):]

    # 2) Authorization Bearer
    auth = request.headers.get('authorization') or request.headers.get('Authorization') or ''
    if auth.startswith('Bearer '):
        return auth[len('Bearer '):]

    return None


def verify_auth(request) -> Optional[Dict[str, Any]]:
    return verify_token(extract_token(request))
