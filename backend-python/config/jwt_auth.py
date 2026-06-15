import jwt
from jwt import PyJWTError
from fastapi import Header, HTTPException
from config.settings import get_settings

settings = get_settings()

# Must match jwt.secret in Spring Boot application.properties
JWT_SECRET = "clauseguard_super_secret_key_change_in_production_min_256_bits_required"
JWT_ALGORITHM = "HS256"


def verify_jwt_token(authorization: str = Header(...)) -> str:
    """
    FastAPI dependency — verifies JWT issued by Spring Boot auth-service.

    Spring Boot signs tokens with HS256 using the shared secret.
    The token's "sub" claim contains the user's email — used as user_id.

    Usage in routes:
        user_email: str = Depends(verify_jwt_token)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")

    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    return user_email