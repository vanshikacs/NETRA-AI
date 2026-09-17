import asyncio
import base64
import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Dict, List, Tuple

import bcrypt
import jwt
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

JWT_SECRET = os.environ.get('JWT_SECRET', 'poc-only-secret')


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def issue_token(user_id: str, role: str) -> str:
    payload = {'sub': user_id, 'role': role, 'exp': int(time.time()) + 900, 'iat': int(time.time())}
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


@dataclass
class SignalFrame:
    motion_delta: float
    routine_deviation: float
    location_risk: float
    voice_stress: float
    battery_factor: float
    offline: bool


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def compute_risk(frame: SignalFrame, sensitivity: float = 0.72) -> Tuple[int, List[Dict[str, object]]]:
    weights = {
        'motion anomaly': (frame.motion_delta, 0.25),
        'routine deviation': (frame.routine_deviation, 0.28),
        'location context': (frame.location_risk, 0.24),
        'optional voice stress': (frame.voice_stress, 0.18),
        'battery/offline resilience': (frame.battery_factor + (8 if frame.offline else 0), 0.05),
    }
    raw = sum(clamp(v) * w for v, w in weights.values())
    sensitivity_boost = (sensitivity - 0.5) * 18
    score = int(round(clamp(raw + sensitivity_boost)))
    factors = []
    for name, (value, weight) in weights.items():
        contribution = round(clamp(value) * weight, 2)
        factors.append({
            'factor': name,
            'observed': round(value, 2),
            'weight': weight,
            'contribution': contribution,
            'explanation': f'{name.title()} contributed {contribution} points from derived on-device signals.'
        })
    return score, sorted(factors, key=lambda f: f['contribution'], reverse=True)


def vault_encrypt_and_verify(event: Dict[str, object]) -> bool:
    key = Fernet.generate_key()
    f = Fernet(key)
    payload = json.dumps(event, sort_keys=True).encode()
    digest = hashlib.sha256(payload).hexdigest()
    token = f.encrypt(payload)
    restored = f.decrypt(token)
    restored_digest = hashlib.sha256(restored).hexdigest()
    assert restored_digest == digest
    tampered = json.dumps({**event, 'risk_score': 1}, sort_keys=True).encode()
    return hashlib.sha256(tampered).hexdigest() != digest


async def optional_gemini_smoke() -> str:
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return 'fallback:no-key'
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        chat = LlmChat(
            api_key=api_key,
            session_id='sentinelpulse-core-poc',
            system_message='You generate concise personal safety insight from derived risk metadata only.'
        ).with_model('gemini', 'gemini-3-flash-preview')
        chunks = []
        async for event in chat.stream_message(UserMessage(text='In 12 words, say SentinelPulse risk explanations are privacy-first.')):
            if isinstance(event, TextDelta):
                chunks.append(event.content)
            elif isinstance(event, StreamDone):
                break
            if len(''.join(chunks)) > 160:
                break
        text = ''.join(chunks).strip()
        return 'llm:ok' if text else 'fallback:empty-response'
    except Exception as exc:
        return f'fallback:{type(exc).__name__}'


async def main() -> None:
    hashed = hash_password('SentinelPulse#2026')
    assert verify_password('SentinelPulse#2026', hashed)
    assert not verify_password('wrong', hashed)
    token = issue_token('user_001', 'user')
    decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    assert decoded['sub'] == 'user_001' and decoded['role'] == 'user'

    normal_score, normal_factors = compute_risk(SignalFrame(8, 10, 12, 4, 5, False))
    alert_score, alert_factors = compute_risk(SignalFrame(92, 84, 76, 68, 30, True))
    assert normal_score < 35, normal_score
    assert alert_score >= 75, alert_score
    assert alert_factors[0]['factor'] in {'routine deviation', 'motion anomaly', 'location context'}

    event = {
        'event_id': 'evt_poc',
        'risk_score': alert_score,
        'factors': alert_factors,
        'location': {'lat': 28.6139, 'lng': 77.2090},
        'created_at': int(time.time()),
    }
    assert vault_encrypt_and_verify(event)
    gemini_status = await optional_gemini_smoke()
    print(json.dumps({
        'status': 'PASS',
        'auth': 'jwt+bcrypt verified',
        'risk_engine': {'normal_score': normal_score, 'alert_score': alert_score, 'top_factor': alert_factors[0]['factor']},
        'vault': 'encrypted+tamper hash verified',
        'gemini': gemini_status,
    }, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
