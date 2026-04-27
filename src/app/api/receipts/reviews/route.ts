import { listReceiptReviews } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 50);
  const result = await listReceiptReviews(limit);

  return Response.json({
    product: "Jiagon verified receipt review layer",
    privacy: "Only published review and public credential fields are returned. Private receipt inbox data should stay user-scoped.",
    persistence: {
      configured: result.configured,
      error: result.error,
    },
    reviews: result.reviews,
  });
}
