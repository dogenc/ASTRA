// ASTRA · Astronomische Berechnungen und Lerninhalte.
// Planetenbahnen: JPL „Approximate Positions of the Planets“, Tabelle 1 (E. M. Standish), gültig 1800–2050.
// Mond: verkürzte Störungsreihe nach P. Schlyter („How to compute planetary positions“).
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const AU_KM = 149597870.7;
const norm360 = x => ((x % 360) + 360) % 360;

// a [AU], e, I [°], L [°], ϖ [°], Ω [°] – jeweils Wert zu J2000 und Änderung pro Jahrhundert.
export const ELEMENTS = {
  mercury: [[0.38709927, 0.00000037], [0.20563593, 0.00001906], [7.00497902, -0.00594749], [252.25032350, 149472.67411175], [77.45779628, 0.16047689], [48.33076593, -0.12534081]],
  venus: [[0.72333566, 0.00000390], [0.00677672, -0.00004107], [3.39467605, -0.00078890], [181.97909950, 58517.81538729], [131.60246718, 0.00268329], [76.67984255, -0.27769418]],
  earth: [[1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668], [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0]],
  mars: [[1.52371034, 0.00001847], [0.09339410, 0.00007882], [1.84969142, -0.00813131], [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343]],
  jupiter: [[5.20288700, -0.00011607], [0.04838624, -0.00013253], [1.30439695, -0.00183714], [34.39644051, 3034.74612775], [14.72847983, 0.21252668], [100.47390909, 0.20469106]],
  saturn: [[9.53667594, -0.00125060], [0.05386179, -0.00050991], [2.48599187, 0.00193609], [49.95424423, 1222.49362201], [92.59887831, -0.41897216], [113.66242448, -0.28867794]],
  uranus: [[19.18916464, -0.00196176], [0.04725744, -0.00004397], [0.77263783, -0.00242939], [313.23810451, 428.48202785], [170.95427630, 0.40805281], [74.01692503, 0.04240589]],
  neptune: [[30.06992276, 0.00026291], [0.00859048, 0.00005105], [1.77004347, 0.00035372], [-55.12002969, 218.45945325], [44.96476227, -0.32241464], [131.78422574, -0.00508664]],
};
// Pluto: mittlere Elemente (JPL Small-Body Database, Epoche J2000), ohne Störungen – nur zur Veranschaulichung.
ELEMENTS.pluto = [[39.48211675, -0.00031596], [0.24882730, 0.00005170], [17.14001206, 0.00004818], [238.92903833, 145.20780515], [224.06891629, -0.04062942], [110.30393684, -0.01183482]];

export const julian = date => date.getTime() / 86400000 + 2440587.5;
const centuries = jd => (jd + 69.2 / 86400 - 2451545) / 36525; // TT ≈ UTC + 69 s

function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
  return E;
}

/** Heliozentrische Position (ekliptikal, J2000) in AU. */
export function helio(id, jd) {
  const T = centuries(jd), el = ELEMENTS[id].map(([v, r]) => v + r * T);
  const [a, e, I, L, peri, node] = el, w = (peri - node) * D2R, O = node * D2R, i = I * D2R;
  let M = norm360(L - peri); if (M > 180) M -= 360;
  const E = solveKepler(M * D2R, e), x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  return [(cw * cO - sw * sO * ci) * x + (-sw * cO - cw * sO * ci) * y, (cw * sO + sw * cO * ci) * x + (-sw * sO + cw * cO * ci) * y, sw * si * x + cw * si * y];
}

/** Bahnpunkte für die Darstellung (eine volle Umlaufbahn zum gegebenen Zeitpunkt). */
export function orbitPoints(id, jd, n = 256) {
  const T = centuries(jd), [a, e, I, , peri, node] = ELEMENTS[id].map(([v, r]) => v + r * T);
  const w = (peri - node) * D2R, O = node * D2R, i = I * D2R, pts = [];
  for (let k = 0; k <= n; k++) {
    const E = k / n * 2 * Math.PI, x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
    pts.push([(cw * cO - sw * sO * ci) * x + (-sw * cO - cw * sO * ci) * y, (cw * sO + sw * cO * ci) * x + (-sw * sO + cw * cO * ci) * y, sw * si * x + cw * si * y]);
  }
  return pts;
}

