export type GroupAllowEntry = {
  groupLower: string; // "*" or lowercase groupId
  senderLower: string; // "*" or lowercase senderId
};

export type NormalizedAllowFrom = {
  entries: string[];
  entriesLower: string[];
  hasWildcard: boolean;
  hasEntries: boolean;
  groupEntries: GroupAllowEntry[];
};

/**
 * Normalize allowFrom list:
 * - trim whitespace
 * - support "dingtalk:/dd:/ding:" prefixes
 * - precompute lower-case list for case-insensitive checks
 */
export function normalizeAllowFrom(list?: Array<string>): NormalizedAllowFrom {
  const entries = (list ?? []).map((value) => String(value).trim()).filter(Boolean);
  const hasWildcard = entries.includes("*");
  const normalized = entries
    .filter((value) => value !== "*")
    .map((value) => value.replace(/^(dingtalk|dd|ding):/i, ""));
  const normalizedLower = normalized.map((value) => value.toLowerCase());

  const groupEntries: GroupAllowEntry[] = [];
  if (hasWildcard) {
    groupEntries.push({ groupLower: "*", senderLower: "*" });
  }
  for (const lower of normalizedLower) {
    const colonIdx = lower.indexOf(":");
    if (colonIdx === -1) {
      // Pure ID — backward-compatible: group=id, sender=*
      groupEntries.push({ groupLower: lower, senderLower: "*" });
    } else {
      const group = lower.slice(0, colonIdx);
      const sender = lower.slice(colonIdx + 1);
      if (group && sender) {
        groupEntries.push({ groupLower: group, senderLower: sender });
      }
    }
  }

  return {
    entries: normalized,
    entriesLower: normalizedLower,
    hasWildcard,
    hasEntries: entries.length > 0,
    groupEntries,
  };
}

export function isSenderAllowed(params: {
  allow: NormalizedAllowFrom;
  senderId?: string;
}): boolean {
  const { allow, senderId } = params;
  if (!allow.hasEntries) {
    return true;
  }
  if (allow.hasWildcard) {
    return true;
  }
  if (senderId && allow.entriesLower.includes(senderId.toLowerCase())) {
    return true;
  }
  return false;
}

export function isSenderGroupAllowed(params: {
  allow: NormalizedAllowFrom;
  groupId?: string;
  senderId?: string;
}): boolean {
  const { allow, groupId, senderId } = params;
  if (!groupId) {
    return false;
  }
  const groupLower = groupId.toLowerCase();
  const senderLower = senderId?.toLowerCase() ?? "";
  for (const entry of allow.groupEntries) {
    const groupMatch = entry.groupLower === "*" || entry.groupLower === groupLower;
    const senderMatch =
      entry.senderLower === "*" || (senderLower !== "" && entry.senderLower === senderLower);
    if (groupMatch && senderMatch) {
      return true;
    }
  }
  return false;
}
