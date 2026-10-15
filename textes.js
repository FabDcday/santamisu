(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.SantaTextes = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  const MISSIONS = [
    'Cette année, ta mission est de faire briller les yeux de {r} en lui offrant son cadeau du Secret Santa.',
    "Les lutins ont tranché : c'est toi qui gâtes {r} cette année. Pas de pression… enfin, un peu quand même.",
    'Le Père Noël te confie un dossier classé ultra confidentiel : le cadeau de {r}.',
    "Ta cible, si tu l'acceptes : {r}. Ce message ne s'autodétruira pas, mais garde le secret quand même.",
    "Rodolphe a fait le tour du bureau et son nez rouge s'est arrêté sur {r}. À toi de jouer !",
    "Mission du jour : transformer {r} en personne la plus heureuse de l'open space.",
    'Le grand livre des lutins est formel : tu es le Père Noël secret de {r}.',
    'Sors ta hotte : {r} compte sur toi pour un petit miracle de Noël.',
    "Les rennes ont voté à l'unanimité (moins une abstention) : tu offres un cadeau à {r}.",
    "Chut… Tu es désormais l'ange gardien cadeau de {r}. Personne ne doit le savoir."
  ];

  function choisirVariante(idLien) {
    let h = 0;
    for (const c of String(idLien)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % MISSIONS.length;
  }

  function modeleMission(variante) {
    return MISSIONS[variante % MISSIONS.length];
  }

  function texteAccueil(donneur) {
    return `Ho ho ho, bonjour à toi ${donneur} !`;
  }

  function textePasMoi(donneur) {
    return `Tu n'es pas ${donneur} ? Ferme vite cette page, les lutins surveillent. 👀`;
  }

  function lireDate(dateISO) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function joursRestants(dateISO, maintenant) {
    const cible = lireDate(dateISO);
    if (!cible) return NaN;
    const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    return Math.round((cible - aujourdhui) / 86400000);
  }

  function formaterDate(dateISO) {
    const d = lireDate(dateISO);
    if (!d) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function texteDelai({ jours, dateTexte, budget, destinataire }) {
    const b = budget ? ` (budget : ${budget})` : '';
    if (Number.isNaN(jours)) return `La date de l'échange sera annoncée bientôt. Les lutins comptent sur toi${b} !`;
    if (jours > 1) return `Tu as ${jours} jours avant le ${dateTexte} pour dénicher un petit quelque chose${b}. Les lutins comptent sur toi !`;
    if (jours === 1) return `Plus qu'un jour avant le ${dateTexte} : c'est le moment de foncer${b} !`;
    if (jours === 0) return `C'est aujourd'hui, le ${dateTexte} ! Si le cadeau n'est pas prêt, les lutins ne diront rien… promis.`;
    return `L'échange a eu lieu le ${dateTexte}. On espère que ${destinataire} a été gâté·e !`;
  }

  return {
    NB_VARIANTES: MISSIONS.length,
    choisirVariante, modeleMission, texteAccueil, textePasMoi,
    joursRestants, formaterDate, texteDelai
  };
});
