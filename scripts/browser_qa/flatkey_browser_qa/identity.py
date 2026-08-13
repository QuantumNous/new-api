import hashlib
import hmac
import string
from dataclasses import dataclass


_DOMAIN = b"flatkey-browser-qa/v1/"
_LOWER_ALNUM = string.ascii_lowercase + string.digits
_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!#$%&()*+,-.:;<=>?@[]^_{|}~"
_PASSWORD_CLASSES = [
    string.ascii_uppercase,
    string.ascii_lowercase,
    string.digits,
    "!#$%&()*+,-.:;<=>?@[]^_{|}~",
]


@dataclass(frozen=True, repr=False)
class DerivedIdentity:
    run_id: str
    username: str
    email_tag: str
    password: str
    key_name: str

    def __repr__(self):
        return f"DerivedIdentity(run_id={self.run_id!r})"


def derive_identity(seed: bytes, run_id: str) -> DerivedIdentity:
    _validate_inputs(seed, run_id)
    username_digest = _hmac(seed, "username", run_id)
    email_digest = _hmac(seed, "email-tag", run_id)

    username_digits = int.from_bytes(username_digest[:8], "big") % 100_000_000
    username_suffix = _encode_alphabet(username_digest[8:], _LOWER_ALNUM, 8)
    email_suffix = _encode_alphabet(email_digest, _LOWER_ALNUM, 8)

    return DerivedIdentity(
        run_id=run_id,
        username=f"qa{username_digits:08d}{username_suffix}",
        email_tag=f"qa-{run_id}-{email_suffix}",
        password=_derive_password(seed, run_id),
        key_name=f"cloud-qa-{run_id}",
    )


def _validate_inputs(seed: bytes, run_id: str) -> None:
    if not isinstance(seed, bytes):
        raise TypeError("seed must be bytes")
    if len(seed) < 32:
        raise ValueError("identity seed must be at least 32 bytes")
    if not isinstance(run_id, str) or not run_id.isdecimal():
        raise ValueError("run id must contain only decimal digits")


def _hmac(seed: bytes, field: str, run_id: str) -> bytes:
    return hmac.new(
        seed,
        _DOMAIN + field.encode("ascii") + b"/" + run_id.encode("ascii"),
        hashlib.sha256,
    ).digest()


def _expand(seed: bytes, field: str, run_id: str, length: int) -> bytes:
    chunks = bytearray()
    counter = 0
    while len(chunks) < length:
        chunks.extend(_hmac(seed, f"{field}/{counter}", run_id))
        counter += 1
    return bytes(chunks[:length])


def _encode_alphabet(data: bytes, alphabet: str, length: int) -> str:
    chars = []
    for byte in data:
        chars.append(alphabet[byte % len(alphabet)])
        if len(chars) == length:
            return "".join(chars)
    raise ValueError("not enough input data")


def _derive_password(seed: bytes, run_id: str) -> str:
    raw = _expand(seed, "password", run_id, 96)
    chars = [_PASSWORD_ALPHABET[byte % len(_PASSWORD_ALPHABET)] for byte in raw[:20]]
    positions = list(range(20))
    for index, char_class in enumerate(_PASSWORD_CLASSES):
        pick = raw[20 + index] % len(positions)
        position = positions.pop(pick)
        chars[position] = char_class[raw[24 + index] % len(char_class)]
    return "".join(chars)
