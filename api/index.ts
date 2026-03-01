import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

let initialized: Promise<void> | null = null;

function ensureInitialized() {
  if (initialized) {
    return initialized;
  }

  initialized = (async () => {
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );

    app.use(express.urlencoded({ extended: false }));

    await registerRoutes(httpServer, app);

    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });
  })();

  return initialized;
}

export default async function handler(req: any, res: any) {
  await ensureInitialized();
  return app(req, res);
}
