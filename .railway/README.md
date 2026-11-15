# Keycloak on Railway

This repository owns the production `keycloak` partial in Envision Ink. Use
Railway CLI 5.71.0 and Node 24. The production project, environment, and
Keycloak service IDs are recorded in `deploy.ts`.

## Claim existing resources

Use the adoption commit (`b8aaacc`), which retains the existing GitHub source.
Verify you have a restorable PostgreSQL backup. From that checkout, run:

```sh
railway link --project 185fc133-0498-45ad-af01-2e4fb6705a62 \
  --environment a1475191-2f61-4a8c-9220-f6498a6b3a3e \
  --service 1ac8e8ed-404f-43a4-93de-ebfe64dd5983
npm ci --prefix .railway
npm --prefix .railway run check
railway config partials list
railway config plan --environment production --out .railway/production.plan
```

Confirm that the four addresses below are unowned and that the plan reports
zero resource changes. Record the active Keycloak and PostgreSQL deployments and
confirm that PostgreSQL service `4a1f0fe3-6924-48de-bcee-606744b794a2` mounts
volume `387f6973-0078-4354-b4a3-f6ff980015a7` at `/var/lib/postgresql/data`.
The importer omits managed PostgreSQL attachments. The partial declares the
existing volume by name. Explicitly declaring the attachment causes the planner
to propose a mount update, so verify the mount in Railway instead.

Apply the reviewed plan with
`railway config apply --plan .railway/production.plan --yes`. Check
`railway config partials list` and verify that `keycloak` now owns
`service.Keycloak`, `database.Postgres`, `volume.postgres-volume-3Qq_`, and
`group.Keycloak`. Verify the volume, active deployments, realm discovery, and
portal sign-in against the pre-apply record.

## Cut over to GitLab

After ownership is confirmed, publish the cutover commit to the GitLab
repository. Protect the default branch and the production environment, restrict
deployment to maintainers, and add a masked, protected `RAILWAY_TOKEN` scoped
to the production environment. Use a Railway production project token.

Review the protected branch pipeline's pinned plan. For the first release,
expect only the GitHub source being cleared on `Keycloak`. Run the manual
production job in that same pipeline. If Railway rejects a stale plan, run a new
pipeline and review its plan before retrying. The job applies the pinned plan,
uploads its commit to the existing service, and waits for that deployment and
realm discovery. Verify portal sign-in after the job passes.

If post-deploy checks fail, inspect the exact deployment's Railway logs. Use the
recorded working deployment's Railway rollback if necessary. Keycloak upgrades
that migrate the database require a separate database rollback plan.
