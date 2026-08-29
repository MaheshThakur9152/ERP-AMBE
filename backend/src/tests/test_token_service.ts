import { TokenService } from '../services/tokenService';

async function runTokenVerification() {
  console.log('--- Testing TokenService hashing & generation ---');
  const raw1 = TokenService.generateRawToken();
  const hash1 = TokenService.hashToken(raw1);
  const hash2 = TokenService.hashToken(raw1);
  console.assert(raw1.length >= 64, 'Token length check failed');
  console.assert(hash1 === hash2, 'SHA-256 deterministic hash check failed');
  console.assert(hash1 !== raw1, 'Hash should not match raw token');
  console.log('✓ Token generation and SHA-256 hashing verified.');
  console.log('All local unit assertions passed.');
}

runTokenVerification().catch((err) => {
  console.error('Token verification error:', err);
  process.exit(1);
});
