const { generateReview, createReviewNonce } = await import("../lib/assembler.ts");
// Measure REPEAT VISIBILITY across 100 reviews of one store: how often does the
// same (normalized) sentence reappear? A guest reading a store's review page
// notices repeated distinctive sentences long before whole-review collisions.
const CASES = [
  { n:"Kotobuki Clinic", loc:"en", cat:"aesthetic clinic",
    f:["Japanese aesthetic medicine in Dubai","aesthetic treatments in Dubai","regenerative medicine"],
    g:["IV Drip","IV Therapy","Exosome Therapy","Hydrogen Inhalation Therapy","Peptide Therapy","HydraFacial","Acne Scar Treatment","Regenerative Medicine","AGA Treatment","Vitamin IV","Diabetes & Metabolism Programme","Weight Management Programme","Medical Wellness Check","Anti-Aging Treatment"],
    e:{area:"Trade Centre",city:"Dubai",categoryLabel:{en:"Japanese aesthetic clinic",ja:"美容・再生医療クリニック"}} },
  { n:"Maru Udon", loc:"ja", cat:"japanese restaurant",
    f:["udon in Dubai","sanuki-style udon","handmade udon noodles"],
    g:["Niku Beef udon","Hokkaido Curry","Karamiso Spice","Paitan Chicken","Katsu Curry Udon","Kake Classic","Zaru Dipping","Premium Wagyu Beef Gyudon","Karaage Don","Tempura Don","Shrimp Gyoza","shrimp tempura","onigiri rice balls","Udonut dessert"],
    e:{area:"Motor City",city:"Dubai",categoryLabel:{en:"udon restaurant",ja:"うどん店"}} },
  { n:"Pitfire Pizza", loc:"en", cat:"pizza restaurant",
    f:["pizza in Dubai","artisan pizza","72-hour dough"],
    g:["Garlic Knots","Hot Honey Margherita","Black Truffle Cream Linguine","Buffalo Chicken Wings","Korean Style Wings","Bresaola & Rocket","Truffle Pasta","Chicken Penne Alfredo","Herby Chicken Caesar","Chocolate Chip Cookie Brownie","crispy crust","oven-fresh pizza","quick service","friendly team","comfortable seating","good value"],
    e:{area:"Dubai Hills",city:"Dubai",categoryLabel:{en:"pizza restaurant"}} },
];
const N = 100;
function normalize(s, kws, store, ent) {
  let t = s;
  for (const k of [...kws, store, ent.area||"", ent.city||"", ...(Object.values(ent.categoryLabel||{}))]) {
    if (k) t = t.split(k).join("‹›");
  }
  return t.replace(/\s+/g," ").trim().toLowerCase();
}
for (const c of CASES) {
  const sentCount = new Map(); const openers = new Map(); const closers = new Map();
  const splitRe = c.loc==="ja" ? /[^。]*。|[^。]+$/g : /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  for (let i=0;i<N;i++){
    // realistic: 1-3 taps rotating through the menu, forced rotation like prod (2 offered, most keep them)
    const taps = 1+(i%3);
    const start = (i*5)%c.g.length;
    const guest=[]; for(let k=0;k<taps;k++) guest.push(c.g[(start+k)%c.g.length]);
    const fslice=[c.f[i%c.f.length], c.f[(i+1)%c.f.length]];
    const t = generateReview(c.n,[...fslice,...guest],{nonce:createReviewNonce(),outletKey:`div|${c.n}`,locale:c.loc,category:c.cat,rating: i%6===0?4:5,entity:c.e});
    const sents=(t.replace(/\n+/g," ").match(splitRe)??[]).map(s=>s.trim()).filter(Boolean);
    sents.forEach((s,idx)=>{
      const key=normalize(s,[...c.f,...c.g],c.n,c.e);
      if(!key||key==="‹›") return;
      sentCount.set(key,(sentCount.get(key)??0)+1);
      if(idx===0) openers.set(key,(openers.get(key)??0)+1);
      if(idx===sents.length-1) closers.set(key,(closers.get(key)??0)+1);
    });
  }
  const top=(m,k=8)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k);
  const over5=[...sentCount.entries()].filter(([,v])=>v>=5).length;
  const over10=[...sentCount.entries()].filter(([,v])=>v>=10).length;
  console.log(`\n===== ${c.n} / ${c.loc} — ${N} reviews =====`);
  console.log(`distinct sentences: ${sentCount.size} | appearing >=5x: ${over5} | >=10x: ${over10}`);
  console.log(`distinct openers: ${openers.size} | distinct closers: ${closers.size}`);
  console.log("top repeated sentences:");
  for (const [s,v] of top(sentCount)) console.log(`  ${String(v).padStart(3)}x  ${s.slice(0,90)}`);
  console.log("top openers:", top(openers,4).map(([s,v])=>`${v}x "${s.slice(0,50)}"`).join(" | "));
  console.log("top closers:", top(closers,4).map(([s,v])=>`${v}x "${s.slice(0,50)}"`).join(" | "));
}
