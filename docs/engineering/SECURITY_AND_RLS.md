# A L T E R . — Security and Row-Level Security

## 1. Authorization rule

Application authorization is based only on `auth.uid()`. Ownership helper:

```sql
create function public.current_anonymous_user_id()
returns uuid language sql stable security definer
set search_path = public, auth
as $$
  select id from public.anonymous_users where auth_user_id = auth.uid()
$$;
```

The function is executable by authenticated users but exposes only their mapped ID.

## 2. RLS matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `anonymous_users` | own row | trigger only | own non-identity fields via RPC | server only |
| `onboarding_state` | own | RPC | RPC | none |
| `sessions` | none to client | RPC | RPC | none |
| `events` | none | ingestion RPC only | none | none |
| `event_quarantine` | service role | service role | service role | service role |
| `products` | active rows, approved fields | service role | service role | service role |
| `wardrobes` | own | trigger/RPC | own name only if later exposed | none |
| `saved_products` | own | RPC | RPC | none |
| `challenges` | active/public definitions | service role | service role | service role |
| `challenge_progress` | own | RPC | RPC | none |
| `challenge_progress_items` | own through parent | RPC | RPC | none |
| `challenge_completions` | own | RPC | none | none |
| `feed_instances` | own | RPC | RPC | none |
| `feed_instance_products` | own through parent | RPC | none | none |
| `continuation_dismissals` | own | RPC | RPC | none |

Direct DML grants are revoked for protected state tables even when RLS exists. Clients use RPCs.

## 3. Policy pattern

```sql
create policy own_saved_products_select
on public.saved_products for select
to authenticated
using (anonymous_user_id = public.current_anonymous_user_id());
```

Child-table policies use an `exists` join to the owner-scoped parent. Public catalog policies expose only active records; private source metadata is placed in a separate service-only table if needed.

## 4. Service-role restrictions

The service role exists only in server runtime secret storage and migration/operations jobs. It is prohibited in browser bundles, preview logs, client error reports, and test snapshots. Routine user mutations must not use service role; they execute with the end-user JWT so RLS remains active.

## 5. Input and abuse controls

- Zod validation at route/action boundary plus PostgreSQL constraints.
- Request body limits: 64 KB mutation, 256 KB telemetry batch.
- Telemetry batch max: 50 events.
- Rate limits by hashed IP and auth user: 120 event batches/minute, 60 mutations/minute, stricter limits on identity creation.
- Operation IDs and event IDs must be UUIDv4.
- Reject unknown event fields in strict schemas.
- Never log event properties, JWTs, preference lists, or full IP addresses.
- Catalog import is privileged and validates image hosts and text length.

## 6. Secrets and environment variables

Browser-exposed: Supabase URL, publishable/anon key, app version, release ID.

Server-only: service-role key, observability DSN secret, rate-limit credentials, deployment tokens. Environment schemas fail startup when required values are absent.

## 7. Privacy

No names, email addresses, free-text profile data, precise location, contacts, or sensitive categories are collected for LR-001. Raw event retention of 24 months is provisional. A privacy, deletion, and retention review is mandatory before public-scale launch.
