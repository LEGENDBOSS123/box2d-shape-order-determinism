/**
 * PATCH: order-independent ("canonical") ordering.
 *
 * Box2D gives every body/shape/contact an id from creation order, and the solver walks contacts in
 * that order (Gauss-Seidel: order changes float results). Two worlds containing the same shapes but
 * created in a different order therefore drift apart.
 *
 * Fix: give every shape a canonical hash derived ONLY from its own properties (body def + geometry +
 * material), never from ids. Contacts are oriented (A/B) and solved in order of those hashes.
 */

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

function mix(h, x)
{
    h ^= x; h = Math.imul(h, 16777619); h ^= h >>> 15;

    return h;
}

// Hash any tree of numbers/booleans/arrays/plain objects (skips functions, null, userData-like strings)
function feed(st, v)
{
    switch (typeof v)
    {
        case 'number':
            f64[0] = v === 0 ? 0 : v; // -0 == 0
            st[0] = mix(st[0], u32[0]); st[0] = mix(st[0], u32[1]);
            st[1] = mix(st[1], u32[1] ^ 0x9e3779b9); st[1] = mix(st[1], u32[0] + 0x85ebca6b);

            return;
        case 'boolean':
            feed(st, v ? 1 : 0);

            return;
        case 'object':
            if (v === null) { return; }

            if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { feed(st, v[i]); } return; }

            for (const k in v) { const x = v[k]; if (typeof x !== 'function') { feed(st, x); } }

            return;
        default:
    }
}

/** Returns a 53-bit integer hash of the given values. Order of arguments matters; creation order never enters. */
export function b2CanonHash(...values)
{
    const st = [2166136261 | 0, 0x811c9dc5 ^ 0x5bd1e995];
    feed(st, values);

    return (st[0] >>> 11) * 4294967296 + (st[1] >>> 0);
}

/** Canonical sort key of a contact = ordered pair of its two shape hashes. */
export function b2SortOverflowContacts(world, color)
{
    const contacts = color.contacts, n = contacts.count, data = contacts.data;

    if (n < 2) { return; }

    const shapes = world.shapeArray, cArr = world.contactArray;
    const lo = new Float64Array(n), hi = new Float64Array(n), idx = new Array(n);
    let sorted = true;

    for (let i = 0; i < n; i++)
    {
        const c = cArr[data[i].contactId];
        const ha = shapes[c.shapeIdA].canonHash, hb = shapes[c.shapeIdB].canonHash;
        lo[i] = ha < hb ? ha : hb; hi[i] = ha < hb ? hb : ha; idx[i] = i;

        if (i > 0 && (lo[i - 1] > lo[i] || (lo[i - 1] === lo[i] && hi[i - 1] > hi[i]))) { sorted = false; }
    }

    if (sorted) { return; }

    // tie-break on shape ids only for exact hash collisions (identical shapes: order then cannot matter)
    idx.sort((a, b) => (lo[a] - lo[b]) || (hi[a] - hi[b]) || (a - b));

    const old = data.slice(0, n);

    for (let i = 0; i < n; i++)
    {
        data[i] = old[idx[i]];
        cArr[data[i].contactId].localIndex = i;
    }
}
