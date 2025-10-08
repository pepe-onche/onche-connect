import { Provider } from 'oidc-provider';
import { loadOrCreateJWKS } from './key-loader.js';
import RedisAdapter from './redis-adapter.js';
import fs from 'fs';

export default async function getProvider() {
  let clients = [];

  try {
    clients = JSON.parse(fs.readFileSync('./clients.json', 'utf8'));
  } catch (err) {
    console.warn('⚠️ No clients.json found. Please create one based on clients.example.json');
  }

  const jwks = await loadOrCreateJWKS();

  const configuration = {
    async findAccount(ctx, id) {
      return {
        accountId: id,
        async claims(use, scope) {
          const profile = await onche.getProfile(id) || {};
          console.log("profile =>", profile);
          return { sub: id, ...profile };
        },
      };
    },

    adapter: RedisAdapter,
    clients,
    jwks,
    ttl: {
      AccessToken: 3600,
      AuthorizationCode: 600,
      IdToken: 3600,
      RefreshToken: 86400,
      Interaction: 300,
    },
    features: {
      devInteractions: { enabled: false },
      deviceFlow: { enabled: true },
      revocation: { enabled: true },
      introspection: { enabled: true },
    },
    interactions: {
      url(ctx, interaction) {
        return `/interaction/${interaction.uid}`;
      },
    },
  };

  const issuer = process.env.OIDC_ISSUER || 'http://localhost:3000';
  return new Provider(issuer, configuration);
}
