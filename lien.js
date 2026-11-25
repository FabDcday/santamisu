(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.SantaLien = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const LONGUEUR = 12;
  const encodeur = new TextEncoder();

  function genererJeton() {
    let s = '';
    while (s.length < LONGUEUR) {
      for (const o of crypto.getRandomValues(new Uint8Array(LONGUEUR * 2))) {
        if (o < 248 && s.length < LONGUEUR) s += ALPHABET[o % 62];
      }
    }
    return s;
  }

  function versBase64url(octets) {
    let s = '';
    for (const b of octets) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function depuisBase64url(texte) {
    const s = texte.replace(/-/g, '+').replace(/_/g, '/');
    const complement = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    return Uint8Array.from(atob(s + complement), c => c.charCodeAt(0));
  }

  async function empreinte(texte) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', encodeur.encode(texte)));
  }

  async function identifiant(jeton) {
    const h = await empreinte('santamisu:id:' + jeton);
    return Array.from(h.slice(0, 4), b => b.toString(16).padStart(2, '0')).join('');
  }

  // Prénom comparable : sans accents, sans casse, lettres a-z seulement
  function normaliserPrenom(texte) {
    return String(texte == null ? '' : texte).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  }

  // Prénom attendu d'un libellé : son premier mot, normalisé
  function prenomAttendu(libelle) {
    return normaliserPrenom(String(libelle || '').trim().split(/\s+/)[0]);
  }

  // La clé dépend du jeton ET du prénom : sans le bon prénom, impossible de déchiffrer
  async function cle(jeton, prenom) {
    return crypto.subtle.importKey('raw', await empreinte('santamisu:cle:v2:' + jeton + ':' + prenom), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  async function chiffrerMission(jeton, { d, r }) {
    const prenom = prenomAttendu(d);
    if (!prenom) throw new Error('Le prénom de ' + d + ' ne contient aucune lettre');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const obj = { v: 2, d, r, p: '' };
    const longueur = encodeur.encode(JSON.stringify(obj)).length;
    const cible = Math.max(128, Math.ceil(longueur / 128) * 128);
    obj.p = ' '.repeat(cible - longueur);
    const clair = encodeur.encode(JSON.stringify(obj));
    const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cle(jeton, prenom), clair));
    return { id: await identifiant(jeton), boite: versBase64url(iv) + '.' + versBase64url(chiffre) };
  }

  function extraireJeton(fragment) {
    let brut;
    try {
      brut = decodeURIComponent(String(fragment || ''));
    } catch (e) {
      return null;
    }
    const m = brut.match(/(?:^|[^A-Za-z0-9])([A-Za-z0-9]{12})(?![A-Za-z0-9])/);
    return m ? m[1] : null;
  }

  // Reconnaît le lien sans prénom et sans déchiffrer : abime, inconnu ou pret
  async function verifierLien(fragment, config) {
    const jeton = extraireJeton(fragment);
    if (!jeton) return { etat: 'abime' };
    const missions = (config && config.missions) || {};
    const id = await identifiant(jeton);
    if (!Object.prototype.hasOwnProperty.call(missions, id)) return { etat: 'inconnu' };
    return { etat: 'pret' };
  }

  async function essayer(jeton, boite, prenom) {
    try {
      const [iv, chiffre] = String(boite).split('.');
      const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisBase64url(iv) }, await cle(jeton, prenom), depuisBase64url(chiffre));
      const data = JSON.parse(new TextDecoder().decode(clair));
      if (data.v !== 2 || typeof data.d !== 'string' || typeof data.r !== 'string' || !data.r) return null;
      return { d: data.d, r: data.r };
    } catch (e) {
      return null;
    }
  }

  // Au plus deux candidats : la saisie entière, puis son premier mot.
  // Boîte altérée et mauvais prénom sont indiscernables : les deux donnent « prenom ».
  async function ouvrirMission(fragment, config, prenom) {
    const lien = await verifierLien(fragment, config);
    if (lien.etat !== 'pret') return lien;
    const jeton = extraireJeton(fragment);
    const boite = config.missions[await identifiant(jeton)];
    const saisie = String(prenom == null ? '' : prenom);
    const candidats = [];
    for (const c of [normaliserPrenom(saisie), normaliserPrenom(saisie.trim().split(/\s+/)[0])]) {
      if (c && !candidats.includes(c)) candidats.push(c);
    }
    for (const c of candidats) {
      const data = await essayer(jeton, boite, c);
      if (data) return { etat: 'ok', data };
    }
    return { etat: 'prenom' };
  }

  return { genererJeton, identifiant, normaliserPrenom, chiffrerMission, extraireJeton, verifierLien, ouvrirMission };
});
