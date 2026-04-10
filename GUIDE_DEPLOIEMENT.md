# 🚀 Tracker Pro PWA — Guide de déploiement

## Vue d'ensemble

Tracker Pro est une PWA (Progressive Web App) qui fonctionne comme une app native
sur iPhone, Android et PC. Les données sont synchronisées en temps réel entre tous
tes appareils via Firebase (gratuit).

---

## Étape 1 — Prérequis (5 min)

Tu as besoin de :
- **Node.js** (v18+) → https://nodejs.org
- **Un compte Google** (pour Firebase, gratuit)
- **Un compte Vercel ou Netlify** (pour l'hébergement, gratuit)

Vérifie Node :
```bash
node --version   # doit afficher v18+ ou v20+
npm --version
```

---

## Étape 2 — Configurer Firebase (10 min)

### 2.1 Créer le projet Firebase

1. Va sur https://console.firebase.google.com
2. Clique **"Ajouter un projet"**
3. Nomme-le `tracker-pro` (ou ce que tu veux)
4. Décoche Google Analytics (pas besoin)
5. Clique **Créer**

### 2.2 Ajouter une Web App

1. Dans ton projet → icône **</>** (Web)
2. Nomme l'app `tracker-pro-web`
3. **NE COCHE PAS** "Firebase Hosting" (on utilise Vercel)
4. Clique **Enregistrer l'application**
5. **COPIE** la config affichée — tu en auras besoin :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tracker-pro-xxxxx.firebaseapp.com",
  projectId: "tracker-pro-xxxxx",
  storageBucket: "tracker-pro-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 2.3 Activer Firestore

1. Menu gauche → **Firestore Database**
2. Clique **"Créer une base de données"**
3. Choisis **"Commencer en mode test"** (on sécurisera après)
4. Choisis la région `europe-west1` (la plus proche de Toulouse)
5. Clique **Activer**

### 2.4 Activer l'authentification anonyme

1. Menu gauche → **Authentication**
2. Onglet **"Sign-in method"**
3. Clique **"Anonyme"** → **Activer** → **Enregistrer**

### 2.5 Coller ta config dans le code

Ouvre `src/firebase.js` et remplace le bloc `firebaseConfig` par celui copié à l'étape 2.2.

---

## Étape 3 — Installer et lancer en local (5 min)

```bash
# Dans le dossier du projet
cd tracker-pwa

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

Ouvre http://localhost:5173 — l'app fonctionne !

---

## Étape 4 — Déployer sur Vercel (5 min, GRATUIT)

### Option A : Via l'interface Vercel (le plus simple)

1. Pousse le projet sur GitHub :
```bash
git init
git add .
git commit -m "Tracker Pro PWA v1"
# Crée un repo sur github.com, puis :
git remote add origin https://github.com/TON_USER/tracker-pro.git
git push -u origin main
```

2. Va sur https://vercel.com → Sign up avec GitHub
3. Clique **"New Project"** → Importe ton repo `tracker-pro`
4. Framework : **Vite** (auto-détecté)
5. Clique **Deploy**
6. En 30 secondes, tu as une URL : `https://tracker-pro-xxx.vercel.app`

### Option B : Via la CLI Vercel

```bash
npm install -g vercel
vercel login
npm run build
vercel --prod
```

### Alternative : Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

---

## Étape 5 — Installer sur iPhone (2 min)

1. Ouvre **Safari** sur ton iPhone
2. Va sur ton URL Vercel (ex: `https://tracker-pro-xxx.vercel.app`)
3. Appuie sur le bouton **Partager** (⬆️)
4. Choisis **"Sur l'écran d'accueil"**
5. Nomme l'app **"Tracker Pro"**
6. L'icône ⚡ apparaît sur ton écran d'accueil !

L'app s'ouvre en plein écran, sans barre Safari. C'est une vraie app.

---

## Étape 6 — Synchroniser entre appareils (1 min)

1. Sur ton **premier appareil** (PC par exemple) :
   - Ouvre l'app → onglet **⚙️ Sync**
   - Copie ton **identifiant de sync**

2. Sur ton **deuxième appareil** (iPhone) :
   - Ouvre l'app → onglet **⚙️ Sync**
   - Colle le code dans **"Lier un autre appareil"**
   - L'app recharge et récupère toutes tes données

3. Maintenant, toute modification sur un appareil apparaît
   **instantanément** sur l'autre (grâce à Firebase Realtime).

---

## Sécuriser Firebase (optionnel mais recommandé)

Après 30 jours, le "mode test" Firestore expire. Remplace les règles par :

Dans Firebase Console → Firestore → Onglet **Règles** :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chaque utilisateur ne peut lire/écrire que ses propres données
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Clique **Publier**.

---

## Structure du projet

```
tracker-pwa/
├── index.html              # Point d'entrée HTML
├── package.json            # Dépendances
├── vite.config.js          # Config Vite + PWA
├── public/
│   ├── favicon.svg         # Icône navigateur
│   ├── icon-192.png        # Icône PWA 192px
│   ├── icon-512.png        # Icône PWA 512px
│   └── apple-touch-icon.png # Icône iPhone
└── src/
    ├── main.jsx            # Point d'entrée React
    ├── firebase.js         # Config Firebase + sync
    └── App.jsx             # L'application complète
```

---

## Coûts

**Tout est gratuit** pour un usage personnel :

| Service | Plan gratuit |
|---------|-------------|
| Firebase Firestore | 1 Go stockage + 50k lectures/jour |
| Firebase Auth | Illimité (anonyme) |
| Vercel | 100 Go bande passante/mois |
| Netlify (alternative) | 100 Go bande passante/mois |

Tu ne dépasseras jamais ces limites avec un usage personnel.

---

## FAQ

**Q: Les données sont-elles privées ?**
Oui. Chaque utilisateur a son propre espace dans Firestore, protégé par
les règles de sécurité. Personne d'autre ne peut voir tes données.

**Q: Ça marche hors ligne ?**
Oui ! La PWA met en cache l'app via le Service Worker. Tu peux consulter
tes données hors ligne. Les modifications se synchronisent au retour du réseau.

**Q: Je peux utiliser un domaine personnalisé ?**
Oui, Vercel et Netlify permettent d'ajouter un domaine custom gratuitement.

**Q: Comment mettre à jour l'app ?**
Modifie le code → `git push` → Vercel redéploie automatiquement.
L'app se met à jour toute seule sur tes appareils.
