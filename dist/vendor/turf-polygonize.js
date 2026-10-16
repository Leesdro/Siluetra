// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/helpers/dist/esm/index.js
var earthRadius = 63710088e-1;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  cm: earthRadius * 100,
  degrees: 360 / (2 * Math.PI),
  deg: 360 / (2 * Math.PI),
  feet: earthRadius * 3.28084,
  ft: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  in: earthRadius * 39.37,
  kilometers: earthRadius / 1e3,
  kilometres: earthRadius / 1e3,
  km: earthRadius / 1e3,
  meters: earthRadius,
  metres: earthRadius,
  m: earthRadius,
  miles: earthRadius / 1609.344,
  mi: earthRadius / 1609.344,
  millimeters: earthRadius * 1e3,
  millimetres: earthRadius * 1e3,
  mm: earthRadius * 1e3,
  nauticalmiles: earthRadius / 1852,
  nmi: earthRadius / 1852,
  radians: 1,
  rad: 1,
  yards: earthRadius * 1.0936,
  yd: earthRadius * 1.0936
};
function feature(geom, properties, options = {}) {
  const feat = { type: "Feature" };
  if (options.id === 0 || options.id) {
    feat.id = options.id;
  }
  if (options.bbox) {
    feat.bbox = options.bbox;
  }
  feat.properties = properties || {};
  feat.geometry = geom;
  return feat;
}
function point(coordinates, properties, options = {}) {
  if (!coordinates) {
    throw new Error("coordinates is required");
  }
  if (!Array.isArray(coordinates)) {
    throw new Error("coordinates must be an Array");
  }
  if (coordinates.length < 2) {
    throw new Error("coordinates must be at least 2 numbers long");
  }
  if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
    throw new Error("coordinates must contain numbers");
  }
  const geom = {
    type: "Point",
    coordinates
  };
  return feature(geom, properties, options);
}
function polygon(coordinates, properties, options = {}) {
  for (const ring of coordinates) {
    if (ring.length < 4) {
      throw new Error(
        "Each LinearRing of a Polygon must have 4 or more Positions."
      );
    }
    if (ring[ring.length - 1].length !== ring[0].length) {
      throw new Error("First and last Position are not equivalent.");
    }
    for (let j = 0; j < ring[ring.length - 1].length; j++) {
      if (ring[ring.length - 1][j] !== ring[0][j]) {
        throw new Error("First and last Position are not equivalent.");
      }
    }
  }
  const geom = {
    type: "Polygon",
    coordinates
  };
  return feature(geom, properties, options);
}
function lineString(coordinates, properties, options = {}) {
  if (coordinates.length < 2) {
    throw new Error("coordinates must be an array of two or more positions");
  }
  const geom = {
    type: "LineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function featureCollection(features, options = {}) {
  const fc = { type: "FeatureCollection" };
  if (options.id) {
    fc.id = options.id;
  }
  if (options.bbox) {
    fc.bbox = options.bbox;
  }
  fc.features = features;
  return fc;
}
function multiPoint(coordinates, properties, options = {}) {
  const geom = {
    type: "MultiPoint",
    coordinates
  };
  return feature(geom, properties, options);
}
function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/robust-predicates/esm/util.js
var epsilon = 11102230246251565e-32;
var splitter = 134217729;
var resulterrbound = (3 + 8 * epsilon) * epsilon;
function sum(elen, e, flen, f, h) {
  let Q, Qnew, hh, bvirt;
  let enow = e[0];
  let fnow = f[0];
  let eindex = 0;
  let findex = 0;
  if (fnow > enow === fnow > -enow) {
    Q = enow;
    enow = e[++eindex];
  } else {
    Q = fnow;
    fnow = f[++findex];
  }
  let hindex = 0;
  if (eindex < elen && findex < flen) {
    if (fnow > enow === fnow > -enow) {
      Qnew = enow + Q;
      hh = Q - (Qnew - enow);
      enow = e[++eindex];
    } else {
      Qnew = fnow + Q;
      hh = Q - (Qnew - fnow);
      fnow = f[++findex];
    }
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
    while (eindex < elen && findex < flen) {
      if (fnow > enow === fnow > -enow) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
      } else {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f[++findex];
      }
      Q = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
    }
  }
  while (eindex < elen) {
    Qnew = Q + enow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (enow - bvirt);
    enow = e[++eindex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  while (findex < flen) {
    Qnew = Q + fnow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (fnow - bvirt);
    fnow = f[++findex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  if (Q !== 0 || hindex === 0) {
    h[hindex++] = Q;
  }
  return hindex;
}
function estimate(elen, e) {
  let Q = e[0];
  for (let i = 1; i < elen; i++) Q += e[i];
  return Q;
}
function vec(n) {
  return new Float64Array(n);
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/robust-predicates/esm/orient2d.js
var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
  let acxtail, acytail, bcxtail, bcytail;
  let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u32;
  const acx = ax - cx;
  const bcx = bx - cx;
  const acy = ay - cy;
  const bcy = by - cy;
  s1 = acx * bcy;
  c = splitter * acx;
  ahi = c - (c - acx);
  alo = acx - ahi;
  c = splitter * bcy;
  bhi = c - (c - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcx;
  c = splitter * acy;
  ahi = c - (c - acy);
  alo = acy - ahi;
  c = splitter * bcx;
  bhi = c - (c - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  B[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  B[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  B[2] = _j - (u32 - bvirt) + (_i - bvirt);
  B[3] = u32;
  let det = estimate(4, B);
  let errbound = ccwerrboundB * detsum;
  if (det >= errbound || -det >= errbound) {
    return det;
  }
  bvirt = ax - acx;
  acxtail = ax - (acx + bvirt) + (bvirt - cx);
  bvirt = bx - bcx;
  bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
  bvirt = ay - acy;
  acytail = ay - (acy + bvirt) + (bvirt - cy);
  bvirt = by - bcy;
  bcytail = by - (bcy + bvirt) + (bvirt - cy);
  if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
    return det;
  }
  errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
  det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
  if (det >= errbound || -det >= errbound) return det;
  s1 = acxtail * bcy;
  c = splitter * acxtail;
  ahi = c - (c - acxtail);
  alo = acxtail - ahi;
  c = splitter * bcy;
  bhi = c - (c - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcx;
  c = splitter * acytail;
  ahi = c - (c - acytail);
  alo = acytail - ahi;
  c = splitter * bcx;
  bhi = c - (c - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const C1len = sum(4, B, 4, u, C1);
  s1 = acx * bcytail;
  c = splitter * acx;
  ahi = c - (c - acx);
  alo = acx - ahi;
  c = splitter * bcytail;
  bhi = c - (c - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcxtail;
  c = splitter * acy;
  ahi = c - (c - acy);
  alo = acy - ahi;
  c = splitter * bcxtail;
  bhi = c - (c - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const C2len = sum(C1len, C1, 4, u, C2);
  s1 = acxtail * bcytail;
  c = splitter * acxtail;
  ahi = c - (c - acxtail);
  alo = acxtail - ahi;
  c = splitter * bcytail;
  bhi = c - (c - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcxtail;
  c = splitter * acytail;
  ahi = c - (c - acytail);
  alo = acytail - ahi;
  c = splitter * bcxtail;
  bhi = c - (c - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const Dlen = sum(C2len, C2, 4, u, D);
  return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
  const detleft = (ay - cy) * (bx - cx);
  const detright = (ax - cx) * (by - cy);
  const det = detleft - detright;
  const detsum = Math.abs(detleft + detright);
  if (Math.abs(det) >= ccwerrboundA * detsum) return det;
  return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/robust-predicates/esm/orient3d.js
var o3derrboundA = (7 + 56 * epsilon) * epsilon;
var o3derrboundB = (3 + 28 * epsilon) * epsilon;
var o3derrboundC = (26 + 288 * epsilon) * epsilon * epsilon;
var bc = vec(4);
var ca = vec(4);
var ab = vec(4);
var at_b = vec(4);
var at_c = vec(4);
var bt_c = vec(4);
var bt_a = vec(4);
var ct_a = vec(4);
var ct_b = vec(4);
var bct = vec(8);
var cat = vec(8);
var abt = vec(8);
var u2 = vec(4);
var _8 = vec(8);
var _8b = vec(8);
var _16 = vec(16);
var _12 = vec(12);
var fin = vec(192);
var fin2 = vec(192);

// ../../../tmp/siluetra-polygonize-spike/node_modules/robust-predicates/esm/incircle.js
var iccerrboundA = (10 + 96 * epsilon) * epsilon;
var iccerrboundB = (4 + 48 * epsilon) * epsilon;
var iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon;
var bc2 = vec(4);
var ca2 = vec(4);
var ab2 = vec(4);
var aa = vec(4);
var bb = vec(4);
var cc = vec(4);
var u3 = vec(4);
var v = vec(4);
var axtbc = vec(8);
var aytbc = vec(8);
var bxtca = vec(8);
var bytca = vec(8);
var cxtab = vec(8);
var cytab = vec(8);
var abt2 = vec(8);
var bct2 = vec(8);
var cat2 = vec(8);
var abtt = vec(4);
var bctt = vec(4);
var catt = vec(4);
var _82 = vec(8);
var _162 = vec(16);
var _16b = vec(16);
var _16c = vec(16);
var _32 = vec(32);
var _32b = vec(32);
var _48 = vec(48);
var _64 = vec(64);
var fin3 = vec(1152);
var fin22 = vec(1152);

// ../../../tmp/siluetra-polygonize-spike/node_modules/robust-predicates/esm/insphere.js
var isperrboundA = (16 + 224 * epsilon) * epsilon;
var isperrboundB = (5 + 72 * epsilon) * epsilon;
var isperrboundC = (71 + 1408 * epsilon) * epsilon * epsilon;
var ab3 = vec(4);
var bc3 = vec(4);
var cd = vec(4);
var de = vec(4);
var ea = vec(4);
var ac = vec(4);
var bd = vec(4);
var ce = vec(4);
var da = vec(4);
var eb = vec(4);
var abc = vec(24);
var bcd = vec(24);
var cde = vec(24);
var dea = vec(24);
var eab = vec(24);
var abd = vec(24);
var bce = vec(24);
var cda = vec(24);
var deb = vec(24);
var eac = vec(24);
var adet = vec(1152);
var bdet = vec(1152);
var cdet = vec(1152);
var ddet = vec(1152);
var edet = vec(1152);
var abdet = vec(2304);
var cddet = vec(2304);
var cdedet = vec(3456);
var deter = vec(5760);
var _83 = vec(8);
var _8b2 = vec(8);
var _8c = vec(8);
var _163 = vec(16);
var _24 = vec(24);
var _482 = vec(48);
var _48b = vec(48);
var _96 = vec(96);
var _192 = vec(192);
var _384x = vec(384);
var _384y = vec(384);
var _384z = vec(384);
var _768 = vec(768);
var xdet = vec(96);
var ydet = vec(96);
var zdet = vec(96);
var fin4 = vec(1152);

// ../../../tmp/siluetra-polygonize-spike/node_modules/point-in-polygon-hao/dist/esm/index.js
function pointInPolygon(p, polygon2) {
  var i;
  var ii;
  var k = 0;
  var f;
  var u1;
  var v1;
  var u22;
  var v2;
  var currentP;
  var nextP;
  var x = p[0];
  var y = p[1];
  var numContours = polygon2.length;
  for (i = 0; i < numContours; i++) {
    ii = 0;
    var contour = polygon2[i];
    var contourLen = contour.length - 1;
    currentP = contour[0];
    if (currentP[0] !== contour[contourLen][0] && currentP[1] !== contour[contourLen][1]) {
      throw new Error("First and last coordinates in a ring must be the same");
    }
    u1 = currentP[0] - x;
    v1 = currentP[1] - y;
    for (ii; ii < contourLen; ii++) {
      nextP = contour[ii + 1];
      u22 = nextP[0] - x;
      v2 = nextP[1] - y;
      if (v1 === 0 && v2 === 0) {
        if (u22 <= 0 && u1 >= 0 || u1 <= 0 && u22 >= 0) {
          return 0;
        }
      } else if (v2 >= 0 && v1 <= 0 || v2 <= 0 && v1 >= 0) {
        f = orient2d(u1, u22, v1, v2, 0, 0);
        if (f === 0) {
          return 0;
        }
        if (f > 0 && v2 > 0 && v1 <= 0 || f < 0 && v2 <= 0 && v1 > 0) {
          k++;
        }
      }
      currentP = nextP;
      v1 = v2;
      u1 = u22;
    }
  }
  if (k % 2 === 0) {
    return false;
  }
  return true;
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/invariant/dist/esm/index.js
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }
  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return [...coord.geometry.coordinates];
    }
    if (coord.type === "Point") {
      return [...coord.coordinates];
    }
  }
  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return [...coord];
  }
  throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
function featureOf(feature2, type, name) {
  if (!feature2) {
    throw new Error("No feature passed");
  }
  if (!name) {
    throw new Error(".featureOf() requires a name");
  }
  if (!feature2 || feature2.type !== "Feature" || !feature2.geometry) {
    throw new Error(
      "Invalid input to " + name + ", Feature with geometry required"
    );
  }
  if (!feature2.geometry || feature2.geometry.type !== type) {
    throw new Error(
      "Invalid input to " + name + ": must be a " + type + ", given " + feature2.geometry.type
    );
  }
}
function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }
  return geojson;
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/boolean-point-in-polygon/dist/esm/index.js
function booleanPointInPolygon(point2, polygon2, options = {}) {
  if (!point2) {
    throw new Error("point is required");
  }
  if (!polygon2) {
    throw new Error("polygon is required");
  }
  const pt = getCoord(point2);
  const geom = getGeom(polygon2);
  const type = geom.type;
  const bbox2 = polygon2.bbox;
  let polys = geom.coordinates;
  if (bbox2 && inBBox(pt, bbox2) === false) {
    return false;
  }
  if (type === "Polygon") {
    polys = [polys];
  }
  for (var i = 0; i < polys.length; ++i) {
    const polyResult = pointInPolygon(pt, polys[i]);
    if (polyResult === 0 && !options.ignoreBoundary) return true;
    else if (polyResult) return true;
  }
  return false;
}
function inBBox(pt, bbox2) {
  return bbox2[0] <= pt[0] && bbox2[1] <= pt[1] && bbox2[2] >= pt[0] && bbox2[3] >= pt[1];
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/meta/dist/esm/index.js
function coordEach(geojson, callback, excludeWrapCoord) {
  if (geojson === null) return;
  var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
    geometryMaybeCollection = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[featureIndex].geometry
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.geometry
    ) : geojson;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
      var multiFeatureIndex = 0;
      var geometryIndex = 0;
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
      if (geometry === null) continue;
      coords = geometry.coordinates;
      var geomType = geometry.type;
      wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
      switch (geomType) {
        case null:
          break;
        case "Point":
          if (
            // @ts-expect-error: Known type conflict
            callback(
              coords,
              coordIndex,
              featureIndex,
              multiFeatureIndex,
              geometryIndex
            ) === false
          )
            return false;
          coordIndex++;
          multiFeatureIndex++;
          break;
        case "LineString":
        case "MultiPoint":
          for (j = 0; j < coords.length; j++) {
            if (
              // @ts-expect-error: Known type conflict
              callback(
                coords[j],
                coordIndex,
                featureIndex,
                multiFeatureIndex,
                geometryIndex
              ) === false
            )
              return false;
            coordIndex++;
            if (geomType === "MultiPoint") multiFeatureIndex++;
          }
          if (geomType === "LineString") multiFeatureIndex++;
          break;
        case "Polygon":
        case "MultiLineString":
          for (j = 0; j < coords.length; j++) {
            for (k = 0; k < coords[j].length - wrapShrink; k++) {
              if (
                // @ts-expect-error: Known type conflict
                callback(
                  coords[j][k],
                  coordIndex,
                  featureIndex,
                  multiFeatureIndex,
                  geometryIndex
                ) === false
              )
                return false;
              coordIndex++;
            }
            if (geomType === "MultiLineString") multiFeatureIndex++;
            if (geomType === "Polygon") geometryIndex++;
          }
          if (geomType === "Polygon") multiFeatureIndex++;
          break;
        case "MultiPolygon":
          for (j = 0; j < coords.length; j++) {
            geometryIndex = 0;
            for (k = 0; k < coords[j].length; k++) {
              for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                if (
                  // @ts-expect-error: Known type conflict
                  callback(
                    coords[j][k][l],
                    coordIndex,
                    featureIndex,
                    multiFeatureIndex,
                    geometryIndex
                  ) === false
                )
                  return false;
                coordIndex++;
              }
              geometryIndex++;
            }
            multiFeatureIndex++;
          }
          break;
        case "GeometryCollection":
          for (j = 0; j < geometry.geometries.length; j++)
            if (
              // @ts-expect-error: Known type conflict
              coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false
            )
              return false;
          break;
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
  }
}
function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
  var previousValue = initialValue;
  coordEach(
    geojson,
    function(currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
      if (coordIndex === 0 && initialValue === void 0)
        previousValue = currentCoord;
      else
        previousValue = callback(
          // @ts-expect-error: Known type conflict
          previousValue,
          currentCoord,
          coordIndex,
          featureIndex,
          multiFeatureIndex,
          geometryIndex
        );
    },
    excludeWrapCoord
  );
  return previousValue;
}
function geomEach(geojson, callback) {
  var i, j, g, geometry, stopG, geometryMaybeCollection, isGeometryCollection, featureProperties, featureBBox, featureId, featureIndex = 0, isFeatureCollection = geojson.type === "FeatureCollection", isFeature = geojson.type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (i = 0; i < stop; i++) {
    geometryMaybeCollection = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].geometry
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.geometry
    ) : geojson;
    featureProperties = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].properties
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.properties
    ) : {};
    featureBBox = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].bbox
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.bbox
    ) : void 0;
    featureId = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].id
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.id
    ) : void 0;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (g = 0; g < stopG; g++) {
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
      if (geometry === null) {
        if (
          // @ts-expect-error: Known type conflict
          callback(
            // @ts-expect-error: Known type conflict
            null,
            featureIndex,
            featureProperties,
            featureBBox,
            featureId
          ) === false
        )
          return false;
        continue;
      }
      switch (geometry.type) {
        case "Point":
        case "LineString":
        case "MultiPoint":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon": {
          if (
            // @ts-expect-error: Known type conflict
            callback(
              geometry,
              featureIndex,
              featureProperties,
              featureBBox,
              featureId
            ) === false
          )
            return false;
          break;
        }
        case "GeometryCollection": {
          for (j = 0; j < geometry.geometries.length; j++) {
            if (
              // @ts-expect-error: Known type conflict
              callback(
                geometry.geometries[j],
                featureIndex,
                featureProperties,
                featureBBox,
                featureId
              ) === false
            )
              return false;
          }
          break;
        }
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
    featureIndex++;
  }
}
function flattenEach(geojson, callback) {
  geomEach(geojson, function(geometry, featureIndex, properties, bbox2, id) {
    var type = geometry === null ? null : geometry.type;
    switch (type) {
      case null:
      case "Point":
      case "LineString":
      case "Polygon":
        if (
          // @ts-expect-error: Known type conflict
          callback(
            feature(geometry, properties, { bbox: bbox2, id }),
            featureIndex,
            0
          ) === false
        )
          return false;
        return;
    }
    var geomType;
    switch (type) {
      case "MultiPoint":
        geomType = "Point";
        break;
      case "MultiLineString":
        geomType = "LineString";
        break;
      case "MultiPolygon":
        geomType = "Polygon";
        break;
    }
    for (
      var multiFeatureIndex = 0;
      // @ts-expect-error: Known type conflict
      multiFeatureIndex < geometry.coordinates.length;
      multiFeatureIndex++
    ) {
      var coordinate = geometry.coordinates[multiFeatureIndex];
      var geom = {
        type: geomType,
        coordinates: coordinate
      };
      if (
        // @ts-expect-error: Known type conflict
        callback(feature(geom, properties), featureIndex, multiFeatureIndex) === false
      )
        return false;
    }
  });
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/bbox/dist/esm/index.js
function bbox(geojson, options = {}) {
  if (geojson.bbox != null && true !== options.recompute) {
    return geojson.bbox;
  }
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  coordEach(geojson, (coord) => {
    if (result[0] > coord[0]) {
      result[0] = coord[0];
    }
    if (result[1] > coord[1]) {
      result[1] = coord[1];
    }
    if (result[2] < coord[0]) {
      result[2] = coord[0];
    }
    if (result[3] < coord[1]) {
      result[3] = coord[1];
    }
  });
  return result;
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/bbox-polygon/dist/esm/index.js
function bboxPolygon(bbox2, options = {}) {
  const west = Number(bbox2[0]);
  const south = Number(bbox2[1]);
  const east = Number(bbox2[2]);
  const north = Number(bbox2[3]);
  if (bbox2.length === 6) {
    throw new Error(
      "@turf/bbox-polygon does not support BBox with 6 positions"
    );
  }
  const lowLeft = [west, south];
  const topLeft = [west, north];
  const topRight = [east, north];
  const lowRight = [east, south];
  return polygon(
    [[lowLeft, lowRight, topRight, topLeft, lowLeft]],
    options.properties,
    { bbox: bbox2, id: options.id }
  );
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/envelope/dist/esm/index.js
function envelope(geojson) {
  return bboxPolygon(bbox(geojson));
}

// ../../../tmp/siluetra-polygonize-spike/node_modules/@turf/polygonize/dist/esm/index.js
function mathSign(x) {
  return (x > 0) - (x < 0) || +x;
}
function orientationIndex(p1, p2, q) {
  const dx1 = p2[0] - p1[0], dy1 = p2[1] - p1[1], dx2 = q[0] - p2[0], dy2 = q[1] - p2[1];
  return mathSign(dx1 * dy2 - dx2 * dy1);
}
function envelopeIsEqual(env1, env2) {
  const envX1 = env1.geometry.coordinates[0].map((c) => c[0]), envY1 = env1.geometry.coordinates[0].map((c) => c[1]), envX2 = env2.geometry.coordinates[0].map((c) => c[0]), envY2 = env2.geometry.coordinates[0].map((c) => c[1]);
  return Math.max.apply(null, envX1) === Math.max.apply(null, envX2) && Math.max.apply(null, envY1) === Math.max.apply(null, envY2) && Math.min.apply(null, envX1) === Math.min.apply(null, envX2) && Math.min.apply(null, envY1) === Math.min.apply(null, envY2);
}
function envelopeContains(self, env) {
  return env.geometry.coordinates[0].every(
    (c) => booleanPointInPolygon(point(c), self)
  );
}
function coordinatesEqual(coord1, coord2) {
  return coord1[0] === coord2[0] && coord1[1] === coord2[1];
}
var Node = class {
  constructor(id, coordinates) {
    this.id = id;
    this.coordinates = coordinates;
    this.innerEdges = [];
    this.outerEdges = [];
    this.outerEdgesSorted = false;
  }
  removeInnerEdge(edge) {
    this.innerEdges = this.innerEdges.filter((e) => e.from.id !== edge.from.id);
  }
  removeOuterEdge(edge) {
    this.outerEdges = this.outerEdges.filter((e) => e.to.id !== edge.to.id);
  }
  /**
   * Outer edges are stored CCW order.
   *
   * @memberof Node
   * @param {Edge} edge - Edge to add as an outerEdge.
   */
  addOuterEdge(edge) {
    this.outerEdges.push(edge);
    this.outerEdgesSorted = false;
  }
  /**
   * Sorts outer edges in CCW way.
   *
   * @memberof Node
   * @private
   */
  sortOuterEdges() {
    if (!this.outerEdgesSorted) {
      this.outerEdges.sort((a, b) => {
        const aNode = a.to, bNode = b.to;
        if (aNode.coordinates[0] - this.coordinates[0] >= 0 && bNode.coordinates[0] - this.coordinates[0] < 0)
          return 1;
        if (aNode.coordinates[0] - this.coordinates[0] < 0 && bNode.coordinates[0] - this.coordinates[0] >= 0)
          return -1;
        if (aNode.coordinates[0] - this.coordinates[0] === 0 && bNode.coordinates[0] - this.coordinates[0] === 0) {
          if (aNode.coordinates[1] - this.coordinates[1] >= 0 || bNode.coordinates[1] - this.coordinates[1] >= 0)
            return aNode.coordinates[1] - bNode.coordinates[1];
          return bNode.coordinates[1] - aNode.coordinates[1];
        }
        const det = orientationIndex(
          this.coordinates,
          aNode.coordinates,
          bNode.coordinates
        );
        if (det < 0) return 1;
        if (det > 0) return -1;
        const d1 = Math.pow(aNode.coordinates[0] - this.coordinates[0], 2) + Math.pow(aNode.coordinates[1] - this.coordinates[1], 2), d2 = Math.pow(bNode.coordinates[0] - this.coordinates[0], 2) + Math.pow(bNode.coordinates[1] - this.coordinates[1], 2);
        return d1 - d2;
      });
      this.outerEdgesSorted = true;
    }
  }
  /**
   * Retrieves outer edges.
   *
   * They are sorted if they aren't in the CCW order.
   *
   * @memberof Node
   * @returns {Edge[]} - List of outer edges sorted in a CCW order.
   */
  getOuterEdges() {
    this.sortOuterEdges();
    return this.outerEdges;
  }
  getOuterEdge(i) {
    this.sortOuterEdges();
    return this.outerEdges[i];
  }
  addInnerEdge(edge) {
    this.innerEdges.push(edge);
  }
};
var Edge = class _Edge {
  /**
   * Creates or get the symetric Edge.
   *
   * @returns {Edge} - Symetric Edge.
   */
  getSymetric() {
    if (!this.symetric) {
      this.symetric = new _Edge(this.to, this.from);
      this.symetric.symetric = this;
    }
    return this.symetric;
  }
  /**
   * @param {Node} from - start node of the Edge
   * @param {Node} to - end node of the edge
   */
  constructor(from, to) {
    this.from = from;
    this.to = to;
    this.next = void 0;
    this.label = void 0;
    this.symetric = void 0;
    this.ring = void 0;
    this.from.addOuterEdge(this);
    this.to.addInnerEdge(this);
  }
  /**
   * Removes edge from from and to nodes.
   */
  deleteEdge() {
    this.from.removeOuterEdge(this);
    this.to.removeInnerEdge(this);
  }
  /**
   * Compares Edge equallity.
   *
   * An edge is equal to another, if the from and to nodes are the same.
   *
   * @param {Edge} edge - Another Edge
   * @returns {boolean} - True if Edges are equal, False otherwise
   */
  isEqual(edge) {
    return this.from.id === edge.from.id && this.to.id === edge.to.id;
  }
  toString() {
    return `Edge { ${this.from.id} -> ${this.to.id} }`;
  }
  /**
   * Returns a LineString representation of the Edge
   *
   * @returns {Feature<LineString>} - LineString representation of the Edge
   */
  toLineString() {
    return lineString([this.from.coordinates, this.to.coordinates]);
  }
  /**
   * Comparator of two edges.
   *
   * Implementation of geos::planargraph::DirectedEdge::compareTo.
   *
   * @param {Edge} edge - Another edge to compare with this one
   * @returns {number} -1 if this Edge has a greater angle with the positive x-axis than b,
   *          0 if the Edges are colinear,
   *          1 otherwise
   */
  compareTo(edge) {
    return orientationIndex(
      edge.from.coordinates,
      edge.to.coordinates,
      this.to.coordinates
    );
  }
};
var EdgeRing = class {
  constructor() {
    this.edges = [];
    this.polygon = void 0;
    this.envelope = void 0;
  }
  /**
   * Add an edge to the ring, inserting it in the last position.
   *
   * @memberof EdgeRing
   * @param {Edge} edge - Edge to be inserted
   */
  push(edge) {
    this.edges.push(edge);
    this.polygon = this.envelope = void 0;
  }
  /**
   * Get Edge.
   *
   * @memberof EdgeRing
   * @param {number} i - Index
   * @returns {Edge} - Edge in the i position
   */
  get(i) {
    return this.edges[i];
  }
  /**
   * Getter of length property.
   *
   * @memberof EdgeRing
   * @returns {number} - Length of the edge ring.
   */
  get length() {
    return this.edges.length;
  }
  /**
   * Similar to Array.prototype.forEach for the list of Edges in the EdgeRing.
   *
   * @memberof EdgeRing
   * @param {Function} f - The same function to be passed to Array.prototype.forEach
   */
  forEach(f) {
    this.edges.forEach(f);
  }
  /**
   * Similar to Array.prototype.map for the list of Edges in the EdgeRing.
   *
   * @memberof EdgeRing
   * @param {Function} f - The same function to be passed to Array.prototype.map
   * @returns {Array} - The mapped values in the function
   */
  map(f) {
    return this.edges.map(f);
  }
  /**
   * Similar to Array.prototype.some for the list of Edges in the EdgeRing.
   *
   * @memberof EdgeRing
   * @param {Function} f - The same function to be passed to Array.prototype.some
   * @returns {boolean} - True if an Edge check the condition
   */
  some(f) {
    return this.edges.some(f);
  }
  /**
   * Check if the ring is valid in geomtry terms.
   *
   * A ring must have either 0 or 4 or more points. The first and the last must be
   * equal (in 2D)
   * geos::geom::LinearRing::validateConstruction
   *
   * @memberof EdgeRing
   * @returns {boolean} - Validity of the EdgeRing
   */
  isValid() {
    return true;
  }
  /**
   * Tests whether this ring is a hole.
   *
   * A ring is a hole if it is oriented counter-clockwise.
   * Similar implementation of geos::algorithm::CGAlgorithms::isCCW
   *
   * @memberof EdgeRing
   * @returns {boolean} - true: if it is a hole
   */
  isHole() {
    const hiIndex = this.edges.reduce((high, edge, i) => {
      if (edge.from.coordinates[1] > this.edges[high].from.coordinates[1])
        high = i;
      return high;
    }, 0), iPrev = (hiIndex === 0 ? this.length : hiIndex) - 1, iNext = (hiIndex + 1) % this.length, disc = orientationIndex(
      this.edges[iPrev].from.coordinates,
      this.edges[hiIndex].from.coordinates,
      this.edges[iNext].from.coordinates
    );
    if (disc === 0)
      return this.edges[iPrev].from.coordinates[0] > this.edges[iNext].from.coordinates[0];
    return disc > 0;
  }
  /**
   * Creates a MultiPoint representing the EdgeRing (discarts edges directions).
   *
   * @memberof EdgeRing
   * @returns {Feature<MultiPoint>} - Multipoint representation of the EdgeRing
   */
  toMultiPoint() {
    return multiPoint(this.edges.map((edge) => edge.from.coordinates));
  }
  /**
   * Creates a Polygon representing the EdgeRing.
   *
   * @memberof EdgeRing
   * @returns {Feature<Polygon>} - Polygon representation of the Edge Ring
   */
  toPolygon() {
    if (this.polygon) return this.polygon;
    const coordinates = this.edges.map((edge) => edge.from.coordinates);
    coordinates.push(this.edges[0].from.coordinates);
    return this.polygon = polygon([coordinates]);
  }
  /**
   * Calculates the envelope of the EdgeRing.
   *
   * @memberof EdgeRing
   * @returns {Feature<Polygon>} - envelope
   */
  getEnvelope() {
    if (this.envelope) return this.envelope;
    return this.envelope = envelope(this.toPolygon());
  }
  /**
   * `geos::operation::polygonize::EdgeRing::findEdgeRingContaining`
   *
   * @param {EdgeRing} testEdgeRing - EdgeRing to look in the list
   * @param {EdgeRing[]} shellList - List of EdgeRing in which to search
   *
   * @returns {EdgeRing} - EdgeRing which contains the testEdgeRing
   */
  static findEdgeRingContaining(testEdgeRing, shellList) {
    const testEnvelope = testEdgeRing.getEnvelope();
    let minEnvelope, minShell;
    shellList.forEach((shell) => {
      const tryEnvelope = shell.getEnvelope();
      if (minShell) minEnvelope = minShell.getEnvelope();
      if (envelopeIsEqual(tryEnvelope, testEnvelope)) return;
      if (envelopeContains(tryEnvelope, testEnvelope)) {
        const testEdgeRingCoordinates = testEdgeRing.map(
          (edge) => edge.from.coordinates
        );
        let testPoint;
        for (const pt of testEdgeRingCoordinates) {
          if (!shell.some((edge) => coordinatesEqual(pt, edge.from.coordinates))) {
            testPoint = pt;
          }
        }
        if (testPoint && shell.inside(point(testPoint))) {
          if (!minShell || envelopeContains(minEnvelope, tryEnvelope))
            minShell = shell;
        }
      }
    });
    return minShell;
  }
  /**
   * Checks if the point is inside the edgeRing
   *
   * @param {Feature<Point>} pt - Point to check if it is inside the edgeRing
   * @returns {boolean} - True if it is inside, False otherwise
   */
  inside(pt) {
    return booleanPointInPolygon(pt, this.toPolygon());
  }
};
function validateGeoJson(geoJson) {
  if (!geoJson) throw new Error("No geojson passed");
  if (geoJson.type !== "FeatureCollection" && geoJson.type !== "GeometryCollection" && geoJson.type !== "MultiLineString" && geoJson.type !== "LineString" && geoJson.type !== "Feature")
    throw new Error(
      `Invalid input type '${geoJson.type}'. Geojson must be FeatureCollection, GeometryCollection, LineString, MultiLineString or Feature`
    );
}
var Graph = class _Graph {
  constructor() {
    this.nodes = /* @__PURE__ */ new Map();
    this.nodeId = 0;
    this.edges = /* @__PURE__ */ new Map();
  }
  // Map<from, Map<to, Edge>>
  /**
   * Creates a graph from a GeoJSON.
   *
   * @param {FeatureCollection<LineString>} geoJson - it must comply with the restrictions detailed in the index
   * @returns {Graph} - The newly created graph
   * @throws {Error} if geoJson is invalid.
   */
  static fromGeoJson(geoJson) {
    validateGeoJson(geoJson);
    const graph = new _Graph();
    flattenEach(geoJson, (feature2) => {
      featureOf(feature2, "LineString", "Graph::fromGeoJson");
      coordReduce(feature2, (prev, cur) => {
        if (prev) {
          const start = graph.getNode(prev), end = graph.getNode(cur);
          graph.addEdge(start, end);
        }
        return cur;
      });
    });
    return graph;
  }
  /**
   * Creates or get a Node.
   *
   * @param {number[]} coordinates - Coordinates of the node
   * @returns {Node} - The created or stored node
   */
  getNode(coordinates) {
    var _a;
    let node = (_a = this.nodes.get(coordinates[0])) == null ? void 0 : _a.get(coordinates[1]);
    if (node == null) {
      const node2 = new Node(this.nodeId++, coordinates);
      let byLat = this.nodes.get(coordinates[0]);
      if (byLat == null) {
        byLat = /* @__PURE__ */ new Map();
        this.nodes.set(coordinates[0], byLat);
      }
      byLat.set(coordinates[1], node2);
      return node2;
    }
    return node;
  }
  /**
   * Adds an Edge and its symetricall.
   *
   * Edges are added symetrically, i.e.: we also add its symetric
   *
   * @param {Node} from - Node which starts the Edge
   * @param {Node} to - Node which ends the Edge
   */
  addEdge(from, to) {
    var _a;
    if ((_a = this.edges.get(from)) == null ? void 0 : _a.has(to)) {
      return;
    }
    const edge = new Edge(from, to), symetricEdge = edge.getSymetric();
    let toMap = this.edges.get(from);
    if (toMap == null) {
      toMap = /* @__PURE__ */ new Map();
      this.edges.set(from, toMap);
    }
    toMap.set(to, edge);
    let symToMap = this.edges.get(to);
    if (symToMap == null) {
      symToMap = /* @__PURE__ */ new Map();
      this.edges.set(to, symToMap);
    }
    symToMap.set(from, symetricEdge);
  }
  /**
   * Removes Dangle Nodes (nodes with grade 1).
   */
  deleteDangles() {
    this._forEachNode((node) => this._removeIfDangle(node));
  }
  /**
   * Check if node is dangle, if so, remove it.
   *
   * It calls itself recursively, removing a dangling node might cause another dangling node
   *
   * @param {Node} node - Node to check if it's a dangle
   */
  _removeIfDangle(node) {
    if (node.innerEdges.length <= 1) {
      const outerNodes = node.getOuterEdges().map((e) => e.to);
      this.removeNode(node);
      outerNodes.forEach((n) => this._removeIfDangle(n));
    }
  }
  /**
   * Delete cut-edges (bridge edges).
   *
   * The graph will be traversed, all the edges will be labeled according the ring
   * in which they are. (The label is a number incremented by 1). Edges with the same
   * label are cut-edges.
   */
  deleteCutEdges() {
    this._computeNextCWEdges();
    this._findLabeledEdgeRings();
    this._forEachEdge((edge) => {
      if (edge.label === edge.symetric.label) {
        this.removeEdge(edge.symetric);
        this.removeEdge(edge);
      }
    });
  }
  /**
   * Set the `next` property of each Edge.
   *
   * The graph will be transversed in a CW form, so, we set the next of the symetrical edge as the previous one.
   * OuterEdges are sorted CCW.
   *
   * @param {Node} [node] - If no node is passed, the function calls itself for every node in the Graph
   */
  _computeNextCWEdges(node) {
    if (node == null) {
      this._forEachNode((node2) => this._computeNextCWEdges(node2));
    } else {
      node.getOuterEdges().forEach((edge, i) => {
        node.getOuterEdge(
          (i === 0 ? node.getOuterEdges().length : i) - 1
        ).symetric.next = edge;
      });
    }
  }
  /**
   * Computes the next edge pointers going CCW around the given node, for the given edgering label.
   *
   * This algorithm has the effect of converting maximal edgerings into minimal edgerings
   *
   * XXX: method literally transcribed from `geos::operation::polygonize::PolygonizeGraph::computeNextCCWEdges`,
   * could be written in a more javascript way.
   *
   * @param {Node} node - Node
   * @param {number} label - Ring's label
   */
  _computeNextCCWEdges(node, label) {
    const edges = node.getOuterEdges();
    let firstOutDE, prevInDE;
    for (let i = edges.length - 1; i >= 0; --i) {
      let de2 = edges[i], sym = de2.symetric, outDE, inDE;
      if (de2.label === label) outDE = de2;
      if (sym.label === label) inDE = sym;
      if (!outDE || !inDE)
        continue;
      if (inDE) prevInDE = inDE;
      if (outDE) {
        if (prevInDE) {
          prevInDE.next = outDE;
          prevInDE = void 0;
        }
        if (!firstOutDE) firstOutDE = outDE;
      }
    }
    if (prevInDE) prevInDE.next = firstOutDE;
  }
  /**
   * Finds rings and labels edges according to which rings are.
   *
   * The label is a number which is increased for each ring.
   *
   * @returns {Edge[]} edges that start rings
   */
  _findLabeledEdgeRings() {
    const edgeRingStarts = [];
    let label = 0;
    this._forEachEdge((edge) => {
      if (edge.label >= 0) return;
      edgeRingStarts.push(edge);
      let e = edge;
      do {
        e.label = label;
        e = e.next;
      } while (!edge.isEqual(e));
      label++;
    });
    return edgeRingStarts;
  }
  /**
   * Computes the EdgeRings formed by the edges in this graph.
   *
   * @returns {EdgeRing[]} - A list of all the EdgeRings in the graph.
   */
  getEdgeRings() {
    this._computeNextCWEdges();
    this._forEachEdge((edge) => {
      edge.label = void 0;
    });
    this._findLabeledEdgeRings().forEach((edge) => {
      this._findIntersectionNodes(edge).forEach((node) => {
        this._computeNextCCWEdges(node, edge.label);
      });
    });
    const edgeRingList = [];
    this._forEachEdge((edge) => {
      if (edge.ring) return;
      edgeRingList.push(this._findEdgeRing(edge));
    });
    return edgeRingList;
  }
  /**
   * Find all nodes in a Maxima EdgeRing which are self-intersection nodes.
   *
   * @param {Node} startEdge - Start Edge of the Ring
   * @returns {Node[]} - intersection nodes
   */
  _findIntersectionNodes(startEdge) {
    const intersectionNodes = [];
    let edge = startEdge;
    do {
      let degree = 0;
      edge.from.getOuterEdges().forEach((e) => {
        if (e.label === startEdge.label) ++degree;
      });
      if (degree > 1) intersectionNodes.push(edge.from);
      edge = edge.next;
    } while (!startEdge.isEqual(edge));
    return intersectionNodes;
  }
  /**
   * Get the edge-ring which starts from the provided Edge.
   *
   * @param {Edge} startEdge - starting edge of the edge ring
   * @returns {EdgeRing} - EdgeRing which start Edge is the provided one.
   */
  _findEdgeRing(startEdge) {
    let edge = startEdge;
    const edgeRing = new EdgeRing();
    do {
      edgeRing.push(edge);
      edge.ring = edgeRing;
      edge = edge.next;
    } while (!startEdge.isEqual(edge));
    return edgeRing;
  }
  /**
   * Removes a node from the Graph.
   *
   * It also removes edges asociated to that node
   * @param {Node} node - Node to be removed
   */
  removeNode(node) {
    var _a;
    node.getOuterEdges().forEach((edge) => this.removeEdge(edge));
    node.innerEdges.forEach((edge) => this.removeEdge(edge));
    (_a = this.nodes.get(node.coordinates[0])) == null ? void 0 : _a.delete(node.coordinates[1]);
  }
  /**
   * Remove edge from the graph and deletes the edge.
   *
   * @param {Edge} edge - Edge to be removed
   */
  removeEdge(edge) {
    var _a;
    (_a = this.edges.get(edge.from)) == null ? void 0 : _a.delete(edge.to);
    edge.deleteEdge();
  }
  _forEachNode(fn) {
    for (const latMap of this.nodes.values()) {
      for (const node of latMap.values()) {
        fn(node);
      }
    }
  }
  _forEachEdge(fn) {
    for (const toMap of this.edges.values()) {
      for (const edge of toMap.values()) {
        fn(edge);
      }
    }
  }
};
function polygonize(geoJson) {
  const graph = Graph.fromGeoJson(geoJson);
  graph.deleteDangles();
  graph.deleteCutEdges();
  const holes = [], shells = [];
  graph.getEdgeRings().filter((edgeRing) => edgeRing.isValid()).forEach((edgeRing) => {
    if (edgeRing.isHole()) holes.push(edgeRing);
    else shells.push(edgeRing);
  });
  holes.forEach((hole) => {
    if (EdgeRing.findEdgeRingContaining(hole, shells)) shells.push(hole);
  });
  return featureCollection(shells.map((shell) => shell.toPolygon()));
}
var index_default = polygonize;
export {
  index_default as default,
  polygonize
};
