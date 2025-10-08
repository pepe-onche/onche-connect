import express from 'express';
import * as client from 'openid-client';

const app = express();

const issuerUrl = new URL('http://localhost:3000');
const clientId = 'test';
const clientSecret = 'thisisatest';
const redirectUri = 'http://localhost:4000/callback';


let config = await client.discovery(issuerUrl, clientId, clientSecret, undefined, {
  execute: [client.allowInsecureRequests],
});

let codeVerifier = client.randomPKCECodeVerifier();
let codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)

let parameters = {
  redirect_uri: redirectUri,
  scope: 'openid',
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
};

let redirectTo = client.buildAuthorizationUrl(config, parameters);

app.get('/login', (req, res) => {
  res.redirect(redirectTo);
});

app.get('/callback', async (req, res, next) => {
  try {
    let tokens = await client.authorizationCodeGrant(config, new URL("http://localhost:4000"+req.url), {
      pkceCodeVerifier: codeVerifier,
      idTokenExpected: false,
    });
    let claims = tokens.claims();
    let userInfo = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
    res.json({ tokens, claims, userInfo });
  } catch (err) {
    next(err);
  }
});

app.listen(4000, () => console.log('OIDC client running on http://localhost:4000/login'));

