import test from 'node:test';
import assert from 'node:assert/strict';
import {curveIntersections} from '../dist/curve-engine.js';
test('curve intersections use the supported overlap API and return native parameters',()=>{
 const a={a:{x:0,y:0,out:{x:0,y:10}},b:{x:10,y:0,in:{x:10,y:10}}};
 const b={a:{x:5,y:-1},b:{x:5,y:10}};
 const hits=curveIntersections(a,b);
 assert.equal(hits.length,1);
 assert.ok(Math.abs(hits[0].t-.5)<1e-7);
 assert.ok(Math.abs(hits[0].point.x-5)<1e-7);
 assert.ok(Math.abs(hits[0].point.y-7.5)<1e-7);
});
test('overlapping curve intervals do not become isolated crossings',()=>{
 const a={a:{x:0,y:0},b:{x:10,y:0}};
 assert.deepEqual(curveIntersections(a,a),[]);
});
