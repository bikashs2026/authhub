# Rolling out the login hub — step by step

Do these in order. Each step is safe to stop after if you want to pick this
up later — nothing is destructive, and the nginx changes are a comment-out
(not a delete), so reverting is always one line.

## 0. Generate the shared secret (once)

```bash
openssl rand -hex 32
```

Save that value — you'll paste the exact same string into three `.env` files
below. If it ever differs between them, logins just silently fail to verify
(you'll see yourself redirected back to `/login` in a loop) — never a crash,
but confusing, so get it right once.

## 1. DNS

Add an A record for `login.ishansahoo.com` pointing at the same IP your
other two subdomains use. Do this first — certbot in step 3 needs it to
already resolve.

## 2. Deploy authhub itself

```bash
cd ~
git clone <your-new-authhub-repo-url> authhub
cd authhub
npm install
cp .env.example .env
nano .env
```

Fill in `.env`:
- `AUTH_COOKIE_SECRET` — the value from step 0
- `AUTH_OWNER_USER` / `AUTH_OWNER_PASSWORD` — your own login (pick a real
  password, 8+ chars)
- `HUB_BOLDTICK_LOCAL_URL` / `HUB_TRADEFORGE_LOCAL_URL` if your local dev
  ports aren't 3100/3000 — these only matter on the machine you browse from
  while both apps are running locally
- leave the rest at their defaults

```bash
sudo cp deploy/authhub.service /etc/systemd/system/authhub.service
```

Open `/etc/systemd/system/authhub.service` and check `WorkingDirectory`
matches where you actually cloned it (it assumes `/home/ubuntu/authhub` —
adjust if your boldtick/tradeforge services use a different convention,
`cat /etc/systemd/system/boldtick.service` to check).

```bash
sudo systemctl daemon-reload
sudo systemctl enable authhub
sudo systemctl start authhub
sudo systemctl status authhub   # should say "active (running)"
```

## 3. nginx + SSL for login.ishansahoo.com

```bash
sudo cp deploy/nginx-login.conf /etc/nginx/sites-available/login
sudo ln -s /etc/nginx/sites-available/login /etc/nginx/sites-enabled/login
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d login.ishansahoo.com
```

Certbot will rewrite that file to add the HTTPS block and redirect, the same
way it already did for the other two sites.

## 4. Test the hub on its own — don't touch TradeForge/BoldTick yet

Visit `https://login.ishansahoo.com`. You should land on `/login`. Sign in
with your `AUTH_OWNER_USER`/`AUTH_OWNER_PASSWORD`. Confirm:
- you land on the hub page with a "Sites" grid (BoldTick, BoldTick local,
  TradeForge, TradeForge local, Auth, Marketdata) and a "Favorites" section
  below it — clicking the site links is fine, they'll still open the OLD
  nginx Basic Auth prompt right now, that's expected, you haven't changed
  those sites yet
- try adding a favorite link (name + URL) and confirm it shows up and can
  be removed
- `/admin` loads and shows your owner account
- try `/register` in a private/incognito window, create a test account,
  confirm it shows up as "pending" in `/admin`, approve it, confirm you can
  then log in as that test account and see only the four non-owner site
  links (no Auth/Marketdata, no Favorites add-form) on the hub page

If all of that works, the hub itself is solid. Nothing else has changed yet
— TradeForge and BoldTick are both still exactly as they were.

## 5. BoldTick — switch it over

```bash
cd ~/boldtick
git pull
```

Edit `.env`, add (same secret as step 0):
```
AUTH_COOKIE_SECRET=<the value from step 0>
```

```bash
sudo systemctl restart boldtick
```

At this point BoldTick will accept the hub's cookie *in addition to* the old
Basic Auth — both still work, nothing breaks. Now drop nginx's layer so the
cookie is the only gate:

```bash
sudo nano /etc/nginx/sites-available/boldtick
```

Find this block inside `location /`:
```
auth_basic "BoldTick";
auth_basic_user_file /etc/nginx/.htpasswd;
```
Comment both lines out (prefix each with `#`) rather than deleting them —
that way reverting later is uncommenting two lines, not retyping them.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Now visit `https://boldtick.ishansahoo.com/` in a browser that has **not**
already got a BoldTick Basic Auth prompt cached (or just use a private
window) — you should get redirected straight to `login.ishansahoo.com/login`,
and after signing in, land back on BoldTick, logged in. Test:
- as owner: everything works as before (approve/reject ideas, settings, kill switch)
- as your test viewer account (from step 4): pages load, but clicking
  Approve/Reject/Settings changes should fail with a clear "read-only"
  error toast rather than succeeding

If something's wrong, revert instantly: uncomment the two `auth_basic` lines,
`sudo nginx -t && sudo systemctl reload nginx` — BoldTick is back to exactly
how it was before this step.

## 6. TradeForge — switch it over

Same pattern:

```bash
cd ~/tradeforge
git pull
```

Edit `.env`, add the same secret:
```
AUTH_COOKIE_SECRET=<the value from step 0>
```

```bash
sudo systemctl restart tradeforge   # (or whatever your actual service name is)
```

Then:

```bash
sudo nano /etc/nginx/sites-available/tradeforge
```

Comment out the two lines inside `location /`:
```
auth_basic "TradeForge";
auth_basic_user_file /etc/nginx/.htpasswd;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Test the same way: private window → `https://www.ishansahoo.com/` →
redirected to login → sign in → land back on TradeForge. Confirm
`/auth/trading` and `/auth/marketdata` still work for you (owner), and that
your viewer test account gets a "read-only" message if it tries to hit them
directly.

## 7. Clean up (once you're confident, maybe after a day or two)

- Delete the commented-out `auth_basic` lines from both nginx configs for
  real, since you won't be reverting at this point.
- `/etc/nginx/.htpasswd` is no longer used by either site — safe to leave it
  (harmless) or delete it.
- If `PAPER_AUTH_MODE`/`PAPER_OWNER_USER`/`PAPER_OWNER_PASSWORD` in
  BoldTick's `.env` are still set, you can leave them — they're now just a
  dormant fallback that only matters if `AUTH_COOKIE_SECRET` is ever unset.

## Notes

- **Forgot password** has no real email sending yet — a user's "Forgot
  password" request shows up under Password-reset requests in `/admin`; you
  click "Generate link" and get a one-time URL (valid 1 hour) to copy and
  send them yourself however you like (text, email, whatever). If you want
  real automated email later, that's a follow-up (needs SES or SMTP creds).
- **Viewer accounts currently still see the same buttons** (Approve, Reject,
  Settings, etc.) on BoldTick's pages as the owner does — clicking them just
  fails with a clear error, rather than being hidden. Backend access is
  correctly locked down either way; hiding the buttons for a nicer viewer
  experience is a smaller follow-up if you want it.
- **Favorite links** on the hub page are owner-managed (add/remove) and
  stored in `authhub/data/links.json` — no code or redeploy needed to add
  one, just use the form on the hub page while logged in as owner.
- Nothing in this rollout touches Muse's access (`X-API-Key` on
  `/api/external/*` and `/api/paper/*`) — that path was never behind nginx's
  Basic Auth and isn't behind the new login either.
