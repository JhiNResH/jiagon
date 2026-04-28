import { agentDiscovery, originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originFromRequest(request);
  const discovery = agentDiscovery(origin);

  return Response.json({
    schema: "https://jiagon.app/schemas/agent-discovery.v0.json",
    name: discovery.name,
    description: discovery.description,
    version: discovery.version,
    homepage: discovery.homepage,
    openapi: discovery.openapi,
    privacy: discovery.privacy,
    tools: [
      {
        name: "get_receipt_backed_recommendations",
        description: "Get local recommendations backed by published receipt credentials and review signals.",
        method: "GET",
        url: discovery.endpoints.recommendations.url,
        parameters: discovery.endpoints.recommendations.query,
      },
      {
        name: "rerank_place_candidates_with_receipt_proof",
        description: "Rerank Google Places or other place graph candidates with Jiagon receipt-backed proof.",
        method: "POST",
        url: discovery.endpoints.rerank.url,
        parameters: discovery.endpoints.rerank.body,
      },
      {
        name: "list_published_receipt_reviews",
        description: "List public receipt-backed reviews and credential metadata.",
        method: "GET",
        url: discovery.endpoints.publishedReviews.url,
        parameters: discovery.endpoints.publishedReviews.query,
      },
    ],
    proofLevels: discovery.proofLevels,
    example: discovery.exampleRerankCall,
  });
}
