import { handleMintReceiptRequest } from "@/app/api/receipts/mint/route";

export const runtime = "nodejs";

const LOCAL_DEMO_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalDemoHost(request: Request) {
  const requestHost = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!requestHost) return false;
  return LOCAL_DEMO_HOSTS.has(requestHost);
}

export async function POST(request: Request) {
  if (process.env.JIAGON_APP_MINT_ENABLED !== "true") {
    return Response.json(
      {
        error: "App receipt publishing is disabled on this server.",
      },
      { status: 403 },
    );
  }

  if (!isLocalDemoHost(request)) {
    return Response.json(
      {
        error: "App receipt publishing is only available for local demos.",
      },
      { status: 403 },
    );
  }

  const mintToken = (process.env.JIAGON_MINT_API_TOKEN || "").trim();
  if (!mintToken) {
    return Response.json(
      {
        error: "Server mint token is not configured.",
      },
      { status: 500 },
    );
  }

  return handleMintReceiptRequest(request, mintToken);
}
