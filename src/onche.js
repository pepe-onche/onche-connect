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
        console.error("Error fetching chat token");
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
    const res = await fetch("https://onche.org/profil/"+username, {
      headers: getHeaders(),
    });

    if (res.status !== 200) {
      await login();
      if (retry > 2) {
        console.error("Error fetching profile");
        return null;
      }
      return getProfile(username, retry + 1);
    }

    const html = await res.text();

    const $ = cheerio.load(html);

    const name = $('.profile-cover-username').text();
    let id = null;
    const {topics} = $.extract({
      topics: [{
        selector: '.topics>.topic>.topic-subject.link',
        value: 'href',
      }]
    });
    console.log(topics)
    for (let topic of topics) {
      const res = await fetch(topic, {
        headers: getHeaders(),
      });


      if (res.status !== 200) {
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const userId = $(`.message[data-username="${name}"]`).attr("data-user-id");

      if (userId) {
        id = parseInt(userId);
        break;
      }
    }

    if (!id) {
      return null;
    }

    const picture = $('.profile-cover>div.profile-cover-avatar>img').attr('src');
    const onche_level = parseInt($('.profile-cover>div.profile-cover-badges>div:first-of-type').text().split(' ')[1]);
    const onche_signup_date = $('.profile-blocs>div:nth-child(1)>div:nth-child(2)>div.item-value').text().split(' ')[0];
    const onche_last_login_date = $('.profile-blocs>div:nth-child(1)>div:nth-child(3)>div.item-value').text();
    const onche_msg_count = parseInt($('.profile-blocs>div:nth-child(1)>div:nth-child(4)>div.item-value').text());

    return {
      id,
      name,
      picture,
      onche_level,
      onche_signup_date,
      onche_last_login_date,
      onche_msg_count,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
