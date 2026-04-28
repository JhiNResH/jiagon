const product = {
  name: "Jiagon",
  title: "Jiagon verified local recommendation API",
  description: "Receipt-backed local recommendation data for agents.",
  version: "0.1.0",
};

const proofLevels = {
  A: "Onchain card spend event.",
  B: "BNB testnet receipt credential minted from verified payment and user-claimed merchant.",
  C: "User-claimed merchant on top of verified payment.",
  D: "Self-claimed review without payment proof.",
};

const privacy =
  "Recommendations use published or aggregate receipt-backed review signals. Private receipt inbox data stays user-scoped.";

export function originFromRequest(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function agentDiscovery(origin: string) {
  return {
    ...product,
    homepage: origin,
    privacy,
    humanDocs: `${origin}/api/agent`,
    openapi: `${origin}/openapi.json`,
    wellKnown: `${origin}/.well-known/jiagon-agent.json`,
    primaryUseCase: "Ask Jiagon for local recommendations backed by verified receipt signals.",
    exampleUserIntent: "I want coffee near Irvine. Recommend a place with receipt-backed reviews.",
    exampleAgentCall: {
      method: "GET",
      url: `${origin}/api/agent/recommendations?query=coffee%20irvine&limit=3`,
    },
    exampleRerankCall: {
      method: "POST",
      url: `${origin}/api/agent/rerank`,
      body: {
        query: "coffee irvine",
        candidates: [
          {
            provider: "google",
            placeId: "ChIJ...",
            name: "85C Bakery Cafe",
            branch: "Irvine",
            category: "Cafe",
            rating: 4.4,
            openNow: true,
          },
        ],
      },
    },
    endpoints: {
      recommendations: {
        method: "GET",
        url: `${origin}/api/agent/recommendations`,
        query: {
          query: "Free text need, category, merchant, or location. Example: coffee irvine.",
          limit: "Optional integer from 1 to 5.",
        },
        returns: [
          "ranked merchant recommendations",
          "proof level boundaries",
          "agent-readable reasons",
          "aggregate verified visits and wallets",
          "credential chain and source chain context",
        ],
      },
      rerank: {
        method: "POST",
        url: `${origin}/api/agent/rerank`,
        body: {
          query: "Free text user intent. Example: coffee irvine.",
          candidates: "Candidate places from Google Places or another place graph. Jiagon does not need to own the full place graph.",
        },
        returns: [
          "candidate ranking with Jiagon proof boost",
          "matched receipt-backed signals when available",
          "proof caveats for candidates without Jiagon data",
        ],
      },
      publishedReviews: {
        method: "GET",
        url: `${origin}/api/receipts/reviews`,
        query: {
          limit: "Optional integer from 1 to 100.",
        },
        returns: [
          "published receipt-backed review signals",
          "public proof ids",
          "credential transaction metadata",
          "storage URI and data hash",
        ],
      },
    },
    proofLevels,
    architecture: {
      sourceChain: "optimism",
      credentialChain: "bnb-testnet",
      storageLayer: "greenfield-testnet",
      flow: "OP Spend event -> Jiagon verification -> BNB testnet receipt credential -> Greenfield data object -> agent API",
    },
  };
}

export function openApiSpec(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: product.title,
      description: product.description,
      version: product.version,
    },
    servers: [{ url: origin }],
    tags: [
      {
        name: "Agent",
        description: "Agent-readable recommendation and receipt proof data.",
      },
    ],
    paths: {
      "/api/agent": {
        get: {
          tags: ["Agent"],
          summary: "Discover Jiagon agent API endpoints.",
          operationId: "getJiagonAgentDocs",
          responses: {
            "200": {
              description: "Agent discovery metadata.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentDiscovery" },
                },
              },
            },
          },
        },
      },
      "/api/agent/recommendations": {
        get: {
          tags: ["Agent"],
          summary: "Get receipt-backed local recommendations.",
          operationId: "getJiagonRecommendations",
          parameters: [
            {
              name: "query",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Free text place, category, or local need. Example: coffee irvine.",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 5, default: 3 },
            },
          ],
          responses: {
            "200": {
              description: "Ranked recommendations with proof context.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RecommendationResponse" },
                },
              },
            },
            "503": {
              description: "Receipt memory store unavailable.",
            },
          },
        },
      },
      "/api/agent/rerank": {
        post: {
          tags: ["Agent"],
          summary: "Rerank external place candidates with Jiagon receipt proof.",
          operationId: "rerankPlaceCandidatesWithJiagonProof",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RerankRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Candidates ranked with Jiagon proof boosts.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RerankResponse" },
                },
              },
            },
            "400": {
              description: "Invalid candidate request.",
            },
            "503": {
              description: "Receipt memory store unavailable.",
            },
          },
        },
      },
      "/api/receipts/reviews": {
        get: {
          tags: ["Agent"],
          summary: "List published receipt-backed review signals.",
          operationId: "listPublishedReceiptReviews",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            "200": {
              description: "Published review signals and public credential metadata.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReceiptReviewsResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        AgentDiscovery: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            endpoints: { type: "object" },
            proofLevels: { type: "object" },
          },
        },
        RecommendationResponse: {
          type: "object",
          properties: {
            query: { type: "string" },
            product: { type: "string" },
            dataSource: { type: "string", enum: ["postgres-merchant-signals", "empty"] },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  branch: { type: "string" },
                  category: { type: "string" },
                  averageRating: { type: "number" },
                  verifiedVisits: { type: "integer" },
                  verifiedWallets: { type: "integer" },
                  proofLevel: { type: "object" },
                  reasons: { type: "array", items: { type: "string" } },
                  agentScore: { type: "number" },
                },
              },
            },
          },
        },
        RerankRequest: {
          type: "object",
          required: ["candidates"],
          properties: {
            query: { type: "string", examples: ["coffee irvine"] },
            candidates: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: {
                type: "object",
                properties: {
                  provider: { type: "string", examples: ["google"] },
                  placeId: { type: "string", description: "Google place_id or equivalent provider id." },
                  name: { type: "string" },
                  branch: { type: "string" },
                  category: { type: "string" },
                  rating: { type: "number" },
                  distanceMeters: { type: "number" },
                  openNow: { type: "boolean" },
                },
              },
            },
          },
        },
        RerankResponse: {
          type: "object",
          properties: {
            query: { type: "string" },
            product: { type: "string" },
            usage: { type: "string" },
            ranked: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  placeId: { type: ["string", "null"] },
                  name: { type: "string" },
                  baseScore: { type: "number" },
                  jiagonBoost: { type: "number" },
                  agentScore: { type: "number" },
                  jiagonProof: { type: "object" },
                  reasons: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        ReceiptReviewsResponse: {
          type: "object",
          properties: {
            product: { type: "string" },
            privacy: { type: "string" },
            reviews: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  merchant: { type: "string" },
                  branch: { type: "string" },
                  rating: { type: "integer" },
                  proofLevel: { type: "string" },
                  publicProofId: { type: "string" },
                  credentialChain: { type: "string" },
                  credentialTx: { type: ["string", "null"] },
                  dataHash: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    "x-agent-example": {
      user: "I want coffee near Irvine. Recommend somewhere reliable.",
      call: `GET ${origin}/api/agent/recommendations?query=coffee%20irvine&limit=3`,
      rerankCall: `POST ${origin}/api/agent/rerank with Google Places candidates`,
      decision: "Use Google or another place graph for candidates; use Jiagon agentScore and jiagonProof to boost receipt-backed places.",
    },
  };
}
