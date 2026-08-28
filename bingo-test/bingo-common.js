// Gedeelde logica voor Bingo 2.0 — ondersteunt 4 officiele bingo-varianten.
//
// 90-bal (Klassiek Europees): 3x9 kaart, 15 nummers, kolommen = tientallen.
//   Elk A4-vel = 1 "strip" van 6 kaarten die SAMEN precies 1-90 dekken (elk nummer 1x).
//   Winnen met 1 lijn, 2 lijnen of volle kaart.
// 75-bal (Amerikaans/BINGO): 5x5 kaart, 24 nummers + gratis middenvakje.
//   Kolommen = B/I/N/G/O. Elke kaart onafhankelijk willekeurig (standaardregels).
//   Winnen met een lijn (rij, kolom of diagonaal) of volle kaart (blackout).
// 80-bal (Shutter): 4x4 kaart, 16 nummers, kolommen in vaste kleuren.
//   Winnen met een lijn of volle kaart.
// 30-bal (Speed): 3x3 kaart, 9 nummers, geen lege vakjes.
//   Alleen te winnen met een volle kaart.

/* ---------- Variant-definities ---------- */
const BINGO_VARIANTS = {
  eu90: {
    id: 'eu90',
    label: '90-bal — Klassiek Europees',
    shortLabel: '90-bal',
    totalBalls: 90, rows: 3, cols: 9,
    columns: [
      {min:1,max:9},{min:10,max:19},{min:20,max:29},{min:30,max:39},{min:40,max:49},
      {min:50,max:59},{min:60,max:69},{min:70,max:79},{min:80,max:90}
    ],
    numbersPerCard: 15, hasFreeSpace: false,
    cardsPerPage: 6, mode: 'strip', winLines: 'rows',
    description: 'Elk A4-vel bevat 6 kaarten die samen exact 1 t/m 90 dekken. Winnen met 1 lijn, 2 lijnen of een volle kaart.'
  },
  us75: {
    id: 'us75',
    label: '75-bal — Amerikaans (BINGO)',
    shortLabel: '75-bal',
    totalBalls: 75, rows: 5, cols: 5,
    columns: [{min:1,max:15},{min:16,max:30},{min:31,max:45},{min:46,max:60},{min:61,max:75}],
    columnLetters: ['B','I','N','G','O'],
    numbersPerCard: 24, hasFreeSpace: true, freeSpace: {r:2,c:2},
    cardsPerPage: 4, mode: 'random', winLines: 'rows-cols-diag',
    description: '5x5-kaart met gratis middenvakje. Winnen met een lijn (rij, kolom of diagonaal) of een volle kaart (blackout).'
  },
  uk80: {
    id: 'uk80',
    label: '80-bal — Shutter',
    shortLabel: '80-bal',
    totalBalls: 80, rows: 4, cols: 4,
    columns: [{min:1,max:20},{min:21,max:40},{min:41,max:60},{min:61,max:80}],
    columnColors: ['#c8203a','#d4af37','#2d6fb0','#2fae66'],
    numbersPerCard: 16, hasFreeSpace: false,
    cardsPerPage: 6, mode: 'random', winLines: 'rows',
    description: '4x4-kaart, elke kolom een eigen kleur. Winnen met een lijn of een volle kaart.'
  },
  speed30: {
    id: 'speed30',
    label: '30-bal — Speed',
    shortLabel: '30-bal',
    totalBalls: 30, rows: 3, cols: 3,
    columns: [{min:1,max:10},{min:11,max:20},{min:21,max:30}],
    numbersPerCard: 9, hasFreeSpace: false,
    cardsPerPage: 6, mode: 'random', winLines: 'none',
    description: '3x3-kaart, geen lege vakjes. Alleen te winnen met een volle kaart — supersnel spel.'
  }
};
const DEFAULT_VARIANT_ID = 'eu90';

