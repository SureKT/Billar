"""
Genera cert.pem y key.pem para servir la app con HTTPS en la red local.
Ejecútalo una vez (o cada vez que cambie la IP del servidor).

Uso:
    python gen_cert.py
Luego arranca el backend con:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
"""
import ipaddress
import socket
import datetime
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def local_ip() -> str:
    """Detecta la IP local en la red doméstica."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"


ip = local_ip()
print(f"IP local detectada: {ip}")

# ── Clave privada ────────────────────────────────────────────────────────────
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# ── Certificado autofirmado ──────────────────────────────────────────────────
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, "Billar Local"),
])

san = x509.SubjectAlternativeName([
    x509.DNSName("localhost"),
    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    x509.IPAddress(ipaddress.IPv4Address(ip)),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
    .add_extension(san, critical=False)
    .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
    .sign(key, hashes.SHA256())
)

# ── Guardar archivos ─────────────────────────────────────────────────────────
Path("key.pem").write_bytes(
    key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
)
Path("cert.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))

print("Archivos generados: cert.pem  key.pem")
print()
print("Arranca el servidor con:")
print(f"  uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem")
print()
print(f"Desde el móvil abre:  https://{ip}:8000")
print("Chrome mostrara aviso de seguridad -> toca 'Opciones avanzadas' -> 'Continuar'")
print("Solo hay que aceptarlo una vez por dispositivo.")
