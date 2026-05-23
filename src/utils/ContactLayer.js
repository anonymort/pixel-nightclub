const EPSILON = 1e-6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function length2(x, z) {
  return Math.sqrt(x * x + z * z);
}

function normalize(x, z, fallbackX = 1, fallbackZ = 0) {
  const length = length2(x, z);
  if (length < EPSILON) return { x: fallbackX, z: fallbackZ };
  return { x: x / length, z: z / length };
}

function getColliderWeight(collider) {
  if (!Number.isFinite(collider.contactWeight)) return Infinity;
  return Math.max(0.001, collider.contactWeight ?? 1);
}

function getAabbBounds(collider, radius = 0) {
  return {
    minX: collider.position.x - collider.halfExtents.x - radius,
    maxX: collider.position.x + collider.halfExtents.x + radius,
    minZ: collider.position.z - collider.halfExtents.z - radius,
    maxZ: collider.position.z + collider.halfExtents.z + radius,
  };
}

function sweepPointAabb(start, delta, bounds) {
  let entryTime = 0;
  let exitTime = 1;
  let normal = { x: 0, z: 0 };

  const axes = [
    { key: 'x', min: bounds.minX, max: bounds.maxX, start: start.x, delta: delta.x },
    { key: 'z', min: bounds.minZ, max: bounds.maxZ, start: start.z, delta: delta.z },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.delta) < EPSILON) {
      if (axis.start < axis.min || axis.start > axis.max) return null;
      continue;
    }

    const inv = 1 / axis.delta;
    let near = (axis.min - axis.start) * inv;
    let far = (axis.max - axis.start) * inv;
    let axisNormal = axis.key === 'x' ? { x: -Math.sign(axis.delta), z: 0 } : { x: 0, z: -Math.sign(axis.delta) };

    if (near > far) {
      [near, far] = [far, near];
      axisNormal = axis.key === 'x' ? { x: Math.sign(axis.delta), z: 0 } : { x: 0, z: Math.sign(axis.delta) };
    }

    if (near > entryTime) {
      entryTime = near;
      normal = axisNormal;
    }
    exitTime = Math.min(exitTime, far);

    if (entryTime > exitTime) return null;
  }

  if (entryTime < 0 || entryTime > 1) return null;
  if (Math.abs(normal.x) < EPSILON && Math.abs(normal.z) < EPSILON) return null;
  return { time: entryTime, normal };
}

function resolveCircleAabb(position, radius, collider) {
  const bounds = getAabbBounds(collider);
  const nearestX = clamp(position.x, bounds.minX, bounds.maxX);
  const nearestZ = clamp(position.z, bounds.minZ, bounds.maxZ);
  let dx = position.x - nearestX;
  let dz = position.z - nearestZ;
  let distance = length2(dx, dz);

  if (distance >= radius) return null;

  if (distance < EPSILON) {
    const distances = [
      { amount: Math.abs(position.x - bounds.minX), normal: { x: -1, z: 0 } },
      { amount: Math.abs(bounds.maxX - position.x), normal: { x: 1, z: 0 } },
      { amount: Math.abs(position.z - bounds.minZ), normal: { x: 0, z: -1 } },
      { amount: Math.abs(bounds.maxZ - position.z), normal: { x: 0, z: 1 } },
    ].sort((a, b) => a.amount - b.amount);
    dx = distances[0].normal.x;
    dz = distances[0].normal.z;
    distance = 0;
  }

  const normal = normalize(dx, dz);
  const penetration = radius - distance;
  position.x += normal.x * penetration;
  position.z += normal.z * penetration;
  return { collider, normal, penetration };
}

function resolveCircleCircle(a, b) {
  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  const dist = length2(dx, dz);
  const required = (a.radius || 0) + (b.radius || 0);
  if (dist >= required) return null;

  const normal = normalize(dx, dz);
  const penetration = required - dist;
  const aWeight = getColliderWeight(a);
  const bWeight = getColliderWeight(b);
  const aInv = aWeight === Infinity ? 0 : 1 / aWeight;
  const bInv = bWeight === Infinity ? 0 : 1 / bWeight;
  const totalInv = aInv + bInv;
  if (totalInv <= EPSILON) return null;

  const aMove = (aInv / totalInv) * penetration;
  const bMove = (bInv / totalInv) * penetration;
  a.position.x -= normal.x * aMove;
  a.position.z -= normal.z * aMove;
  b.position.x += normal.x * bMove;
  b.position.z += normal.z * bMove;

  return { a, b, normal, penetration };
}

export class ContactLayer {
  constructor({ skinWidth = 0.03 } = {}) {
    this.skinWidth = skinWidth;
    this.colliders = new Map();
  }

