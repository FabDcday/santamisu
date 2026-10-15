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

  async function cle(jeton) {
    return crypto.subtle.importKey('raw', await empreinte('santamisu:cle:' + jeton), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  async function chiffrerMission(jeton, { d, r }) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const obj = { v: 1, d, r, p: '' };
    const longueur = encodeur.encode(JSON.stringify(obj)).length;
    const cible = Math.max(128, Math.ceil(longueur / 128) * 128);
    obj.p = ' '.repeat(cible - longueur);
    const clair = encodeur.encode(JSON.stringify(obj));
    const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cle(jeton), clair));
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

  async function ouvrirMission(fragment, config) {
    const jeton = extraireJeton(fragment);
    if (!jeton) return { etat: 'abime' };
    const missions = (config && config.missions) || {};
    const id = await identifiant(jeton);
    if (!Object.prototype.hasOwnProperty.call(missions, id)) return { etat: 'inconnu' };
    try {
      const [iv, chiffre] = String(missions[id]).split('.');
      const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisBase64url(iv) }, await cle(jeton), depuisBase64url(chiffre));
      const data = JSON.parse(new TextDecoder().decode(clair));
      if (data.v !== 1 || typeof data.d !== 'string' || typeof data.r !== 'string' || !data.r) return { etat: 'abime' };
      return { etat: 'ok', data: { d: data.d, r: data.r } };
    } catch (e) {
      return { etat: 'abime' };
    }
  }

  return { genererJeton, identifiant, chiffrerMission, extraireJeton, ouvrirMission };
});
