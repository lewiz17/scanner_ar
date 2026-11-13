'use strict';

// Store en memoria para tests: replica la semántica del store de Neon
// (lib/db.js), incluido el consumo atómico de vistas (§6).

class MemoryStore {
  constructor() {
    this.cards = new Map(); // id -> card
    this.viewEvents = []; // { cardId, sessionId, mode, deviceClass, createdAt }
    this.dedupe = new Map(); // `${cardId}|${deviceHash}` -> lastViewAt (ms)
  }

  addCard(card) {
    this.cards.set(card.id, { views_used: 0, ...card });
    return this.cards.get(card.id);
  }

  async getCardBySlug(slug) {
    for (const card of this.cards.values()) {
      if (card.slug === slug) return card;
    }
    return null;
  }

  async getCardById(id) {
    return this.cards.get(id) || null;
  }

  // Réplica síncrona (y por tanto atómica en un solo hilo) del CTE de Neon.
  async tryConsumeView({ cardId, sessionId, mode, deviceClass, deviceHash, dedupeMinutes, now }) {
    const card = this.cards.get(cardId);
    if (!card) return { outcome: 'not-active', viewsUsed: 0, quotaTotal: 0 };
    const nowMs = (now instanceof Date ? now : new Date(now)).getTime();

    if (this.viewEvents.some((e) => e.sessionId === sessionId)) {
      return { outcome: 'session', viewsUsed: card.views_used, quotaTotal: card.quota_total };
    }
    if (deviceHash) {
      const last = this.dedupe.get(`${cardId}|${deviceHash}`);
      if (last !== undefined && last > nowMs - dedupeMinutes * 60_000) {
        return { outcome: 'device', viewsUsed: card.views_used, quotaTotal: card.quota_total };
      }
    }
    if (card.status !== 'activa') {
      return { outcome: 'not-active', viewsUsed: card.views_used, quotaTotal: card.quota_total };
    }
    if (card.quota_total - card.views_used <= 0) {
      return { outcome: 'exhausted', viewsUsed: card.views_used, quotaTotal: card.quota_total };
    }
    card.views_used += 1;
    this.viewEvents.push({ cardId, sessionId, mode, deviceClass, createdAt: new Date(nowMs) });
    if (deviceHash) this.dedupe.set(`${cardId}|${deviceHash}`, nowMs);
    return { outcome: 'counted', viewsUsed: card.views_used, quotaTotal: card.quota_total };
  }
}

module.exports = { MemoryStore };
