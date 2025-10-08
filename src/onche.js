import * as cheerio from 'cheerio';

const username = process.env.ONCHE_USERNAME;
const password = process.env.ONCHE_PASSWORD;

let cookie;

/** Helper to get headers with current cookie */
function getHeaders(additional = {}) {
  return {
    Cookie: cookie || "",
    ...additional,
  };
}

/** Extract input value by name from HTML */
function extractInputValue(html, name) {
  const match = html.match(new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]+)"`));
  return match ? match[1] : null;
}

/** Extract data-token from element by id */
function extractDataToken(html, id) {
  const match = html.match(new RegExp(`id="${id}"[^>]+data-token="([^"]+)"`));
  return match ? match[1] : null;
}

/** Login function */
export async function login() {
  console.log(`Logging in as ${username}...`);
  try {
    const res = await fetch("https://onche.org/account/login");
    const html = await res.text();

    if (html.includes("h-captcha")) {
      throw new Error("Captcha detected, aborting login");
    }

    const token = extractInputValue(html, "token");
    if (!token) return "";

    const form = new FormData();
    form.append("login", username);
    form.append("password", password);
    form.append("token", token);

    const loginRes = await fetch("https://onche.org/account/login", {
      method: "POST",
      body: form,
      redirect: "manual",
      headers: getHeaders(),
    });

    // Extract cookies from response
    const setCookie = loginRes.headers.get("set-cookie");
    if (!setCookie) throw new Error("No set-cookie header found");
    const auth = setCookie.match(/auth=([^;]+)/)?.[1];
    const sess = setCookie.match(/sess=([^;]+)/)?.[1];
    cookie = `auth=${auth}; sess=${sess}`;
    console.log(`Logged in as ${username}`);
  } catch (err) {
    console.error("Error logging in:", err);
  }
}

/** Fetch chat token */
export async function fetchChatToken(retry = 0) {
  try {
    const res = await fetch("https://onche.org/chat", {
      headers: getHeaders(),
    });

    if (res.status !== 200) {
      await login();
      if (retry > 2) {
        console.error("Error fetching chat token after retries");
        return null;
      }
      return fetchChatToken(retry + 1);
    }

    const html = await res.text();

    const token = extractDataToken(html, "chat");
    return token || null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** Get chat ID for a user */
async function getChatId(toUsername, token) {
  const form = new FormData();
  form.append("username", toUsername);
  form.append("token", token);

  try {
    const res = await fetch("https://onche.org/chat", {
      method: "POST",
      body: form,
      headers: getHeaders(),
    });
    const data = await res.json();
    return data?.id || null;
  } catch {
    return null;
  }
}

/** Send chat message */
export async function sendChatMsg(msg, to, token) {
  const chatId = await getChatId(to, token);
  if (!chatId) throw new Error("Chat ID is missing");

  const form = new FormData();
  form.append("message", msg);
  form.append("token", token);

  try {
    const res = await fetch(`https://onche.org/chat/${chatId}`, {
      method: "POST",
      body: form,
      headers: getHeaders(),
    });
    const data = await res.json();
    return data?.blocked === "no";
  } catch {
    return false;
  }
}


/** Get a profile */
export async function getProfile(username, retry = 0) {
  try {
    const res = await fetch("https://onche.org/profile/"+username, {
      headers: getHeaders(),
    });

    if (res.status !== 200) {
      await login();
      if (retry > 2) {
        console.error("Error fetching chat token after retries");
        return null;
      }
      return getProfile(username, retry + 1);
    }

    const html = await res.text();

    const $ = cheerio.load(data);

    const name = $('.profile-cover-username').text();
    const level = $('.profile-cover-badges>.profile-cover-badge').text();
    const signup_date = $('.profile-blocs>.profile-bloc:first-of-type>.item:nth-of-type(0)>.item-value').text();
    const last_login_date = $('.profile-blocs>.profile-bloc:first-of-type>.item:nth-of-type(1)>.item-value').text();
    const msg_count = $('.profile-blocs>.profile-bloc:first-of-type>.item:nth-of-type(2)>.item-value').text();

    return {
      username: name,
      level,
      signup_date,
      last_login_date,
      msg_count,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
