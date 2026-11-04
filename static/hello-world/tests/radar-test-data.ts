// LOCAL / MOCK_TRANSPORT. Authored hints, not hosted event-delivery evidence.
import type { PlanAttention } from "@anticipate/contracts";
import { plan, meta } from "./core-test-data";
export const radarAttention: PlanAttention = {
  planId: plan.planId,
  monitoring: {
    state: "ACTIVE",
    reasons: [],
    lastObservedAt: meta.generatedAt,
  },
  coverage: { indexed: 3, unindexed: 0 },
  needsReview: true,
  items: [
    {
      factId: "mock-link",
      type: "LINK_CREATED",
      issueIds: ["1", "2"],
      linkId: "10",
      linkType: "Blocks",
      occurredAt: meta.generatedAt,
      observedAt: meta.generatedAt,
    },
    {
      factId: "mock-delete",
      type: "ISSUE_DELETED",
      issueIds: ["3"],
      linkId: null,
      linkType: null,
      occurredAt: meta.generatedAt,
      observedAt: meta.generatedAt,
    },
  ],
  truncated: false,
  clearedAt: null,
  note: "Authored radar note: hints are not a freshness verdict; missing events are possible.",
};
