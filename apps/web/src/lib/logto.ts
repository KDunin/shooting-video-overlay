import NodeClient, { CookieStorage, type LogtoConfig } from "@logto/node";
import { redirect } from "@tanstack/react-router";
import { getCookies, setCookie } from "@tanstack/react-start/server";

// Lazy — only throws when actually called, not on module import.
// This lets the module load safely when AUTH_ENABLED=false.
export async function getLogToClient() {
  if (
    !process.env.LOGTO_ENDPOINT ||
    !process.env.LOGTO_APP_ID ||
    !process.env.LOGTO_APP_SECRET ||
    !process.env.LOGTO_COOKIE_SECRET
  ) {
    throw new Error(
      "LOGTO_ENDPOINT, LOGTO_APP_ID, LOGTO_APP_SECRET, and LOGTO_COOKIE_SECRET must be set",
    );
  }

  const logtoConfig: LogtoConfig = {
    endpoint: process.env.LOGTO_ENDPOINT,
    appId: process.env.LOGTO_APP_ID,
    appSecret: process.env.LOGTO_APP_SECRET,
  };

  const storage = new CookieStorage({
    encryptionKey: process.env.LOGTO_COOKIE_SECRET,
    sessionWrapper: undefined,
    cookieKey: `logto_${process.env.LOGTO_APP_ID}`,
    isSecure: process.env.NODE_ENV === "production",
    getCookie: (name) => {
      const cookies = getCookies();
      return cookies[name] ?? "";
    },
    setCookie,
  });

  await storage.init();

  return new NodeClient(logtoConfig, {
    navigate: (url) => {
      throw redirect({ href: url });
    },
    storage,
  });
}
