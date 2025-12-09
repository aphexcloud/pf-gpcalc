import { auth } from "@/lib/auth";
import { toNodeHandler } from "better-auth/node";

// For Pages Router, we need to use toNodeHandler
const handler = toNodeHandler(auth);

export default async function authHandler(req, res) {
  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
