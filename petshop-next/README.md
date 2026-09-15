# Dizon's Petshop — Next.js

This is the new Next.js App Router and TypeScript foundation for the petshop system. It includes a premium public landing page, separate client and administrator portals, dashboard previews, and a built-in `/how-to-run` guide.

## How to run this

1. Install the current Node.js LTS release from https://nodejs.org.
2. Open PowerShell in this folder.
3. Install dependencies:

   ```powershell
   npm install
   ```

4. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Configure the Supabase PostgreSQL pooler URLs. Use the transaction-mode pooler
   for application traffic and the session-mode pooler for direct Prisma commands:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@SUPABASE_POOLER_HOST:6543/postgres?pgbouncer=true&sslmode=require"
   DIRECT_URL="postgresql://USER:PASSWORD@SUPABASE_POOLER_HOST:5432/postgres?sslmode=require"
   ```

   Generate `AUTH_SECRET` with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Start the development server:

   ```powershell
   npm run dev
   ```

6. Open http://localhost:3000.

## Open it on another device

Run:

```powershell
npm run dev -- --hostname 0.0.0.0
ipconfig
```

Find the server computer's IPv4 address. On another device connected to the same Wi-Fi, open `http://YOUR-IP:3000`. Allow Node.js through Windows Firewall on private networks if prompted. The server computer must remain powered on.

## Production check

```powershell
npm run build
npm run start -- --hostname 0.0.0.0
```

## Database and access

Prisma maps the existing Supabase PostgreSQL tables in `prisma/schema.prisma`. Client and administrator logins query the database independently and create signed, HTTP-only role sessions. The proxy blocks client sessions from every `/admin/dashboard` route.

The database must contain a user whose `role` is `Admin` before the private administrator URL can authenticate. First create the owner's normal account, then promote it locally from this project folder:

```powershell
npm run make-admin -- owner@example.com
```

Replace the email with the owner's registered email. This command writes the `Admin` role directly to PostgreSQL; there is intentionally no administrator registration or administrator-login link on the public website.

For Vercel, add `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET` under Project Settings > Environment Variables and enable them for Production. Never commit real connection strings. Redeploy after changing environment variables.

The Supabase database contains production data, so do not run `prisma migrate reset`,
`prisma db push`, or a destructive migration. To compare the Prisma schema with the
existing database safely, inspect introspection output without changing the schema:

```powershell
npx prisma db pull --print
```
