import { searchShopifyProducts, shopifyConfig } from "@/server/shopifyCommerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 5), 1), 10);
  const config = shopifyConfig();

  if (!config.configured) {
    return Response.json(
      {
        error: "SHOPIFY_SHOP_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN are required.",
        configured: false,
      },
      { status: 503 },
    );
  }

  if (!query) {
    return Response.json({ error: "query is required." }, { status: 400 });
  }

  try {
    const variants = await searchShopifyProducts(query, limit);
    return Response.json({
      product: "Jiagon Shopify agent product search",
      configured: true,
      shopDomain: config.shopDomain,
      query,
      variants,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Shopify product search failed.",
        configured: true,
      },
      { status: 502 },
    );
  }
}
