# Dev setup BullionDesk

## Ownership
- GitHub repo: ndournezar-oss (admin: Nezar)
- Supabase: ndournezar-oss org (admin: Nezar)
- Vercel: mechaiaIsmail58-sketch (admin: Ismail) — source de verite env vars
- Stripe: gere par Nezar (ne pas toucher)

## Prerequis
- nvm + Node (version dans .nvmrc)
- npm, Git, VS Code
- Acces accepte: GitHub repo + Supabase project
- Fichier .env.local recu via lien one-time-secret (jamais en clair sur chat)

## Premier setup
1. git clone git@github.com:ndournezar-oss/gold-ia-site.git
2. cd gold-ia-site
3. nvm use   (si version pas installee: nvm install)
4. npm install
5. Placer .env.local recu d'Ismail a la racine
6. npm run dev → http://localhost:3000

## Workflow quotidien
1. git checkout main && git pull origin main
2. git checkout -b feat/ta-feature-prenom
3. Code, test en local
4. git add . && git commit -m "feat: description claire"
5. git push -u origin feat/ta-feature-prenom
6. Ouvrir une PR sur GitHub
7. L'autre review + merge → Vercel auto-deploie main

## Regles
- JAMAIS push direct sur main
- TOUJOURS pull main avant de creer une nouvelle branche
- Si conflit au merge: prevenir l'autre avant de resoudre
- 1 PR = 1 sujet (pas de melange features + fixes)

## Pair coding live
VS Code extension "Live Share" (Microsoft). L'un lance, partage le lien.
