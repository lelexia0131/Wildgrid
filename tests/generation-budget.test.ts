import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareBudget} from '../src/engine/generationBudget';
import {generationBudgets,generationQuantities} from '../src/engine/generationConfig';
import {layoutTerrain,terrainDistribution,terrainRegions,terrainPlacementScores} from '../src/engine/terrainLayout';
import {terrainRegistry} from '../src/engine/terrainRegistry';
import {seeded,generateMap} from '../src/engine/mapGeneration';

test('facility budgets respect the total count cap at every difficulty, including disabled facilities',()=>{
  const caps=[5,6,7,8,10,12,14,16,18,20];
  for(let d=1;d<=10;d++) for(const disabled of [[],['camp_single'],['cabin_el','pool_single']]) {
    const budget=generationBudgets(d,disabled).facilities;
    for(let seed=0;seed<100;seed++) {
      const sample=budget.sample(seeded(seed));
      assert.ok(Object.values(sample.counts).reduce((sum,n)=>sum+n,0)<=caps[d-1],`${d} difficulty, seed ${seed}, disabled ${disabled}`);
      assert.equal(sample.area,budget.items.reduce((sum,item)=>sum+sample.counts[item.id]*item.area,0));
      assert.ok(sample.area>=sample.min && sample.area<=sample.max);
      for(const item of budget.items) assert.ok(sample.counts[item.id]>=item.min && sample.counts[item.id]<=item.max);
    }
  }
});

test('joint integer budgets cover virtual facilities, fixed and zero quantities, infeasibility and combinations',()=>{
  const items=[{id:'virtual',area:4,min:0,max:3},{id:'small',area:1,min:1,max:5},{id:'fixed',area:2,min:1,max:1}];
  const budget=prepareBudget(items),combinations=new Set<string>();
  for(let seed=0;seed<100;seed++) {
    const sample=budget.sample(seeded(seed));
    assert.ok(sample.area>=sample.min && sample.area<=sample.max);
    assert.equal(sample.area,items.reduce((n,i)=>n+sample.counts[i.id]*i.area,0));
    for(const i of items) assert.ok(sample.counts[i.id]>=i.min && sample.counts[i.id]<=i.max);
    combinations.add(JSON.stringify(sample.counts));
  }
  assert.ok(combinations.size>=4);
  assert.throws(()=>prepareBudget([{id:'even',area:2,min:0,max:1}]),/No integer/);
  for(const invalid of [{min:-1,max:1,area:1},{min:2,max:1,area:1},{min:0,max:1,area:0},{min:.5,max:1,area:1}]) assert.throws(()=>prepareBudget([{id:'bad',...invalid}]),/Invalid/);
  assert.equal(prepareBudget([]).sample(seeded(1)).area,0);
});

test('Excel configurations validate every difficulty and disabling recalculates the budget',()=>{
  for(let d=1;d<=10;d++) {
    const full=generationBudgets(d),disabled=generationBudgets(d,['camp_single']);
    const single=full.facilities.items.find(i=>i.id==='camp_single')!;
    assert.ok(single.min>=1);
    assert.deepEqual(full.terrain.sample(seeded(1)),disabled.terrain.sample(seeded(1)));
    assert.ok(!disabled.facilities.items.some(i=>i.id==='camp_single'));
  }
  const changed=structuredClone(generationQuantities);
  changed.facilities.camp_single[0]={min:4,max:6};
  const budget=generationBudgets(1,[],changed).facilities;
  assert.equal(budget.target,5);
  assert.ok(budget.sample(seeded(2)).counts.camp_single>=4);
  delete changed.facilities.fire_single;
  assert.throws(()=>generationBudgets(1,[],changed),/Missing.*fire_single/);
  const unknown=structuredClone(generationQuantities);unknown.terrain.virtual=unknown.terrain.water;
  assert.throws(()=>generationBudgets(1,[],unknown),/Unknown.*virtual/);
  const incomplete=structuredClone(generationQuantities);incomplete.terrain.water.pop();
  assert.throws(()=>generationBudgets(1,[],incomplete),/Missing.*water/);
});

test('virtual multi-cell terrain uses the same budget, layout, connectivity and density checks',()=>{
  const definitions=[...terrainRegistry,{id:'virtual',name:'Virtual',cells:[{r:0,c:0},{r:0,c:1}],diagonal:false,componentMax:3,clusterBias:.2,compactnessBias:0}];
  const budget=prepareBudget([{id:'virtual',area:2,min:2,max:3},{id:'water',area:1,min:2,max:3}]);
  const layouts=new Set<string>();
  for(let seed=0;seed<24;seed++) {
    const random=seeded(seed),a=budget.sample(random),terrain=layoutTerrain(random,a.counts,definitions,a.area);
    assert.ok(terrain);
    assert.equal(terrain.length,a.area);
    assert.equal(terrain.filter(t=>t.kind==='virtual').length,a.counts.virtual*2);
    assert.deepEqual(terrainDistribution(terrain,terrainRegions(terrain,definitions),definitions).violations,[]);
    layouts.add(JSON.stringify(terrain));
  }
  assert.ok(layouts.size>12);
  const ridge=[{r:3,c:1,kind:'virtual'},{r:3,c:2,kind:'virtual'},{r:3,c:4,kind:'virtual'}];
  assert.ok(!terrainPlacementScores(ridge,'virtual',10,definitions).some(p=>p.cell.r===3 && p.cell.c===3));
});

test('generation adopts edited quantities without changing the allocation or layout code',()=>{
  const previous=structuredClone(generationQuantities);
  try {
    for(const values of Object.values(generationQuantities.facilities)) values[0]={min:0,max:0};
    generationQuantities.facilities.camp_single[0]={min:2,max:2};
    generationQuantities.facilities.fire_single[0]={min:1,max:1};
    generationQuantities.facilities.tower_single[0]={min:1,max:1};
    const map=generateMap(1,2,'config-edit',[]);
    assert.deepEqual(map.diagnostics.inventory.facilities.counts,{camp_single:2,fire_single:1,tower_single:1,camp_domino:0,camp_long:0,camp_el:0,picnic_domino:0,cabin_el:0,foodTruck_single:0,powerTower_single:0,pool_single:0});
    assert.equal(map.diagnostics.inventory.facilities.target,4);
    assert.equal(map.diagnostics.inventory.facilities.area,4);
  } finally {generationQuantities.facilities=previous.facilities;generationQuantities.terrain=previous.terrain;}
});
