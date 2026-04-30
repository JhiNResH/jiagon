import { buildSolanaCreditMirror } from "@/lib/solanaCredit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Solana credit mirror requires a JSON request." }, { status: 415 });
  }

  try {
    const body = await request.json();
    const mirror = buildSolanaCreditMirror({
      owner: body?.owner,
      receipt: body?.receipt,
      review: body?.review,
      credential: body?.credential,
    });

    return Response.json(mirror);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build Solana credit PDA mirror.",
      },
      { status: 500 },
    );
  }
}
