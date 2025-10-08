import fs from 'fs';
import { generateKeyPair, exportJWK } from 'jose';

const JWKS_FILE = './jwks.json';

export async function loadOrCreateJWKS() {
  if (fs.existsSync(JWKS_FILE)) {
    const jwks = JSON.parse(fs.readFileSync(JWKS_FILE, 'utf-8'));
    console.log('Loaded existing JWKS');
    return jwks;
  }

  console.log('Generating new JWKS...');

  const { privateKey } = await generateKeyPair('RS256', { extractable: true });

  const jwk = await exportJWK(privateKey);
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  jwk.kid = 'key-1';

  const jwks = { keys: [jwk] };

  fs.writeFileSync(JWKS_FILE, JSON.stringify(jwks, null, 2));
  console.log('Generated new JWKS');

  return jwks;
}

