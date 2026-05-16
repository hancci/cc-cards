"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";

export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="cc-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-link)] underline underline-offset-2 hover:no-underline"
              {...rest}
            >
              {children}
            </a>
          ),
          code: (props: ComponentProps<"code"> & { inline?: boolean }) => {
            const { children, className } = props;
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) {
              return (
                <code className="px-1 py-[1px] rounded bg-[var(--color-card-header)] font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--color-ink)]">
                  {children}
                </code>
              );
            }
            return (
              <code className="block w-full font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed">
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre className="my-2 overflow-auto rounded bg-[var(--color-card-header)] p-2 font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed text-[var(--color-ink)]">
              {props.children}
            </pre>
          ),
          h1: (props) => <h3 className="cc-md-h cc-md-h1" {...props} />,
          h2: (props) => <h3 className="cc-md-h cc-md-h2" {...props} />,
          h3: (props) => <h4 className="cc-md-h cc-md-h3" {...props} />,
          h4: (props) => <h5 className="cc-md-h cc-md-h4" {...props} />,
          h5: (props) => <h6 className="cc-md-h cc-md-h5" {...props} />,
          h6: (props) => <h6 className="cc-md-h cc-md-h6" {...props} />,
          ul: (props) => <ul className="cc-md-list cc-md-ul" {...props} />,
          ol: (props) => <ol className="cc-md-list cc-md-ol" {...props} />,
          li: (props) => <li className="cc-md-li" {...props} />,
          blockquote: (props) => (
            <blockquote className="cc-md-quote" {...props} />
          ),
          hr: () => <hr className="cc-md-hr" />,
          table: (props) => <table className="cc-md-table" {...props} />,
          th: (props) => <th className="cc-md-th" {...props} />,
          td: (props) => <td className="cc-md-td" {...props} />,
          p: (props) => <p className="cc-md-p" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
