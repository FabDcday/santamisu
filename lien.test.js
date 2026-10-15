const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./lien.js');

async function configAvec(jeton, mission) {
  const { id, boite } = await L.chiffrerMission(jeton, mission);
  return { missions: { [id]: boite } };
}

test('jeton : 12 caractères alphanumériques, uniques', () => {
  const jetons = Array.from({ length: 2000 }, () => L.genererJeton());
  for (const j of jetons) assert.match(j, /^[A-Za-z0-9]{12}$/);
  assert.equal(new Set(jetons).size, 2000);
});

test('aller-retour chiffrement / ouverture', async () => {
  const j = L.genererJeton();
  const res = await L.ouvrirMission('#' + j, await configAvec(j, { d: 'Marie', r: 'Paul' }));
  assert.deepEqual(res, { etat: 'ok', data: { d: 'Marie', r: 'Paul' } });
});

test('accents, apostrophes et emoji', async () => {
  const j = L.genererJeton();
  const res = await L.ouvrirMission('#' + j, await configAvec(j, { d: "Hélène D'Arc", r: 'Zoë 🎄' }));
  assert.deepEqual(res.data, { d: "Hélène D'Arc", r: 'Zoë 🎄' });
});

test('la longueur de la boîte ne dépend pas de la longueur des noms', async () => {
  const j1 = L.genererJeton();
  const j2 = L.genererJeton();
  const court = await L.chiffrerMission(j1, { d: 'Al', r: 'Bo' });
  const long = await L.chiffrerMission(j2, { d: "Hélène D'Arc", r: 'Zoë 🎄' });
  assert.equal(court.boite.length, long.boite.length);
  assert.deepEqual((await L.ouvrirMission('#' + j1, { missions: { [court.id]: court.boite } })).data, { d: 'Al', r: 'Bo' });
  assert.deepEqual((await L.ouvrirMission('#' + j2, { missions: { [long.id]: long.boite } })).data, { d: "Hélène D'Arc", r: 'Zoë 🎄' });
});

test('rien de lisible dans config.js', async () => {
  const j = L.genererJeton();
  const { id, boite } = await L.chiffrerMission(j, { d: 'Marie', r: 'Paul' });
  assert.match(id, /^[0-9a-f]{8}$/);
  assert.ok(!boite.includes('Marie') && !boite.includes('Paul') && !boite.includes(j) && !id.includes(j));
  assert.match(boite, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const autre = await L.chiffrerMission(j, { d: 'Marie', r: 'Paul' });
  assert.equal(autre.id, id);
  assert.notEqual(autre.boite, boite);
});

test('ponctuation et encodage ajoutés par les messageries', async () => {
  const j = L.genererJeton();
  const cfg = await configAvec(j, { d: 'Marie', r: 'Paul' });
  for (const v of ['#' + j + '.', '#' + j + ')', '#' + j + '%20', ' #' + j + ' ', '#' + encodeURIComponent(j)]) {
    assert.equal((await L.ouvrirMission(v, cfg)).etat, 'ok', v);
  }
});

test('fragments vides ou absurdes : lien abîmé', async () => {
  const j = L.genererJeton();
  const cfg = await configAvec(j, { d: 'Marie', r: 'Paul' });
  for (const v of ['', '#', '#abc', '#%E0%A4%A', null, undefined, '#' + j + 'X', '#' + j.slice(1)]) {
    assert.equal((await L.ouvrirMission(v, cfg)).etat, 'abime', String(v));
  }
});

test('jeton bien formé mais absent de config.js : inconnu', async () => {
  const j = L.genererJeton();
  const cfg = await configAvec(j, { d: 'Marie', r: 'Paul' });
  assert.equal((await L.ouvrirMission('#' + L.genererJeton(), cfg)).etat, 'inconnu');
  assert.equal((await L.ouvrirMission('#' + j, {})).etat, 'inconnu');
  assert.equal((await L.ouvrirMission('#' + j, { missions: {} })).etat, 'inconnu');
});

test('boîte altérée ou déchiffrée avec un autre jeton : lien abîmé', async () => {
  const a = L.genererJeton();
  const b = L.genererJeton();
  const boiteA = (await L.chiffrerMission(a, { d: 'Marie', r: 'Paul' })).boite;
  const idB = await L.identifiant(b);
  assert.equal((await L.ouvrirMission('#' + b, { missions: { [idB]: boiteA } })).etat, 'abime');
  const idA = await L.identifiant(a);
  const alteree = boiteA.slice(0, -2) + (boiteA.slice(-2) === 'AA' ? 'BB' : 'AA');
  assert.equal((await L.ouvrirMission('#' + a, { missions: { [idA]: alteree } })).etat, 'abime');
});

test('extraireJeton', () => {
  assert.equal(L.extraireJeton('#AbCdEf123456'), 'AbCdEf123456');
  assert.equal(L.extraireJeton('#AbCdEf123456.'), 'AbCdEf123456');
  assert.equal(L.extraireJeton('#AbCdEf1234567'), null);
  assert.equal(L.extraireJeton('#AbC'), null);
  assert.equal(L.extraireJeton(null), null);
});
