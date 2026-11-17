import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const [environment, option, ...extraArgs] = process.argv.slice(2);
if (environment !== "production" || (option !== undefined && option !== "--check-ownership") || extraArgs.length) {
  throw new Error("Usage: node .railway/deploy.ts production [--check-ownership]");
}

const revision = process.env.CI_COMMIT_SHA;
if (process.env.GITLAB_CI !== "true" || process.env.CI_COMMIT_REF_PROTECTED !== "true" || !revision) {
  throw new Error("Run this from the protected GitLab production job.");
}

const productionEnvironmentId = "a1475191-2f61-4a8c-9220-f6498a6b3a3e";
if (option === "--check-ownership") {
  const { environmentId, iacPartials } = JSON.parse(execFileSync("railway", [
    "config", "partials", "list", "--json",
  ], { encoding: "utf8" })) as { environmentId?: string; iacPartials?: Record<string, string> };
  const requiredResources = [
    "service.Keycloak",
    "database.Postgres",
    "volume.postgres-volume-3Qq_",
    "group.Keycloak",
  ];
  if (environmentId !== productionEnvironmentId ||
      requiredResources.some(address => iacPartials?.[address] !== "keycloak")) {
    throw new Error("Complete production Keycloak IaC adoption before deploying.");
  }
  process.exit(0);
}

const target = [
  "--project", "185fc133-0498-45ad-af01-2e4fb6705a62",
  "--environment", productionEnvironmentId,
  "--service", "1ac8e8ed-404f-43a4-93de-ebfe64dd5983",
];
const upload = JSON.parse(execFileSync("railway", [
  "up", ...target, "--detach", "--json", "--message", `GitLab commit ${revision}`,
], { encoding: "utf8" })) as { deploymentId?: string };
if (!upload.deploymentId) {
  throw new Error("Railway did not return a deployment ID.");
}

const deploymentId = upload.deploymentId;
console.log(`Waiting for Railway deployment ${deploymentId}`);
const failed = new Set(["FAILED", "CRASHED", "REMOVED", "SKIPPED", "COMPLETED", "CANCELLED"]);
const deadline = Date.now() + 20 * 60_000;

while (Date.now() < deadline) {
  const deployments = JSON.parse(execFileSync("railway", [
    "deployment", "list", ...target, "--limit", "20", "--json",
  ], { encoding: "utf8", timeout: 30_000 })) as Array<{ id: string; status: string }>;
  const status = deployments.find(({ id }) => id === deploymentId)?.status;
  if (status && failed.has(status)) {
    throw new Error(`Deployment ${deploymentId} ended with status ${status}. Check Railway logs.`);
  }
  if (status === "SUCCESS") {
    const issuerUrl = "https://keycloak-production-2d75.up.railway.app/realms/envision-production";
    const response = await fetch(`${issuerUrl}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Realm discovery returned HTTP ${response.status}.`);
    }
    const discovery = await response.json() as { issuer?: string };
    if (discovery.issuer !== issuerUrl) {
      throw new Error("Production realm discovery returned an unexpected issuer.");
    }
    console.log(`Deployment ${deploymentId} passed production realm discovery.`);
    process.exit(0);
  }

  await setTimeout(10_000);
}

throw new Error(`Deployment ${deploymentId} did not succeed within 20 minutes.`);
