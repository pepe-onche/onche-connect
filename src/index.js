import './config.js';
import express from 'express';
import { urlencoded } from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import getProvider from './provider.js';
import { sendPin, verifyPin } from './pin.js';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  const provider = await getProvider();
  provider.proxy = true;
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "public")));
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  // Serve the forms
  app.get('/interaction/:uid', async (req, res, next) => {
    try {
      const {
        uid, prompt, params, session,
      } = await provider.interactionDetails(req, res);
      if (prompt.name === "login") {
        return res.render("login", { uid, error: null });
      }
      return res.render("consent", { uid, error: null });
    } catch (err) {
      console.error(err);
      return next(err);
    }
  });

  // Step 1: Send PIN
  app.post('/interaction/:uid/username', async (req, res, next) => {
    try {
      const { uid } = await provider.interactionDetails(req, res);
      const { username } = req.body;
      const session = await sendPin(username, req.params.uid);
      res.render("otp", { uid, username, session, error: null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to send PIN' });
    }
  });


  // Step 2: Verify PIN
  app.post('/interaction/:uid/verify', async (req, res, next) => {
    try {
      const interactionDetails = await provider.interactionDetails(req, res);
      const { username, pin1, pin2, pin3, pin4, pin5, pin6 } = req.body;
      const pin = `${pin1}${pin2}${pin3}${pin4}${pin5}${pin6}`;

      const valid = await verifyPin(username, req.params.uid, pin);
      if (!valid) {
        return res.render("otp", { uid, username, session: "******", error: "PIN invalide" });
      }

      const result = { login: { accountId: username } };
      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Step 3: Consent
  app.get('/interaction/:uid/consent', async (req, res, next) => {
    try {
      const interactionDetails = await provider.interactionDetails(req, res);
      const { uid, prompt, params, session: {accountId} } = interactionDetails;

      if (!accountId) throw new Error('No logged-in user');

      let grant = await provider.Grant.find(interactionDetails.grantId);
      if (!grant) {
        grant = new provider.Grant({ accountId, clientId: params.client_id });
      }

      grant.addOIDCScope('openid profile');
      grant.addOIDCClaims(['sub', 'id', 'name', 'picture', 'onche_level', 'onche_signup_date', 'onche_last_login_date', 'onche_msg_count']);

      const grantId = await grant.save();

      await provider.interactionFinished(req, res, {
        consent: { grantId },
      }, { mergeWithLastSubmission: true });
    } catch (err) {
      console.error(err);
      res.status(500).send('Oops! Something went wrong');
    }
  });

  app.use(provider.callback());

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✅ OIDC provider running at ${process.env.OIDC_ISSUER || `http://localhost:${port}`}`);
  });
}

start();
