import https from "node:https";
import { type NextRequest, NextResponse } from "next/server";

const agent = new https.Agent({ family: 4, keepAlive: true });

async function proxy(request: NextRequest, { path }: { path: string[] }) {
  const targetPath = path ? path.join("/") : "";
  const search = request.nextUrl.search;
  const targetUrl = `https://tokenaires.cc/api/v1/${targetPath}${search}`;

  return new Promise<NextResponse>((resolve) => {
    const upstream = https.request(
      targetUrl,
      {
        method: request.method,
        agent,
        headers: {
          host: "tokenaires.cc",
          accept: request.headers.get("accept") ?? "*/*",
          "user-agent": request.headers.get("user-agent") ?? "tokenaires-proxy",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const responseHeaders = new Headers();
          const contentType = res.headers["content-type"];
          if (contentType) responseHeaders.set("content-type", contentType);
          const cacheControl = res.headers["cache-control"];
          if (cacheControl) responseHeaders.set("cache-control", cacheControl);
          resolve(new NextResponse(body, { status: res.statusCode ?? 200, headers: responseHeaders }));
        });
      },
    );

    upstream.on("error", (err) => {
      resolve(NextResponse.json({ error: "Upstream request failed", details: err.message }, { status: 502 }));
    });

    if (request.body && request.method !== "GET" && request.method !== "HEAD") {
      request.arrayBuffer().then((buf) => {
        upstream.write(Buffer.from(buf));
        upstream.end();
      }).catch(() => upstream.end());
    } else {
      upstream.end();
    }
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, { path });
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, { path });
}
