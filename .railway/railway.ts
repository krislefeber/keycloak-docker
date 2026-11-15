import { database, defineRailway, github, group, preserve, project, service, volume } from "railway/iac";

export const partial = "keycloak";

export default defineRailway((ctx) => {
  if (ctx.projectId !== "185fc133-0498-45ad-af01-2e4fb6705a62" || ctx.environmentId !== "a1475191-2f61-4a8c-9220-f6498a6b3a3e") {
    throw new Error("Expected Envision Ink production");
  }

  const Postgres = database("Postgres", "postgres", {
    image: "ghcr.io/railwayapp-templates/postgres-ssl:latest",
    region: "us-east4-eqdc4a",
    defaultMountPath: "/var/lib/postgresql/data",
  });
  Postgres.deploy = { limitOverride: { containers: { cpu: 1, memoryBytes: 500000000 } } };
  Postgres.networking = { privateNetworkEndpoint: "postgres-2ebc" };
  const postgresData = volume("postgres-volume-3Qq_", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 500 });
  const Keycloak = service("Keycloak", {
    source: github("krislefeber/keycloak-docker", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "RAILPACK" },
    start: "/opt/keycloak/bin/kc.sh start --features=quick-theme",
    healthcheck: "/resources/master/admin/en",
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    domains: ["identity.envision.ink"],
    networking: { privateNetworkEndpoint: "keycloak" },
    env: {
      KC_DB: preserve(),
      KC_DB_PASSWORD: preserve(),
      KC_DB_POOL_MIN_SIZE: preserve(),
      KC_DB_URL: preserve(),
      KC_DB_USERNAME: preserve(),
      KC_FEATURES: preserve(),
      KC_HEALTH_ENABLED: preserve(),
      KC_HOSTNAME: preserve(),
      KC_HOSTNAME_STRICT: preserve(),
      KC_HOSTNAME_STRICT_BACKCHANNEL: preserve(),
      KC_HTTP_ENABLED: preserve(),
      KC_HTTP_PORT: preserve(),
      KC_METRICS_ENABLED: preserve(),
      KC_PROXY: preserve(),
      KEYCLOAK_ADMIN: preserve(),
      KEYCLOAK_ADMIN_PASSWORD: preserve(),
      PORT: preserve(),
      PROXY_ADDRESS_FORWARDING: preserve(),
      QUARKUS_TRANSACTION_MANAGER_ENABLE_RECOVERY: preserve(),
    },
  });
  return project("Envision Ink", { resources: [group("Keycloak", [Keycloak, Postgres]), postgresData] });
});
