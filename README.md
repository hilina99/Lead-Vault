# Lead Vault — Netlify

A regular Next.js lead directory that reads its data directly from a CSV file.

## Add the real leads

Replace `public/leads.csv` with the CSV exported from Skrapp. Keep the filename
exactly `leads.csv`. Common Skrapp column names are matched automatically.

Because the CSV ships with the website, every visitor can download its contents.
Only deploy this site if that access level is appropriate for the lead data.

## Run locally

```bash
pnpm install
pnpm dev
```

## Deploy on Netlify

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new project** and **Import from Git**.
3. Select the repository.
4. Netlify will use `pnpm build` automatically.
5. Deploy the site. No publish directory or separate `index.html` is required.
