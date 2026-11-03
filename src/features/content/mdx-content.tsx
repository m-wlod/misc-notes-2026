import { getTranslations } from "next-intl/server";
import type { ComponentProps, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";

import * as blocks from "@/components/content/blocks";
import { CheckYourself } from "@/components/content/check-yourself";
import { Checker } from "@/features/debunk/checkers/checker";
import { cx } from "@/lib/cx";

/**
 * Renders a Velite-compiled MDX body (function-body code produced at build time from our
 * own repo content, never from user input) with the lesson component map.
 */
type MdxModule = { default: (props: { components: Record<string, unknown> }) => ReactNode };

function compile(code: string): MdxModule["default"] {
  // The code is our build output (content/ in git), so evaluating it is the documented
  // Velite pattern, not eval of untrusted input.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(code) as (scope: typeof runtime) => MdxModule;
  return fn({ ...runtime }).default;
}

function headingWithAnchor(Tag: "h2" | "h3", className: string) {
  return async function Heading({ id, children }: ComponentProps<"h2">) {
    const t = await getTranslations("content");
    const title = typeof children === "string" ? children : "";
    return (
      <Tag id={id} className={cx("group scroll-mt-24 font-serif text-ink", className)}>
        {children}
        {id ? (
          <a
            href={`#${id}`}
            aria-label={t("headingAnchor", { title })}
            className="ml-2 font-sans text-ink-muted no-underline opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            #
          </a>
        ) : null}
      </Tag>
    );
  };
}

const components = {
  ...blocks,
  CheckYourself,
  Checker,
  h2: headingWithAnchor("h2", "mt-12 mb-4 text-xl"),
  h3: headingWithAnchor("h3", "mt-8 mb-3 text-lg"),
  pre: ({ className, ...props }: ComponentProps<"pre">) => (
    <pre
      className={cx(
        "my-6 overflow-x-auto rounded-md border border-rule px-4 py-3 font-mono text-sm leading-relaxed",
        className,
      )}
      // Keyboard users can scroll long lines (WCAG 2.1.1).
      role="group"
      tabIndex={0}
      {...props}
    />
  ),
  ul: (props: ComponentProps<"ul">) => <ul className="mb-4 list-disc pl-6" {...props} />,
  ol: (props: ComponentProps<"ol">) => <ol className="mb-4 list-decimal pl-6" {...props} />,
} satisfies Record<string, unknown>;

/**
 * MDX output is a plain function of props (no hooks), so it is called directly rather
 * than mounted as a component created during render.
 */
export function MdxContent({ code }: { code: string }): ReactNode {
  return compile(code)({ components });
}