const OBLIQUITY = 23.43928 * D2R;
export function eclToEq([x, y, z]) { return [x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)]; }
export function toRaDec([x, y, z]) { return [norm360(Math.atan2(y, x) * R2D), Math.atan2(z, Math.hypot(x, y)) * R2D, Math.hypot(x, y, z)]; }

/** Mond, geozentrisch: ekliptikale Länge/Breite (J2000) in Grad, Entfernung in km. */
export function moonEcliptic(jd) {
  const d = jd + 69.2 / 86400 - 2451543.5;
  const N = norm360(125.1228 - 0.0529538083 * d) * D2R, i = 5.1454 * D2R, w = norm360(318.0634 + 0.1643573223 * d) * D2R;
  const a = 60.2666, e = 0.0549, M = norm360(115.3654 + 13.0649929509 * d) * D2R;
  const E = solveKepler(M, e), xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv); let r = Math.hypot(xv, yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const zh = r * Math.sin(v + w) * Math.sin(i);
  let lon = Math.atan2(yh, xh) * R2D, lat = Math.atan2(zh, Math.hypot(xh, yh)) * R2D;
  const Ms = norm360(356.0470 + 0.9856002585 * d) * D2R, Ls = Ms + norm360(282.9404 + 4.70935e-5 * d) * D2R;
  const Lm = N + w + M, Dm = Lm - Ls, F = Lm - N, Mm = M, s = Math.sin, c = Math.cos;
  lon += -1.274 * s(Mm - 2 * Dm) + 0.658 * s(2 * Dm) - 0.186 * s(Ms) - 0.059 * s(2 * Mm - 2 * Dm) - 0.057 * s(Mm - 2 * Dm + Ms)
    + 0.053 * s(Mm + 2 * Dm) + 0.046 * s(2 * Dm - Ms) + 0.041 * s(Mm - Ms) - 0.035 * s(Dm) - 0.031 * s(Mm + Ms) - 0.015 * s(2 * F - 2 * Dm) + 0.011 * s(Mm - 4 * Dm);
  lat += -0.173 * s(F - 2 * Dm) - 0.055 * s(Mm - F - 2 * Dm) - 0.046 * s(Mm + F - 2 * Dm) + 0.033 * s(F + 2 * Dm) + 0.017 * s(2 * Mm + F);
  r += -0.58 * c(Mm - 2 * Dm) - 0.46 * c(2 * Dm);
  lon -= 1.396971 * d / 36525; // Präzession: Äquinoktium des Datums → J2000
  return [norm360(lon), lat, r * 6378.14];
}

/** Geozentrische äquatoriale Koordinaten (J2000) eines Körpers: [RA°, Dec°, Entfernung (AU)]. */
export function geocentric(id, jd) {
  if (id === 'moon') {
    const [lon, lat, km] = moonEcliptic(jd), cl = Math.cos(lat * D2R);
    return toRaDec(eclToEq([cl * Math.cos(lon * D2R), cl * Math.sin(lon * D2R), Math.sin(lat * D2R)])).slice(0, 2).concat(km / AU_KM);
  }
  const e = helio('earth', jd), p = id === 'sun' ? [0, 0, 0] : helio(id, jd);
  return toRaDec(eclToEq([p[0] - e[0], p[1] - e[1], p[2] - e[2]]));
}

export const siderealDeg = (jd, lonDeg) => norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + lonDeg);