/* ---------- Seeded RNG (mulberry32) ---------- */
function mulberry32(seed){
  let s = seed >>> 0;
  return function(){
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith(arr, rng){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function randomSeed(){
  return Math.floor(Math.random()*4294967295);
}

/* =========================================================================
   90-BAL: strip-generatie (6 kaarten die samen 1-90 dekken) - ongewijzigd
   ========================================================================= */
const TICKETS_PER_STRIP = 6;
const BINGO_COLUMNS = BINGO_VARIANTS.eu90.columns;

function tryGenerateStrip(rng){
  const ROWS = 3, COLS = 9;
  const rowCap = Array.from({length:TICKETS_PER_STRIP}, () => [5,5,5]);
  const ticketRemaining = Array(TICKETS_PER_STRIP).fill(15);
  const grids = Array.from({length:TICKETS_PER_STRIP}, () => Array.from({length:ROWS}, () => Array(COLS).fill(null)));
  const colCountPerTicket = Array.from({length:TICKETS_PER_STRIP}, () => Array(COLS).fill(0));

  for(let c=0;c<COLS;c++){
    const range = BINGO_COLUMNS[c];
    const nums = [];
    for(let n=range.min;n<=range.max;n++) nums.push(n);
    const shuffledNums = shuffleWith(nums, rng);
    const size = nums.length;

    const picks = [];
    for(let i=0;i<size;i++){
      const candidates = [];
      for(let t=0;t<TICKETS_PER_STRIP;t++){
        if(colCountPerTicket[t][c] < 3 && ticketRemaining[t] > 0) candidates.push(t);
      }
      if(candidates.length === 0) return null;
      const maxRem = Math.max(...candidates.map(t => ticketRemaining[t]));
      const top = candidates.filter(t => ticketRemaining[t] === maxRem);
      const chosen = top[Math.floor(rng()*top.length)];
      picks.push(chosen);
      colCountPerTicket[chosen][c]++;
      ticketRemaining[chosen]--;
    }

    const byTicket = Array.from({length:TICKETS_PER_STRIP}, () => []);
    picks.forEach((t,i) => byTicket[t].push(shuffledNums[i]));

    for(let t=0;t<TICKETS_PER_STRIP;t++){
      const numsForTicket = byTicket[t].sort((a,b)=>a-b);
      if(numsForTicket.length === 0) continue;
      let rowsAvailable = [0,1,2].filter(r => rowCap[t][r] > 0);
      if(rowsAvailable.length < numsForTicket.length) return null;
      rowsAvailable = shuffleWith(rowsAvailable, rng).sort((a,b) => rowCap[t][b] - rowCap[t][a]);
      const chosenRows = rowsAvailable.slice(0, numsForTicket.length).sort((a,b)=>a-b);
      chosenRows.forEach((r,i) => {
        grids[t][r][c] = numsForTicket[i];
        rowCap[t][r]--;
      });
    }
  }

  for(let t=0;t<TICKETS_PER_STRIP;t++){
    for(let r=0;r<3;r++){
      if(rowCap[t][r] !== 0) return null;
    }
  }
  return grids;
}

function generateStripFromSeed(seed){
  for(let attempt=0; attempt<300; attempt++){
    const rng = mulberry32((seed ^ (attempt * 0x9E3779B1)) >>> 0);
    const grids = tryGenerateStrip(rng);
    if(grids) return grids;
  }
  return null;
}

function rowsFromGrid(grid){
  return grid.map(row => row.filter(n => n !== null));
}
function gridFromRows(row1, row2, row3){
  const grid = Array.from({length:3}, () => Array(9).fill(null));
  [row1, row2, row3].forEach((row, r) => {
    row.forEach(n => {
      const c = BINGO_COLUMNS.findIndex(rng => n >= rng.min && n <= rng.max);
      if(c >= 0) grid[r][c] = n;
    });
  });
  return grid;
}

function generateStrips(stripCount){
  const strips = [];
  for(let i=0;i<stripCount;i++){
    const seed = randomSeed();
    const grids = generateStripFromSeed(seed);
    if(!grids) continue;
    const tickets = grids.map((grid, ticketIndex) => buildTicket(grid, seed, ticketIndex));
    strips.push({ seed, tickets });
  }
  return strips;
}

function buildTicket(grid, seed, ticketIndex){
  const rows = rowsFromGrid(grid);
  const qrCell = pickRandomEmptyCell(grid);
  return {
    variantId: 'eu90', grid, row1: rows[0], row2: rows[1], row3: rows[2],
    seed, ticketIndex, code: encodeTextCode(seed, ticketIndex, 'eu90'),
    qrCell
  };
}

function pickRandomEmptyCell(grid){
  const empties = [];
  for(let r=0;r<grid.length;r++) for(let c=0;c<grid[0].length;c++) if(grid[r][c] === null) empties.push({r,c});
  if(empties.length === 0) return {r:0,c:0};
  return empties[Math.floor(Math.random()*empties.length)];
}

/* =========================================================================
   75-BAL / 80-BAL / 30-BAL: onafhankelijke willekeurige kaarten
   ========================================================================= */
function generateRandomCard(variant, rng){
  const grid = Array.from({length:variant.rows}, () => Array(variant.cols).fill(null));
  variant.columns.forEach((range, c) => {
    const isFreeCol = variant.hasFreeSpace && variant.freeSpace.c === c;
    const freeRow = isFreeCol ? variant.freeSpace.r : -1;
    const need = variant.rows - (isFreeCol ? 1 : 0);
    const pool = [];
    for(let n=range.min;n<=range.max;n++) pool.push(n);
    const picked = shuffleWith(pool, rng).slice(0, need).sort((a,b)=>a-b);
    let idx = 0;
    for(let r=0;r<variant.rows;r++){
      if(r === freeRow){ grid[r][c] = 'FREE'; continue; }
      grid[r][c] = picked[idx++];
    }
  });
  return grid;
}

function generateCardsForVariant(variant, count){
  const cards = [];
  for(let i=0;i<count;i++){
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const grid = generateRandomCard(variant, rng);
    cards.push({
      variantId: variant.id, grid, seed, cardIndex: i,
      code: encodeTextCode(seed, i, variant.id)
    });
  }
  return cards;
}

function paginateCards(cards, cardsPerPage){
  const pages = [];
  for(let i=0;i<cards.length;i+=cardsPerPage){
    pages.push(cards.slice(i, i+cardsPerPage));
  }
  return pages;
}

/* ---------- Korte intypbare code ----------
   Gebruikt een alfabet ZONDER O, I, L, U om verwarring met 0/1/V te voorkomen
   (dezelfde aanpak als Crockford Base32). Elke nieuwe code krijgt een extra
   CONTROLECIJFER aan het eind. Zo kan decodeSeedPart met (vrijwel) zekerheid
   zien of een getypte code nieuw of oud (legacy base36) is, in plaats van te
   gokken op basis van "bevat hij toevallig geen O/I/L/U" — dat bleek fout te
   gaan bij oude codes die toevallig geen van die letters bevatten. */
const SAFE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 tekens, geen O/I/L/U
function seedToSafeCode(seed){
  let n = seed >>> 0;
  if(n === 0) return '0';
  let out = '';
  while(n > 0){
    out = SAFE_ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}
function safeCodeToSeed(str){
  let n = 0;
  for(let i=0;i<str.length;i++){
    const idx = SAFE_ALPHABET.indexOf(str[i]);
    if(idx === -1) return null;
    n = n * 32 + idx;
  }
  return n >>> 0;
}
function checksumChar(seedCodeBody){
  let sum = 0;
  for(let i=0;i<seedCodeBody.length;i++){
    sum = (sum * 31 + SAFE_ALPHABET.indexOf(seedCodeBody[i])) % 32;
  }
  return SAFE_ALPHABET[sum];
}
// Herkent of een getypte seed-code oud (base36, kan O/I/L/U bevatten, geen
// controlecijfer) of nieuw (veilig alfabet + controlecijfer) is, aan de hand
// van het controlecijfer -- niet aan de hand van welke letters erin zitten.
function decodeSeedPart(str){
  if(str.length >= 2){
    const body = str.slice(0, -1);
    const check = str.slice(-1);
    const bodySeed = safeCodeToSeed(body);
    if(bodySeed !== null && checksumChar(body) === check){
      return bodySeed;
    }
  }
  const legacy = parseInt(str, 36);
  return isNaN(legacy) ? null : (legacy >>> 0);
}

function encodeTextCode(seed, cardIndex, variantId){
  const body = seedToSafeCode(seed);
  const seedStr = body + checksumChar(body);
  const idxStr = String(cardIndex + 1).padStart(2, '0');
  if(!variantId || variantId === 'eu90') return seedStr + '-' + idxStr;
  return variantId.toUpperCase() + '-' + seedStr + '-' + idxStr;
}
function decodeTextCode(code){
  if(!code) return null;
  const clean = code.trim().toUpperCase();
  const parts = clean.split('-');
  if(parts.length === 2){
    const seed = decodeSeedPart(parts[0]);
    const idx = parseInt(parts[1], 10) - 1;
    if(seed === null || isNaN(idx) || idx < 0 || idx >= TICKETS_PER_STRIP) return null;
    const grids = generateStripFromSeed(seed);
    if(!grids || !grids[idx]) return null;
    return { variantId: 'eu90', grid: grids[idx] };
  }
  if(parts.length === 3){
    const variantId = parts[0].toLowerCase();
    const variant = BINGO_VARIANTS[variantId];
    if(!variant) return null;
    const seed = decodeSeedPart(parts[1]);
    const idx = parseInt(parts[2], 10) - 1;
    if(seed === null || idx < 0 || isNaN(idx)) return null;
    const rng = mulberry32(seed);
    const grid = generateRandomCard(variant, rng);
    return { variantId, grid };
  }
  return null;
}

/* ---------- QR-encodering van een kaart ---------- */
function encodeCardQR(card){
  const rows = card.grid.map(row => row.map(v => v === null ? '' : (v === 'FREE' ? 'F' : v)).join(',')).join('|');
  return 'CARD2:' + card.variantId + ':' + rows;
}
function decodeCardQR(text){
  if(!text) return null;
  if(text.startsWith('CARD2:')){
    const body = text.slice(6);
    const sep = body.indexOf(':');
    if(sep === -1) return null;
    const variantId = body.slice(0, sep);
    const variant = BINGO_VARIANTS[variantId];
    if(!variant) return null;
    const grid = body.slice(sep+1).split('|').map(rowStr => rowStr.split(',').map(cell => {
      if(cell === '') return null;
      if(cell === 'F') return 'FREE';
      const n = Number(cell);
      return isNaN(n) ? null : n;
    }));
    return { variantId, grid };
  }
  if(text.startsWith('CARD:')){
    const body = text.slice(5);
    const parts = body.split('|');
    if(parts.length !== 3) return null;
    try{
      const row1 = parts[0].split(',').filter(Boolean).map(Number);
      const row2 = parts[1].split(',').filter(Boolean).map(Number);
      const row3 = parts[2].split(',').filter(Boolean).map(Number);
      if(row1.some(isNaN) || row2.some(isNaN) || row3.some(isNaN)) return null;
      return { variantId: 'eu90', grid: gridFromRows(row1, row2, row3) };
    }catch(e){ return null; }
  }
  return null;
}

/* ---------- Vel-QR (1 grote QR per A4-vel, alleen 90-bal) ----------
   Bevat enkel de gedeelde seed van de strip; alle 6 kaarten worden
   daaruit opnieuw berekend (identiek aan hoe ze gegenereerd zijn). */
function encodeStripQR(seed){
  const body = seedToSafeCode(seed);
  return 'STRIP:' + body + checksumChar(body);
}
function decodeStripQR(text){
  if(!text || !text.startsWith('STRIP:')) return null;
  const seed = decodeSeedPart(text.slice(6));
  if(seed === null) return null;
  const grids = generateStripFromSeed(seed);
  if(!grids) return null;
  const tickets = grids.map((grid, i) => buildTicket(grid, seed, i));
  return { seed, tickets };
}

function encodeStateQR(calledArray){
  return 'STATE:' + calledArray.slice().sort((a,b)=>a-b).join(',');
}
function decodeStateQR(text){
  if(!text || !text.startsWith('STATE:')) return null;
  const body = text.slice(6);
  if(body.trim() === '') return [];
  const nums = body.split(',').filter(Boolean).map(Number);
  if(nums.some(isNaN)) return null;
  return nums;
}

/* ---------- Winst-check (variant-bewust) ---------- */
function checkCardAgainstDrawn(card, calledSet){
  const variant = BINGO_VARIANTS[card.variantId] || BINGO_VARIANTS.eu90;
  const grid = card.grid;
  const isPlayable = (v) => v !== null;
  const isHit = (v) => v === 'FREE' || calledSet.has(v);

  const rowResults = grid.map(row => {
    const playable = row.filter(isPlayable);
    return playable.length > 0 && playable.every(isHit);
  });

  let colResults = [];
  let diagResults = [];
  if(variant.winLines === 'rows-cols-diag'){
    for(let c=0;c<variant.cols;c++){
      const colVals = grid.map(row => row[c]).filter(isPlayable);
      colResults.push(colVals.length > 0 && colVals.every(isHit));
    }
    const diagMain = [], diagAnti = [];
    for(let i=0;i<Math.min(variant.rows, variant.cols);i++){
      diagMain.push(grid[i][i]);
      diagAnti.push(grid[i][variant.cols-1-i]);
    }
    const diagMainPlayable = diagMain.filter(isPlayable);
    const diagAntiPlayable = diagAnti.filter(isPlayable);
    diagResults = [
      diagMainPlayable.length > 0 && diagMainPlayable.every(isHit),
      diagAntiPlayable.length > 0 && diagAntiPlayable.every(isHit)
    ];
  }

  const allPlayable = grid.flat().filter(isPlayable);
  const fullCard = allPlayable.length > 0 && allPlayable.every(isHit);
  const rowsComplete = rowResults.filter(Boolean).length;
  const anyLine = rowResults.some(Boolean) || colResults.some(Boolean) || diagResults.some(Boolean);

  return { variantId: card.variantId, rowResults, colResults, diagResults, rowsComplete, anyLine, fullCard };
}

/* ---------- HTML-weergave van een check-resultaat (gedeeld door index.html en scan.html) ---------- */
function renderCheckResultHTML(res, card, calledSet){
  const variant = BINGO_VARIANTS[card.variantId] || BINGO_VARIANTS.eu90;
  let title = 'Nog geen lijn', cls = '';

  if(res.fullCard){
    title = 'BINGO! Volle kaart!'; cls = 'win';
  } else if(variant.winLines === 'none'){
    title = 'Nog geen volle kaart';
  } else if(variant.id === 'eu90'){
    if(res.rowsComplete === 2){ title = 'Lijn! (2 rijen)'; cls = 'win'; }
    else if(res.rowsComplete === 1){ title = 'Lijn! (1 rij)'; cls = 'win'; }
  } else if(res.anyLine){
    title = 'Lijn!'; cls = 'win';
  }

  let rowsHTML = '';
  if(variant.id === 'eu90'){
    rowsHTML = '<div class="result-rows">' +
      [0,1,2].map(i => `<span class="${res.rowResults[i] ? 'ok' : ''}">Rij ${i+1} ${res.rowResults[i] ? '\u2713' : ''}</span>`).join('') +
      '</div>';
  }

  let headerHTML = '';
  if(variant.columnLetters){
    headerHTML = `<div class="check-grid" style="grid-template-columns:repeat(${variant.cols},minmax(0,1fr)); margin-top:14px; margin-bottom:2px;">` +
      variant.columnLetters.map(l => `<div class="check-cell" style="background:transparent;color:var(--gold-soft);font-size:12px;">${l}</div>`).join('') +
      '</div>';
  }

  let gridHTML = `<div class="check-grid" style="grid-template-columns:repeat(${variant.cols},minmax(0,1fr));${headerHTML ? 'margin-top:0;' : ''}">`;
  for(let r=0;r<variant.rows;r++){
    for(let c=0;c<variant.cols;c++){
      const v = card.grid[r][c];
      if(v === null){
        gridHTML += '<div class="check-cell empty"></div>';
      } else if(v === 'FREE'){
        gridHTML += '<div class="check-cell hit" style="font-size:9px;">FREE</div>';
      } else{
        const hit = calledSet.has(v);
        gridHTML += `<div class="check-cell ${hit ? 'hit' : 'miss'}">${v}</div>`;
      }
    }
  }
  gridHTML += '</div>';

  return `
    <div class="result-box ${cls}">
      <div class="result-title">${title}</div>
      ${rowsHTML}
      ${headerHTML}
      ${gridHTML}
    </div>
  `;
}

if(typeof module !== 'undefined'){
  module.exports = {
    BINGO_VARIANTS, DEFAULT_VARIANT_ID, BINGO_COLUMNS,
    generateStrips, generateStripFromSeed, buildTicket,
    generateRandomCard, generateCardsForVariant, paginateCards,
    encodeTextCode, decodeTextCode, encodeCardQR, decodeCardQR,
    seedToSafeCode, safeCodeToSeed, checksumChar,
    encodeStripQR, decodeStripQR,
    encodeStateQR, decodeStateQR, checkCardAgainstDrawn, renderCheckResultHTML,
    randomSeed, mulberry32, gridFromRows, shuffleWith
  };
}
