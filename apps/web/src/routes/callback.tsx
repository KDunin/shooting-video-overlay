import { createFileRoute, redirect } from "@tanstack/react-router";
import { getLogToClient } from "#/lib/logto";

export const Route = createFileRoute("/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const logtoClient = await getLogToClient();
        await logtoClient.handleSignInCallback(request.url);
        return redirect({ to: "/" });
      },
    },
  },
});
