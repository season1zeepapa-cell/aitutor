"""HMAC-SHA256 JWT 검증 (메인 api/auth.js 동일) — REBUILD21 GGUF
ONNX 핸들러의 auth.py 와 완전 동일 — 그대로 복사
"""
import os
import hmac
import hashlib
import json
import base64
from typing import Optional, Dict, Any

TOKEN_SECRET = (os.environ.get('AUTH_TOKEN_SECRET') or '').strip()
TOKEN_SECRET_VALID = len(TOKEN_SECRET) >= 32


def _b64decode(s: str) -> bytes:
    s = s.replace('-', '+').replace('_', '/')
    while len(s) % 4: s += '='
    return base64.b64decode(s)


def verify_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token or not TOKEN_SECRET_VALID:
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        signing_input = (parts[0] + '.' + parts[1]).encode('utf-8')
        expected_sig = hmac.new(TOKEN_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b'=').decode('ascii')
        if not hmac.compare_digest(expected_b64, parts[2]): return None
        payload = json.loads(_b64decode(parts[1]))
        import time
        if payload.get('exp') and payload['exp'] < int(time.time()): return None
        return payload
    except Exception:
        return None


def extract_token(request) -> Optional[str]:
    cookie_header = request.headers.get('cookie') or request.headers.get('Cookie') or ''
    for c in cookie_header.split(';'):
        c = c.strip()
        if c.startswith('token='): return c[6:]
    auth = request.headers.get('authorization') or request.headers.get('Authorization') or ''
    if auth.startswith('Bearer '): return auth[7:]
    return None


def verify_auth(request) -> Optional[Dict[str, Any]]:
    return verify_token(extract_token(request))