/** Höhe und Azimut (Grad; Azimut ab Nord über Ost). */
export function altAz(raDeg, decDeg, jd, lat, lon) {
  const H = (siderealDeg(jd, lon) - raDeg) * D2R, d = decDeg * D2R, p = lat * D2R;
  const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
  return [alt * R2D, norm360(az * R2D)];
}

/** Mondphase: Elongation, beleuchteter Anteil, zunehmend? */
export function moonPhase(jd) {
  const [mlon] = moonEcliptic(jd), e = helio('earth', jd), slon = norm360(Math.atan2(-e[1], -e[0]) * R2D);
  const age = norm360(mlon - slon), fraction = (1 - Math.cos(age * D2R)) / 2;
  const names = ['Neumond', 'Zunehmende Sichel', 'Erstes Viertel', 'Zunehmender Mond', 'Vollmond', 'Abnehmender Mond', 'Letztes Viertel', 'Abnehmende Sichel'];
  return { age, fraction, waxing: age < 180, name: names[Math.round(age / 45) % 8] };
}

export const bodies = [
  { id: 'system', name: 'Sonnensystem', symbol: '☉', kind: 'Übersicht', text: 'Acht Planeten, ihre Bahnen und ihr heutiger Ort.' },
  { id: 'sun', name: 'Sonne', symbol: '☀', kind: 'Stern', tex: 'sun', color: '#f6b54a', tilt: 7.25, rotation: 609.12 },
  { id: 'mercury', name: 'Merkur', symbol: '☿', kind: 'Gesteinsplanet', tex: 'mercury', color: '#a79b91' },
  { id: 'venus', name: 'Venus', symbol: '♀', kind: 'Gesteinsplanet', tex: 'venus', color: '#e3c27f' },
  { id: 'earth', name: 'Erde', symbol: '⊕', kind: 'Gesteinsplanet', tex: 'earth', color: '#4f8fd6', clouds: true },
  { id: 'moon', name: 'Mond', symbol: '☾', kind: 'Erdtrabant', tex: 'moon', color: '#b9b9b4' },
  { id: 'mars', name: 'Mars', symbol: '♂', kind: 'Gesteinsplanet', tex: 'mars', color: '#c8643c' },
  { id: 'jupiter', name: 'Jupiter', symbol: '♃', kind: 'Gasriese', tex: 'jupiter', color: '#d3a57a' },
  { id: 'saturn', name: 'Saturn', symbol: '♄', kind: 'Gasriese', tex: 'saturn', color: '#e0c48a', ring: true },
  { id: 'uranus', name: 'Uranus', symbol: '⛢', kind: 'Eisriese', tex: 'uranus', color: '#9fd8de' },
  { id: 'neptune', name: 'Neptun', symbol: '♆', kind: 'Eisriese', tex: 'neptune', color: '#4f73d9' },
  { id: 'pluto', name: 'Pluto', symbol: '♇', kind: 'Zwergplanet', color: '#c9a98b' },
];
export const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// NASA Sun Fact Sheet (NSSDCA)
export const SUN = { mass: 1988400, diameter: 1391400, density: 1408, gravity: 274, escape: 617.6, rotation: 609.12, obliquity: 7.25, temperature: 5772 - 273.15, core: 1.571e7 };

