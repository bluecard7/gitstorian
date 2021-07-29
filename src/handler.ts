import {
  Response,
  ServerRequest,
} from "https://deno.land/std@0.97.0/http/server.ts";
import {
  bookmark,
  DiffOptions,
  flip,
  order,
  readDiff,
  readFile,
} from "./api.ts";

function match(
  { method, url }: ServerRequest,
  expectedMethod: string,
  expectedURL: string,
): boolean {
  return method === expectedMethod && url.startsWith(expectedURL);
}

interface Handlers {
  readDiff: (opts: DiffOptions) => Promise<string[]>;
  readFile: (opts: DiffOptions) => Promise<string>;
  flip: (dir: string, opts: DiffOptions) => Promise<string[]>;
  bookmark: (hash: string) => void;
}

function formatPathMenu(statDiff: string[]): string[] {
  return statDiff.map((line) => line.split("|"))
    .reduce((acc, parts) => {
      parts.length === 2 && acc.push(parts[0].trim());
      return acc;
    }, []);
}

export async function handle(
  req: ServerRequest,
  handlers: Handlers = { readDiff, readFile, flip, bookmark },
): Promise<Response> {
  // to deal with CORS preflight
  if (match(req, "OPTIONS", "")) {
    return {
      status: 204,
      headers: new Headers({
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      }),
    };
  }
  const { readDiff, readFile, flip, bookmark } = handlers;
  if (match(req, "GET", "/diffs")) {
    const path = req.url.split("/").slice(2);
    const [hash, ...file] = path;
    if (!hash) {
      return { status: 400, body: "can't diff without a hash" };
    }
    const statDiff = await readDiff({ hash });
    let diff = statDiff;
    if (file.length) {
      diff = await readDiff({
        hash,
        path: decodeURIComponent(file.join("/")),
      });
    }
    return {
      status: 200,
      body: JSON.stringify({
        // todo: menu + order fetched in a different request?
        pathMenu: formatPathMenu(statDiff),
        diff,
        order: await order(hash),
      }),
    };
  }
  if (match(req, "GET", "/raw")) {
    const [hash, ...file] = req.url.split("/").slice(2);
    const path = decodeURIComponent(file.join("/"));
    if (!hash || !path) {
      return { status: 400, body: "can't read file without a hash or file" };
    }
    return { status: 200, body: await readFile({ hash, path }) };
  }
  if (match(req, "GET", "/commits")) {
    const [dir, hash, ...file] = req.url.split("/").slice(2);
    const path = decodeURIComponent(file.join("/"));
    const body = JSON.stringify(
      await flip(dir, { hash, path }),
    );
    return { status: 200, body };
  }
  if (match(req, "POST", "/bookmark")) {
    const [hash] = req.url.split("/").slice(2);
    bookmark(hash);
    return { status: 200 };
  }
  return { status: 404, body: "unknown path" };
}
