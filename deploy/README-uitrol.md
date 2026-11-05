# Uitrol: HisarWeb AI als Docker-Compose-app

Deze map hoort bij het productie-image en de compose van de gateway (fork van new-api).
Bestanden: `deploy/Dockerfile` (image), `deploy/docker-compose.yml` (app + eigen PostgreSQL),
dit bestand (recept). De root-`Dockerfile` en root-`docker-compose.yml` van upstream blijven
ongemoeid; die blijven voor upstream-releases en lokale ontwikkeling.

## Wat de app nodig heeft

| Soort | Naam | Verplicht | Betekenis |
|---|---|---|---|
| poort | `APP_HTTP_PORT` | nee (3000) | hostpoort die naar de containerpoort 3000 gaat |
| app | `APP_ENV` | nee (vast `production` in de compose) | productiestand. De compose zet hem vast op `production`, nooit via `${...}`: alleen `development` of `test` zet de productiecontroles uit, een lege of onbekende waarde geldt als productie |
| app | `BATCH_UPDATE_ENABLED` | nee (vast `false` in de compose) | moet uit blijven. Staat hij aan, dan wacht verbruik in het geheugen terwijl de vervalronde van tegoedpakketten `users.quota` leest, en dan wordt hetzelfde verbruik twee keer van het klanttegoed afgetrokken. Niet in Coolify zetten: de compose zet de waarde vast, nooit via `${...}` |
| app | `PORT` | nee (3000) | poort binnen de container; laat staan |
| app | `HW_SETUP_TOKEN` | ja | eenmalig geheim dat `POST /api/setup` in productie eist, als kop `X-HW-Setup-Token`; zonder deze variabele weigert productie elke setup (403) en kan er geen beheerder ontstaan. Maak hem met `openssl rand -hex 32`; na de eerste setup mag hij leeg |
| app | `HW_CSP_EXTRA_FRAME_SRC`, `HW_CSP_EXTRA_CONNECT_SRC`, `HW_CSP_EXTRA_IMG_SRC`, `HW_CSP_EXTRA_STYLE_SRC`, `HW_CSP_EXTRA_FONT_SRC` | nee | per CSP-richtlijn een kommagescheiden lijst van kale https-origins (logo, font, een pagina in een frame). Onze console configureert geen externe home-, over- of chatpagina, dus `frame-src` blijft `'none'` zonder deze variabele. Wat geen https-origin is, wordt genegeerd; `script-src` is niet te verruimen en houdt de hashes zonder `'unsafe-inline'` of `'unsafe-eval'` |
| app | `SESSION_SECRET` | ja | souscheidsleutel voor sessies; willekeurig, minstens 32 tekens |
| app | `CRYPTO_SECRET` | ja | versleutelt opgeslagen geheimen in de database (o.a. kanaalsleutels); nooit wijzigen na de eerste start |
| app | `HW_SIGNAL_SALT` | ja | zout voor misbruiksignalen (telefoon, IP, kaartvingerafdruk); zonder dit weigert gratis tegoed en affiliate-beloning |
| app | `SESSION_COOKIE_TRUSTED_URL` | ja | exacte HTTPS-origin(s), kommagescheiden, bv. `https://ai.hisarweb.com`; hoort bij `SESSION_COOKIE_SECURE=true` |
| app | `TZ` | nee (Europe/Istanbul) | tijdzone in logs en mails |
| app | `DEFAULT_LANGUAGE` | nee (tr) | taal van logregels en van berichten als de lezer geen taal opgeeft |
| app | `NODE_NAME` | nee | naam van dit knooppunt in het auditlog |
| database | `SQL_DSN` | ja (uit de vier hieronder opgebouwd) | `postgresql://<user>:<wachtwoord>@postgres:5432/<db>?sslmode=disable`; compose bouwt dit zelf uit de volgende vier |
| database | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | ja | inloggegevens van de eigen PostgreSQL-container; de poort staat niet naar buiten open |
| betalen | `REVOLUT_SECRET_KEY`, `REVOLUT_WEBHOOK_SECRET` | nee | Revolut Merchant; leeg = de betaalroute start geen betaling |
| betalen | `REVOLUT_API_BASE`, `REVOLUT_API_VERSION` | nee | leeg = productie-URL en standaardversie uit de code |
| betalen | `HW_STRIPE_SECRET_KEY`, `HW_STRIPE_WEBHOOK_SECRET` | nee | Stripe Checkout in TRY; als beide gevuld zijn gaat Stripe voor Revolut; webhook `/api/hw/stripe/webhook` |
| reserve | `HW_BUREAU_USAGE_URL`, `HW_BUREAU_USAGE_TOKEN`, `HW_WINDOW_CAPACITY_USD`, `HW_RESERVE_MODE` | nee | poort op het bureaugebruik; leeg betekent: klantverkeer dicht in plaats van gokken |
| kwaliteit | `HW_QUALITY_BASE_URL`, `HW_QUALITY_API_KEY`, `HW_QUALITY_JUDGE_MODEL`, `HW_QUALITY_OUT_DIR` | nee | meting van de kwaliteitsmeter (`POST /api/hw/quality/run`, beheerder). De basis-URL is de eigen klantroute (`https://api.hisarweb.be`), de sleutel een gewone klantsleutel, de keurder een verkocht model en de uitmap een pad op het datavolume (`/data/kwaliteit`). Ontbreekt één van de vier, dan weigert de meting te starten en blijven er geen halve scores staan |

