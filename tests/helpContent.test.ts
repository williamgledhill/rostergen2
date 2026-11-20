import { describe, expect, it } from "vitest";
import React from "react";
// @ts-expect-error -- the project has no @types/react-dom; only renderToString is used here.
import { renderToString } from "react-dom/server";
import HelpClient from "@/app/help/HelpClient";
import { HELP_SECTIONS } from "@/lib/helpContent";

describe("help page", () => {
  it("gives every section and topic its own link", () => {
    const ids = HELP_SECTIONS.flatMap((section) => [section.id, ...section.topics.map((topic) => topic.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("closes every bold marker", () => {
    for (const section of HELP_SECTIONS) {
      for (const topic of section.topics) {
        for (const block of topic.body) {
          for (const line of "items" in block ? block.items : [block.text]) {
            expect((line.match(/\*\*/g) ?? []).length % 2, `${topic.id}: ${line}`).toBe(0);
          }
        }
      }
    }
  });

  it("renders every section", () => {
    const html = renderToString(React.createElement(HelpClient));
    for (const section of HELP_SECTIONS) expect(html).toContain(`id="${section.id}"`);
  });
});
