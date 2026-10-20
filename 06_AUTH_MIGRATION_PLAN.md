# 06 — Authentication & Authorization Migration Plan (Supabase Auth Removal)

**Objective:** Complete elimination of Supabase Auth (GoTrue). Implementation of a self-hosted, cryptographically secure authentication engine using Argon2id password hashing, asymmetric JWT signing (RS256), public JWKS endpoints, and token-family rotation.

---

## 1. Authentication Architecture Comparison

```text
CURRENT SUPABASE AUTH ARCHITECTURE:
Client ──► Express API ──► Supabase GoTrue API (Network HTTP) ──► auth.users Table
                             • Synchronous network hop on every login/refresh
                             • Opaque password hash handling
                             • auth.getUser() required on every request
                             • Zero company_id in standard claims

TARGET STANDALONE AUTH ARCHITECTURE:
Client ──► Express API (Auth Service)
                │
                ├── Password Check: Local Argon2id / bcrypt verification
                ├── Token Issuer: Signs RS256 JWT using private key (2048-bit)
                ├── Token Verifier: Express middleware verifies JWT via local public key (0ms network)
                ├── JWKS Endpoint: GET /.well-known/jwks.json exposes public keys
                └── Refresh Token Store: public.refresh_tokens (SHA-256 + Family Theft Revocation)
```

---

## 2. Target Database Schema for Auth

### Table: `public.users`
```sql
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN (
    'superadmin',
    'admin',
    'operations_manager',
    'hr_manager',
    'accountant',
    'site_supervisor'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
  password_version integer NOT NULL DEFAULT 1,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_company_id ON public.users(company_id);
```

---

## 3. Asymmetric JWT & JWKS Implementation

### Key Pair Generation (RS256 2048-bit)
The backend generates or loads an RSA Keypair via environment variables or Docker secrets:
- `JWT_PRIVATE_KEY_PEM`: Private key used exclusively by `authController.ts` to sign tokens.
- `JWT_PUBLIC_KEY_PEM`: Public key distributed to any internal services or middleware to verify tokens without access to private signing keys.

### Token Claims Contract
```json
{
  "sub": "b2f67645-5d98-4660-84a1-b4ec370a92f0",
  "email": "admin@ambeservice.com",
  "role": "admin",
  "company_id": "c1a93e32-2309-4f76-8802-99ff302194c2",
  "iss": "https://api.ambeservice.com",
  "aud": "https://ambeservice.com",
  "iat": 1728000000,
  "exp": 1728000900,
  "jti": "5a76c8c1-7443-41bb-92ef-5f16d741cbef"
}
```

### JWKS Endpoint (`GET /.well-known/jwks.json`)
Exposes the public key in standard RFC 7517 format for key transparency:
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "ambe-auth-key-2026-v1",
      "n": "u1...[modulus]...",
      "e": "AQAB"
    }
  ]
}
```

---

## 4. Preserving & Hardening TokenService (Refresh Token Rotation)

The existing `TokenService.ts` contains sound security design (SHA-256 token hashing, family tracking, and reuse/theft detection). We retain and harden this service:

```text
                  Incoming /api/auth/refresh (Cookie: refresh_token)
                                         │
                                         ▼
                      Hash raw token with SHA-256
                                         │
                                         ▼
                   Look up token_hash in public.refresh_tokens
                                         │
                      ┌──────────────────┴──────────────────┐
                      ▼                                     ▼
             [ Token Already Revoked ]             [ Token Valid & Active ]
                      │                                     │
           🚨 REUSE / THEFT DETECTED!                       │
                      │                                     │
           Revoke entire family_id!                         │
           Clear all user cookies.                          │
           Return 401 Unauthorized.                         │
                                                            ▼
                                                 Mark old token as revoked
                                                 Generate new token & new hash
                                                 Save in same family_id
                                                 Issue fresh 15-min JWT
                                                 Set fresh 30-day cookie
```

---

## 5. Live User Credential Migration Strategy

How do we migrate active users from Supabase Auth without forcing an outage?

### Path A: Direct Hash Migration (Seamless, Zero User Friction)
Supabase Auth uses `bcrypt` for password hashing in its internal `auth.users` table:
1. In the database backup (`schema.sql` and `data.sql` created by `.github/workflows/supabase-backup.yml`), the `auth.users` records include `encrypted_password`.
2. Extract user records:
   ```sql
   INSERT INTO public.users (id, email, password_hash, role, company_id)
   SELECT 
     au.id,
     au.email,
     au.encrypted_password,
     COALESCE(ur.role, 'admin'),
     c.id
   FROM auth.users au
   LEFT JOIN public.user_roles ur ON ur.user_id = au.id
   LEFT JOIN public.companies c ON c.is_active = true
   LIMIT 100;
   ```
3. In `authController.ts`, implement a **Dual Verifier with Transparent Re-hash**:
   ```typescript
   // If hash starts with '$2a$' or '$2b$' (Bcrypt from Supabase)
   if (user.password_hash.startsWith('$2')) {
     const valid = await bcrypt.compare(password, user.password_hash);
     if (valid) {
       // Transparently upgrade to Argon2id in background!
       const modernHash = await argon2.hash(password);
       await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [modernHash, user.id]);
       return true;
     }
   } else {
     // Standard Argon2id verification
     return await argon2.verify(user.password_hash, password);
   }
   ```
   **Result:** Users log in with their exact existing passwords. On their first login, their hash is seamlessly upgraded to Argon2id without any interruption!

### Path B: Administrative Emergency Re-enrollment (Fallback)
If `encrypted_password` cannot be extracted from a managed backup:
1. Generate an administrative password-reset token stored in `public.password_resets`.
2. Send secure one-time activation links to the registered admin email accounts prior to cutover.
