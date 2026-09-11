/**
 * Minimal text renderer for admin-editable copy that needs a little
 * formatting (decision letters: bold, italics, one link, occasional
 * indented detail lines) without giving an editor a full rich-text editor
 * or a raw-HTML field.
 *
 * Supported inline syntax: **bold**, *italic*, [text](url).
 * Newlines split into separate lines; every line after the first is
 * indented (ml-4) — matches the one shape this app's copy actually uses
 * (a bold "Attend X:" label line followed by indented Location/note lines).
 */

import React from 'react'

/** Replaces `{tokenName}` with tokens[tokenName], left as-is if unknown. */
export function fillTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => tokens[key] ?? match)
}

const INLINE_PATTERN = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let remaining = text
  let i = 0

  while (remaining.length > 0) {
    const match = INLINE_PATTERN.exec(remaining)
    if (!match || match.index === undefined) {
      nodes.push(remaining)
      break
    }

    if (match.index > 0) nodes.push(remaining.slice(0, match.index))

    if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${i++}`}>{match[3]}</em>)
    } else if (match[4] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${i++}`}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {match[4]}
        </a>
      )
    }

    remaining = remaining.slice(match.index + match[0].length)
  }

  return nodes
}

/** Renders a markdown-lite string (already token-filled) to React nodes. */
export function renderMarkdownLite(text: string): React.ReactNode {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {i === 0 ? (
            renderInline(line, `l${i}`)
          ) : (
            <span className="ml-4">{renderInline(line, `l${i}`)}</span>
          )}
        </React.Fragment>
      ))}
    </>
  )
}