// Schematischer Schalenaufbau: [Anteil am Radius, Farbe, Bezeichnung]. Gerundet; besonders bei Gas- und Eisriesen unsicher.
export const layers = {
  sun: [[0.25, '#fff2b0', 'Kern · Kernfusion'], [0.7, '#ffb347', 'Strahlungszone'], [1, '#f2762e', 'Konvektionszone']],
  mercury: [[0.83, '#a0603a', 'Eisenkern (sehr groß)'], [0.98, '#8a7f76', 'Silikatmantel'], [1, '#c2b7ad', 'Kruste']],
  venus: [[0.5, '#c46f3a', 'Eisenkern'], [0.97, '#a8613f', 'Gesteinsmantel'], [1, '#e2c58e', 'Kruste']],
  earth: [[0.19, '#ffd27a', 'Innerer Kern (fest)'], [0.55, '#f09a3e', 'Äußerer Kern (flüssig)'], [0.99, '#c5553a', 'Mantel'], [1, '#6f9a5a', 'Kruste']],
  moon: [[0.2, '#c46f3a', 'Kleiner Eisenkern'], [0.97, '#8f8a80', 'Mantel'], [1, '#c9c6bd', 'Kruste']],
  mars: [[0.54, '#c46f3a', 'Flüssiger Eisenkern'], [0.98, '#9c4a32', 'Mantel'], [1, '#d07a52', 'Kruste']],
  jupiter: [[0.15, '#8d6b4c', 'Kern (Gestein/Eis, verdünnt)'], [0.78, '#b9956e', 'Metallischer Wasserstoff'], [1, '#e1c49f', 'Wasserstoff & Helium']],
  saturn: [[0.2, '#8d6b4c', 'Kern (Gestein/Eis)'], [0.5, '#b9956e', 'Metallischer Wasserstoff'], [1, '#ead6a8', 'Wasserstoff & Helium']],
  uranus: [[0.25, '#7a6a5a', 'Gesteinskern'], [0.8, '#5fb3b8', 'Eismantel (Wasser, Ammoniak, Methan)'], [1, '#b6e3e6', 'Wasserstoff, Helium, Methan']],
  neptune: [[0.25, '#7a6a5a', 'Gesteinskern'], [0.8, '#3f6fb8', 'Eismantel (Wasser, Ammoniak, Methan)'], [1, '#6f8fe0', 'Wasserstoff, Helium, Methan']],
  pluto: [[0.7, '#8a7462', 'Gesteinskern'], [1, '#d9c4ae', 'Eismantel']],
};

