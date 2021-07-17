import {
  Response,
  ServerRequest,
} from "https://deno.land/std@0.97.0/http/server.ts";
import { bookmark, DiffOptions, flip, read } from "./api.ts";

function match(
  { method, url }: ServerRequest,
  expectedMethod: string,
  expectedURL: string,
): boolean {
  return method === expectedMethod && url.startsWith(expectedURL);
}

interface Handlers {
  read: (opts: DiffOptions) => Promise<string[]>;
  flip: (order: string, opts: DiffOptions) => Promise<string[]>;
  bookmark: (page: string[]) => void;
}

function formatPathMenu(statDiff: string[]): string[] {
  return statDiff.map(line => line.split('|'))
    .reduce((acc, parts) => {
      parts.length === 2 && acc.push(parts[0].trim())
      return acc
    }, [])
}

export async function handle(
  req: ServerRequest,
  handlers: Handlers = { read, flip, bookmark },
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
  const { read, flip, bookmark } = handlers;
  if (match(req, "GET", "/diffs")) {
    const path = req.url.split("/").slice(2);
    const [hash, ...file] = path;
    if (!hash) {
      return { status: 400, body: "can't read without a hash" };
    }
    const statDiff = await read({ hash })
    return { 
      status: 200, 
      body: JSON.stringify({
        pathMenu: formatPathMenu(statDiff),
        diff: file.length 
          ? (await read({ hash, path: file.join("/") }))
          : statDiff,
      })
    };
  }
  if (match(req, "GET", "/commits")) {
    const path = req.url.split("/").slice(2);
    const [order, hash, ...file] = path;
    const body = JSON.stringify(
      await flip(order, { hash, path: file.join("/") }),
    );
    return { status: 200, body };
  }
  if (match(req, "POST", "/bookmark")) {
    const raw = await Deno.readAll(req.body);
    const page = JSON.parse(new TextDecoder().decode(raw));
    bookmark(page);
    return { status: 200 };
  }
  return { status: 404, body: "unknown path" };
}
