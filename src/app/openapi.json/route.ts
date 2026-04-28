import { openApiSpec, originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json(openApiSpec(originFromRequest(request)));
}