export const texts = {
  system: ['Ein Stern. Acht Welten.', 'Alle Planeten kreisen in fast derselben Ebene um die Sonne – ein Überbleibsel der rotierenden Scheibe, aus der vor 4,6 Milliarden Jahren alles entstand. Die inneren vier sind klein und felsig, die äußeren vier riesig und gasförmig.', 'Die Positionen werden für das gewählte Datum aus den Bahnelementen des JPL berechnet. In der kompakten Ansicht sind Abstände gestaucht und Planeten stark vergrößert – sonst wären sie unsichtbar klein.'],
  sun: ['Unser Stern.', 'Die Sonne vereint 99,8 % der Masse des Sonnensystems. In ihrem Kern verschmilzt Wasserstoff zu Helium – bei rund 15 Millionen Grad. Die Energie braucht zehntausende Jahre bis zur Oberfläche und dann nur gut 8 Minuten bis zur Erde.', 'Die Sonne ist ein ganz gewöhnlicher Stern der Hauptreihe. Schau nie ohne geeigneten Schutz direkt hinein.'],
  mercury: ['Klein, schnell, extrem.', 'Merkur rast in nur 88 Tagen um die Sonne. Ohne nennenswerte Atmosphäre schwankt die Temperatur zwischen über 400 °C am Tag und unter −170 °C in der Nacht. Sein Eisenkern füllt einen ungewöhnlich großen Teil des Planeten.', 'Ein Merkurtag (Sonnenaufgang bis Sonnenaufgang) dauert länger als zwei Merkurjahre.'],
  venus: ['Die Treibhaus-Hölle.', 'Venus ist fast so groß wie die Erde, aber unter dichten Schwefelsäurewolken herrschen 464 °C und der 92-fache Luftdruck. Der Treibhauseffekt ihrer Kohlendioxid-Atmosphäre macht sie heißer als Merkur.', 'Venus dreht sich rückwärts – und so langsam, dass ein Venustag länger dauert als ihr Jahr.'],
  earth: ['Unser Zuhause.', 'Die Erde ist der einzige bekannte Ort mit flüssigem Wasser an der Oberfläche und Leben. Ihr Magnetfeld schützt vor dem Sonnenwind, die Atmosphäre hält die Wärme. Die Achsneigung von 23,4° sorgt für die Jahreszeiten.', 'Mehr zum Inneren der Erde zeigt TERRA, Atlas 03 der Familie.'],
  moon: ['Unser Begleiter.', 'Der Mond entstand vermutlich, als ein marsgroßer Körper mit der jungen Erde zusammenstieß. Er zeigt uns immer dieselbe Seite, weil er sich in derselben Zeit einmal dreht, in der er die Erde umrundet.', 'Seine Anziehung erzeugt Ebbe und Flut und stabilisiert die Neigung der Erdachse.'],
  mars: ['Der rote Planet.', 'Eisenoxid – Rost – färbt den Staub des Mars rot. Er besitzt den höchsten Vulkan des Sonnensystems (Olympus Mons) und ein riesiges Grabensystem. Ausgetrocknete Flusstäler zeigen: Hier floss einst Wasser.', 'Heute gibt es Wassereis an den Polen und im Boden; die Atmosphäre ist rund 160-mal dünner als die der Erde.'],
  jupiter: ['Der Riese.', 'Jupiter hat mehr als die doppelte Masse aller anderen Planeten zusammen. Er besteht vor allem aus Wasserstoff und Helium. Der Große Rote Fleck ist ein Sturm, größer als die Erde, der seit Jahrhunderten tobt.', 'Unter hohem Druck wird Wasserstoff in seinem Inneren elektrisch leitend – das erzeugt ein gewaltiges Magnetfeld.'],
  saturn: ['Der Herr der Ringe.', 'Saturns Ringe bestehen aus unzähligen Eis- und Gesteinsbrocken – hunderttausende Kilometer breit, aber meist nur wenige Dutzend Meter dick. Der Planet selbst ist so leicht, dass er in einer riesigen Badewanne schwimmen würde.', 'Die Zahl der bekannten Monde wächst mit jeder Beobachtungskampagne.'],
  uranus: ['Der gekippte Planet.', 'Uranus rollt gewissermaßen auf seiner Bahn: Seine Achse ist um fast 98° geneigt. So erlebt jeder Pol rund 42 Jahre Dauertag und danach 42 Jahre Nacht. Methan in der Atmosphäre färbt ihn blaugrün.', 'Er war der erste Planet, der mit einem Teleskop entdeckt wurde (William Herschel, 1781).'],
  neptune: ['Der äußerste Planet.', 'Auf Neptun wehen die schnellsten Winde des Sonnensystems – über 2.000 km/h. Er wurde 1846 zuerst berechnet und dann gefunden: Ein Planet, den die Mathematik entdeckte.', 'Licht der Sonne braucht gut vier Stunden bis zu ihm.'],
  pluto: ['Der Zwergplanet.', 'Pluto galt von 1930 bis 2006 als neunter Planet. Seit der Neudefinition zählt er zu den Zwergplaneten im Kuipergürtel. Die Sonde New Horizons zeigte 2015 eine herzförmige Ebene aus Stickstoffeis.', 'Seine Bahn ist stark geneigt und so elliptisch, dass er zeitweise näher an der Sonne ist als Neptun. Bahnposition hier nur angenähert.'],
};