Alles hierboven komt uit de omgeving van Coolify. In dit bestand staan alleen namen, nooit waarden.

### Geheimen die deze code niet uit de omgeving leest

new-api bewaart deze in de database (sleutels versleuteld met `CRYPTO_SECRET`) en zet ze via het
beheerpaneel, niet via een omgevingsvariabele. Ze staan daarom bewust niet in de compose: een
variabele die niets leest, suggereert ten onrechte dat hij werkt.

- Turnstile: site-sleutel en geheime sleutel (Beheer > Instellingen).
- Telegram-login: bot-token (Beheer > Instellingen).
- SMTP: server, account en wachtwoord voor mails (Beheer > Instellingen).
- Kanaalsleutels, waaronder de Lumia-klantsleutel en de OpenRouter-noodsleutel (Beheer > Kanalen).

Gevolg voor de uitrol: na de eerste start moeten deze eenmalig in het beheerpaneel worden gezet.
Wil Altuner ze toch uitsluitend uit de omgeving, dan is dat een codewijziging (opstarten van de
opties uit omgevingsvariabelen); dat valt buiten H2 en is een open punt in het verslag.

## Poort en gezondheid

- Poort: container `3000`, op de host alleen `127.0.0.1:${APP_HTTP_PORT:-3000}`. De poort staat
  dus niet op de publieke interface van de VPS: de proxy van het platform (Traefik) bereikt de
  container via het compose-netwerk, niet via de hostpoort.
- Healthcheck (in het image en in de compose): `GET http://127.0.0.1:3000/api/status` moet met
  HTTP 200 antwoorden en `"success": true` bevatten. Coolify toont de container dan als `healthy`.
- Geheugen en CPU: app 512 MB en 1 CPU, PostgreSQL 512 MB. De databank heeft geen gepubliceerde
  poort; alleen de app in dit netwerk kan erbij.
- Uitrolvenster (gemeten 30 okt 2026, uitrol van PR 199): een Docker-Compose-app wordt door Coolify
  nooit rollend vervangen. Coolify haalt eerst de oude app en de oude PostgreSQL weg en voert dan
  `docker compose up -d` uit. De proxy stuurt geen verkeer naar een container die nog niet `healthy`
  is, dus bezoekers krijgen "no available server" van het weghalen van de oude app tot de nieuwe app
  gezond is: PostgreSQL gezond binnen 1 s, de app antwoordt 3,9 s na zijn start (3,4 s daarvan is de
  databasemigratie). Beide healthchecks hebben `start_interval: 250ms`; zonder die regel loopt Docker
  de eerste probes tijdens `start_period` pas elke 5 s. Een venster van nul seconden kan alleen met
  een los databasevolume en de app als Dockerfile-applicatie met rollende uitrol in Coolify.