  addCollider(collider) {
    const id = collider.id || `collider-${this.colliders.size + 1}`;
    const normalized = {
      id,
      type: collider.type || collider.category || 'furniture',
      category: collider.category || collider.type || 'furniture',
      solid: collider.solid !== false,
      contactWeight: collider.contactWeight ?? Infinity,
      ...collider,
      id,
      position: { x: collider.position.x, z: collider.position.z },
    };
    this.colliders.set(id, normalized);
    return normalized;
  }

  updateCollider(id, position) {
    const collider = this.colliders.get(id);
    if (collider) {
      collider.position.x = position.x;
      collider.position.z = position.z;
    }
    return collider;
  }

  removeCollider(id) {
    this.colliders.delete(id);
  }

  clearDynamic(category = 'npc') {
    for (const [id, collider] of this.colliders) {
      if (collider.category === category || collider.type === category || collider.type === 'softNpc') {
        this.colliders.delete(id);
      }
    }
  }

  moveCircle(start, delta, body) {
    const radius = body.radius ?? 0.45;
    let position = { x: start.x, z: start.z };
    let remaining = { x: delta.x, z: delta.z };
    const contacts = [];

    for (let iteration = 0; iteration < 4; iteration++) {
      if (length2(remaining.x, remaining.z) < EPSILON) break;

      let earliest = null;
      for (const collider of this.colliders.values()) {
        if (!collider.solid || collider.shape !== 'aabb') continue;
        if (this._bodyClearsCollider(body, collider)) continue;
        const hit = sweepPointAabb(position, remaining, getAabbBounds(collider, radius));
        if (hit && (!earliest || hit.time < earliest.time)) {
          earliest = { ...hit, collider };
        }
      }

      if (!earliest) {
        position.x += remaining.x;
        position.z += remaining.z;
        remaining = { x: 0, z: 0 };
        break;
      }

      const travel = Math.max(0, earliest.time - 0.0001);
      position.x += remaining.x * travel;
      position.z += remaining.z * travel;
      contacts.push({
        collider: earliest.collider,
        normal: earliest.normal,
        penetration: 0,
      });

      const restScale = 1 - travel;
      const rest = { x: remaining.x * restScale, z: remaining.z * restScale };
      const intoNormal = rest.x * earliest.normal.x + rest.z * earliest.normal.z;
      remaining = {
        x: rest.x - earliest.normal.x * Math.min(0, intoNormal),
        z: rest.z - earliest.normal.z * Math.min(0, intoNormal),
      };
    }

    for (let iteration = 0; iteration < 3; iteration++) {
      let resolvedAny = false;
      for (const collider of this.colliders.values()) {
        if (!collider.solid) continue;
        if (this._bodyClearsCollider(body, collider)) continue;
        let contact = null;
        if (collider.shape === 'aabb') {
          contact = resolveCircleAabb(position, radius, collider);
        } else if (collider.shape === 'circle' && collider.category !== body.category) {
          const dx = position.x - collider.position.x;
          const dz = position.z - collider.position.z;
          const dist = length2(dx, dz);
          const required = radius + (collider.radius || 0);
          if (dist < required) {
            const normal = normalize(dx, dz);
            const penetration = required - dist;
            const colliderWeight = getColliderWeight(collider);
            const bodyWeight = getColliderWeight(body);
            const bodyInv = bodyWeight === Infinity ? 0 : 1 / bodyWeight;
            const colliderInv = colliderWeight === Infinity || colliderWeight >= 8 ? 0 : 1 / colliderWeight;
            const totalInv = bodyInv + colliderInv || 1;
            const bodyMove = (bodyInv / totalInv || 1) * penetration;
            const colliderMove = (colliderInv / totalInv) * penetration;
            position.x += normal.x * bodyMove;
            position.z += normal.z * bodyMove;
            collider.position.x -= normal.x * colliderMove;
            collider.position.z -= normal.z * colliderMove;
            contact = { collider, normal, penetration };
          }
        }
        if (contact) {
          contacts.push(contact);
          resolvedAny = true;
        }
      }
      if (!resolvedAny) break;
    }

    return {
      position,
      delta: { x: position.x - start.x, z: position.z - start.z },
      contacts,
    };
  }

  _bodyClearsCollider(body, collider) {
    if (collider.shape !== 'aabb' || collider.maxY === undefined || body.footY === undefined) {
      return false;
    }
    if (collider.climbable && body.isAirborne && body.footY > 0.05) {
      return true;
    }
    return body.footY >= collider.maxY - (body.climbClearance ?? 0);
  }

  resolveDynamicContacts() {
    const contacts = [];
    const solidCircles = [...this.colliders.values()].filter(
      (collider) => collider.solid && collider.shape === 'circle'
    );

    for (let i = 0; i < solidCircles.length; i++) {
      for (let j = i + 1; j < solidCircles.length; j++) {
        const contact = resolveCircleCircle(solidCircles[i], solidCircles[j]);
        if (contact) contacts.push(contact);
      }
    }

    return contacts;
  }
}
