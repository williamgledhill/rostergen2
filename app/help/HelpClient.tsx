"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Lightbulb, Search, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { HELP_SECTIONS, type HelpBlock, type HelpTopic } from "@/lib/helpContent";

/** Shows **bold** spans as bold; everything else as plain text. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-semibold text-[var(--text)]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function Block({ block }: { block: HelpBlock }) {
  if (block.kind === "text") {
    return (
      <p>
        <RichText text={block.text} />
      </p>
    );
  }
  if (block.kind === "tip") {
    return (
      <p className="flex gap-2 rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 py-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <span>
          <RichText text={block.text} />
        </span>
      </p>
    );
  }
  const ListTag = block.kind === "steps" ? "ol" : "ul";
  return (
    <ListTag className={`space-y-1.5 pl-5 ${block.kind === "steps" ? "list-decimal" : "list-disc"}`}>
      {block.items.map((item) => (
        <li key={item} className="pl-1">
          <RichText text={item} />
        </li>
      ))}
    </ListTag>
  );
}

function topicText(topic: HelpTopic) {
  return [
    topic.title,
    ...topic.body.flatMap((block) => ("items" in block ? block.items : [block.text])),
  ]
    .join(" ")
    .replace(/\*\*/g, "")
    .toLowerCase();
}

function readHash() {
  if (typeof window === "undefined") return "";
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

export default function HelpClient() {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  // A link to a topic (/help#lock) opens it and scrolls to it.
  useEffect(() => {
    const openFromHash = () => {
      const id = readHash();
      if (!id) return;
      setOpenIds((current) => new Set(current).add(id));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const needle = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!needle) return HELP_SECTIONS;
    const words = needle.split(/\s+/);
    return HELP_SECTIONS.map((section) => ({
      ...section,
      topics: section.topics.filter((topic) => {
        const haystack = topicText(topic);
        return words.every((word) => haystack.includes(word));
      }),
    })).filter((section) => section.topics.length > 0);
  }, [needle]);
  const resultCount = sections.reduce((total, section) => total + section.topics.length, 0);

  const toggle = (id: string, open: boolean) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Help" description="How to plan rosters and set up people, tasks and tours." />

      <div className="relative mb-6 max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
          aria-hidden="true"
        />
        <input
          type="search"
          className="input w-full pl-9"
          placeholder="Search help, e.g. lock, school tours, backup"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search help"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Help contents" className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-[14px]">
            {HELP_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-8">
          {needle && (
            <p className="text-[14px] text-[var(--text-muted)]" role="status">
              {resultCount === 0
                ? "Nothing matches that. Try a different word."
                : `${resultCount} topic${resultCount === 1 ? "" : "s"} found.`}
            </p>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20" aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`} className="text-[17px] font-semibold">
                {section.title}
              </h2>
              <p className="mt-0.5 text-[14px] text-[var(--text-muted)]">{section.description}</p>

              <div className="card mt-3 divide-y divide-[var(--border)]">
                {section.topics.map((topic) => (
                  <details
                    key={topic.id}
                    id={topic.id}
                    className="group scroll-mt-20"
                    open={!!needle || openIds.has(topic.id)}
                    onToggle={(event) => {
                      if (!needle) toggle(topic.id, event.currentTarget.open);
                    }}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-[var(--surface-subtle)] [&::-webkit-details-marker]:hidden">
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-open:rotate-90"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 text-[14px] font-medium">{topic.title}</span>
                      {topic.adminOnly && (
                        <span className="badge shrink-0" title="Only administrators can do this">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          Admins
                        </span>
                      )}
                    </summary>
                    <div className="space-y-3 px-5 pb-5 pl-12 text-[14px] leading-6 text-[var(--text-muted)]">
                      {topic.body.map((block, index) => (
                        <Block key={index} block={block} />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