## Zo leest Coolify het

1. Nieuwe resource in Coolify: **Docker Compose** (leeg of vanuit de repo `hisarweb-be/hisarweb-ai`).
2. **Base Directory**: `/` (repositorywortel). **Docker Compose Location**:
   `/deploy/docker-compose.yml`. De compose bouwt met context `..`, dus de bouwcontext is de
   repositorywortel en `deploy/Dockerfile` vindt `web/`, `go.mod`, `relaykit/` en `tokenkit/`.
3. Zet de variabelen uit de tabel op de pagina **Environment Variables** van de app. Verplichte
   variabelen zonder waarde laten de compose bewust falen (`:?`-controle), dus een vergeten sleutel
   stopt de uitrol in plaats van stil te starten.
4. **Domains**: het publieke adres met poort `3000` (de containerpoort). Coolify zet daar zijn proxy voor.
5. Auto Deploy blijft uit (bureau-regel sinds 1 okt 2026, `kennis/infra/coolify-uitrol.md`). Uitrollen
   gaat via de CTO-route met een goedkeuringskaart; nooit via een push naar main.

## Geüpgradede database waarin de beheerder nog 123456 heeft

De productiepoort weigert dat paar voortaan, ook wanneer het als e-mailadres van de beheerder wordt
ingevoerd. Kleinste bestaande route om het eenmalig te herstellen (geen nieuwe code, geen ingreep in
de gebruikersrij):

1. Zorg dat de root-rij een bereikbaar en uniek adres heeft:
   `SELECT id, username, email FROM users WHERE role = 100;` en zo nodig
   `UPDATE users SET email = '<adres>' WHERE id = <id>;`.
2. Vraag een herstelcode aan: `GET /api/reset_password?email=<adres>`. Dat werkt alleen als SMTP in
   het beheerpaneel is ingesteld; die instelling gebruikt elke mail van de dienst.
3. Wissel de code in: `POST /api/user/reset` met `{"email":"<adres>","token":"<code>"}`. Het antwoord
   bevat eenmalig een nieuw wachtwoord; daarmee meld je aan en wijzig je het in het beheerpaneel. Alle
   bestaande sessies van de beheerder worden hierbij ingetrokken.

Zonder SMTP is er na de upgrade geen inlogroute voor de beheerder: stel SMTP dan eerst in (via het
beheerpaneel van de vorige versie of de opties-tabel) vóór je uitrolt.

## Terugrolpunten en gegevens

- `app_data` (named volume op `/data`): SQLite-bestand, uploads en logs.
- `pg_data` (named volume op `/var/lib/postgresql/data`): de klantdatabase. Back-up blijft de
  bestaande VPS-postgresroute; verwijder dit volume nooit zonder nagemeten terugvalkopie.
- Terugrollen: Coolify zet de vorige commit terug en bouwt opnieuw (image `hisarweb-ai:prod`).
  De volumes blijven staan, dus gegevens overleven een terugrol.

## Lokaal controleren zonder zware bouw

```bash
# in de WSL-distro paperclip, vanuit de repositorywortel
cd deploy
POSTGRES_USER=x POSTGRES_PASSWORD=<verzonnen> POSTGRES_DB=newapi \
SESSION_SECRET=<verzonnen> CRYPTO_SECRET=<verzonnen> HW_SIGNAL_SALT=<verzonnen> \
SESSION_COOKIE_TRUSTED_URL=https://example.invalid \
docker compose config
```

Dat controleert interpolatie, limieten, volumes en healthchecks zonder iets te bouwen of te starten.
Het image komt in Coolify altijd van `ghcr.io/hisarweb-be/hisarweb-ai` of uit de eigen build van
`deploy/Dockerfile`, nooit van `ghcr.io/quantumnous/new-api` of `calciumion/new-api`: dat image
overschrijft de fork met de kale upstream.
Het image zelf wordt alleen in GitHub Actions gebouwd en gemeten: de job `Production image build` in
`.github/workflows/security.yml` bouwt `deploy/Dockerfile` op elke pull request en op elke push naar
main, zonder te publiceren. Op de laptop bouwen we het niet.
