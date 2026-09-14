# Lead Vault — large CSV edition

Lead Vault is a Next.js lead directory designed for large Skrapp exports. The
browser never downloads the full CSV. During deployment, the build converts the
CSV into an indexed SQLite database; the app then requests only 50 leads at a
time through server-side search and filters.

## Add or replace the leads

1. Put the combined Skrapp export at `data/leads.csv`.
2. Keep that filename exactly the same.
3. Commit and push the change.
4. Netlify rebuilds the indexed database automatically.

The source CSV is outside `public`, so visitors cannot directly download the
77 MB file. They can still export selected or filtered leads through the app.

## Run locally

Use Node.js 22 or newer:

```bash
pnpm install
pnpm dev
```

The development server builds `data/leads.db` the first time the API is used
only if you first run:

```bash
pnpm generate-data
```

## Deploy on Netlify

1. Push the project to GitHub.
2. In Netlify, choose **Add new project** and **Import from Git**.
3. Select the repository.
4. Netlify runs `pnpm build`, which generates the index and builds Next.js.

No publish directory or separate `index.html` is required.

## Performance behavior

- Only 50 leads are returned per page.
- Search and filters run against a server-side index.
- Typing is debounced to reduce repeated requests.
- Large CSV exports stream on demand instead of being built in browser memory.
- The generated database is ignored by Git and rebuilt whenever `data/leads.csv` changes.
