const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./textes.js');

test('jours restants', () => {
  const maintenant = new Date(2026, 11, 1, 15, 30);
  assert.equal(T.joursRestants('2026-12-17', maintenant), 16);
  assert.equal(T.joursRestants('2026-12-01', maintenant), 0);
  assert.equal(T.joursRestants('2026-11-30', maintenant), -1);
});

test("jours restants à travers le passage à l'heure d'hiver", () => {
  assert.equal(T.joursRestants('2026-11-01', new Date(2026, 9, 20, 23, 59)), 12);
});

test('date absente ou invalide', () => {
  assert.ok(Number.isNaN(T.joursRestants('', new Date())));
  assert.ok(Number.isNaN(T.joursRestants('pas-une-date', new Date())));
  assert.equal(T.formaterDate(''), '');
});

test('format de date', () => {
  assert.equal(T.formaterDate('2026-12-17'), '17/12');
});

test('variante stable, dans les bornes, et toutes atteintes', () => {
  assert.equal(T.choisirVariante('l9x3'), T.choisirVariante('l9x3'));
  const vues = new Set();
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (const a of alphabet) for (const b of alphabet) {
    const v = T.choisirVariante('l' + a + b + '3');
    assert.ok(v >= 0 && v < T.NB_VARIANTES);
    vues.add(v);
  }
  assert.equal(vues.size, T.NB_VARIANTES);
});

test('chaque mission cite le destinataire, aucun tiret cadratin', () => {
  for (let i = 0; i < T.NB_VARIANTES; i++) {
    const m = T.modeleMission(i);
    assert.ok(m.includes('{r}'), 'variante ' + i);
    assert.ok(!m.includes('—'), 'variante ' + i);
  }
  assert.ok(!T.texteAccueil('Marie').includes('—'));
  assert.ok(T.texteAccueil('Marie').includes('Marie'));
  assert.ok(T.textePasMoi('Marie').includes('Marie'));
});

test('phrases de délai', () => {
  const base = { dateTexte: '17/12', budget: '15 €', destinataire: 'Paul' };
  assert.match(T.texteDelai({ ...base, jours: 16 }), /16 jours avant le 17\/12.*15 €/);
  assert.match(T.texteDelai({ ...base, jours: 1 }), /Plus qu'un jour/);
  assert.match(T.texteDelai({ ...base, jours: 0 }), /aujourd'hui/);
  assert.match(T.texteDelai({ ...base, jours: -2 }), /Paul/);
  assert.match(T.texteDelai({ ...base, jours: NaN }), /annoncée bientôt/);
  assert.ok(!T.texteDelai({ ...base, budget: '', jours: 5 }).includes('budget'));
});