export const processes = [
  { id: 'phases', name: 'Mondphasen', formula: 'Ein Umlauf: ~29,5 Tage', steps: ['Neumond', 'Erstes Viertel', 'Vollmond', 'Letztes Viertel'],
    texts: ['Der Mond steht zwischen Erde und Sonne. Seine beleuchtete Seite zeigt von uns weg – wir sehen ihn nicht, außerdem geht er mit der Sonne auf und unter.', 'Eine Woche später sehen wir die rechte Hälfte beleuchtet (auf der Nordhalbkugel). Der zunehmende Mond steht am Abend im Süden.', 'Erde zwischen Sonne und Mond: Die ganze uns zugewandte Seite ist hell. Der Vollmond geht auf, wenn die Sonne untergeht.', 'Jetzt ist die linke Hälfte hell. Der abnehmende Mond geht erst um Mitternacht auf und ist morgens zu sehen.'] },
  { id: 'eclipse', name: 'Finsternisse', formula: 'Mondbahn um 5,1° geneigt', steps: ['Schräge Mondbahn', 'Knotenlinie', 'Sonnenfinsternis', 'Mondfinsternis'],
    texts: ['Die Mondbahn ist gegen die Erdbahn um gut 5° geneigt. Meist zieht der Mond deshalb über oder unter der Linie Sonne–Erde vorbei – und es gibt keine Finsternis.', 'Nur wenn Neu- oder Vollmond nahe den beiden Schnittpunkten der Bahnen (Knoten) liegt, stehen Sonne, Erde und Mond exakt in einer Reihe. Das passiert etwa zweimal im Jahr.', 'Bei Neumond im Knoten fällt der Schatten des Mondes auf die Erde. Nur im schmalen Kernschatten wird die Sonne vollständig verdeckt.', 'Bei Vollmond im Knoten wandert der Mond durch den Erdschatten. Er wird dann oft kupferrot – Sonnenlicht wird in der Erdatmosphäre gebrochen.'] },
  { id: 'seasons', name: 'Jahreszeiten', formula: 'Erdachse um 23,4° geneigt', steps: ['Frühlingsanfang', 'Sommeranfang', 'Herbstanfang', 'Winteranfang'],
    texts: ['Die Jahreszeiten entstehen nicht durch den Abstand zur Sonne, sondern durch die geneigte Erdachse. Zum Frühlingsanfang (um den 20. März) sind Tag und Nacht überall etwa gleich lang.', 'Um den 21. Juni ist die Nordhalbkugel zur Sonne geneigt: Die Sonne steht hoch, die Tage sind lang – Sommer im Norden, Winter im Süden.', 'Um den 23. September stehen wieder beide Halbkugeln gleich zur Sonne: Herbstanfang auf der Nord-, Frühlingsanfang auf der Südhalbkugel.', 'Um den 21. Dezember zeigt die Nordhalbkugel von der Sonne weg. Übrigens: Gerade dann ist die Erde der Sonne am nächsten.'] },
  { id: 'starlife', name: 'Leben eines Sterns', formula: 'Masse bestimmt das Schicksal', steps: ['Gasnebel', 'Hauptreihe', 'Roter Riese', 'Weißer Zwerg'],
    texts: ['Sterne entstehen in kalten Wolken aus Gas und Staub. Die Schwerkraft zieht verdichtete Bereiche zusammen, bis es im Inneren heiß genug für Kernfusion wird.', 'Auf der Hauptreihe fusioniert ein Stern Milliarden Jahre lang Wasserstoff zu Helium – so wie unsere Sonne seit 4,6 Milliarden Jahren.', 'Ist der Wasserstoff im Kern verbraucht, bläht sich der Stern zum Roten Riesen auf. Im Inneren entstehen schwerere Elemente wie Kohlenstoff und Sauerstoff.', 'Sonnenähnliche Sterne stoßen ihre Hülle ab und hinterlassen einen Weißen Zwerg. Sehr massereiche Sterne explodieren dagegen als Supernova – dabei entstehen viele Elemente, aus denen auch wir bestehen.'] },
];

export const CITIES = [
  ['Berlin', 52.52, 13.405], ['Hamburg', 53.551, 9.994], ['München', 48.137, 11.575], ['Köln', 50.938, 6.96], ['Frankfurt am Main', 50.11, 8.682],
  ['Stuttgart', 48.776, 9.183], ['Leipzig', 51.34, 12.375], ['Wien', 48.208, 16.373], ['Zürich', 47.377, 8.541], ['Istanbul', 41.008, 28.978],
];
