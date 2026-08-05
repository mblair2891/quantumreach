"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

/**
 * Browser Better Auth client (email/password + username plugin).
 */
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
